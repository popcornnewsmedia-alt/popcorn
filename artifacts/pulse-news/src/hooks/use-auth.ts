import { useState, useEffect, useCallback, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { apiBase } from '@/lib/api-base';

export interface Profile {
  username: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
  });

  // Track the currently-loaded user id to avoid redundant fetches when
  // onAuthStateChange fires for token refreshes.
  const loadedProfileForRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string | null): Promise<Profile | null> => {
    if (!userId) {
      loadedProfileForRef.current = null;
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        // Non-fatal: the UsernameSheet gate will also re-check.
        console.warn('[useAuth] profile fetch error', error.message);
        return null;
      }
      loadedProfileForRef.current = userId;
      return data ? { username: data.username } : null;
    } catch (e) {
      // Network / unexpected throw — never let this wedge the auth loading state.
      console.warn('[useAuth] profile fetch threw', e);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let settled = false;
    const settle = (next: AuthState) => {
      if (!mounted) return;
      settled = true;
      setState(next);
    };

    // Resolve the initial session from localStorage, then fetch the profile.
    // ALWAYS flip loading→false even if anything throws; a hung profile fetch
    // must not freeze the splash forever.
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        const profile = user ? await loadProfile(user.id) : null;
        settle({ user, session, profile, loading: false });
      } catch (e) {
        console.warn('[useAuth] getSession threw', e);
        settle({ user: null, session: null, profile: null, loading: false });
      }
    })();

    // Belt-and-suspenders: if getSession somehow never resolves (offline,
    // Supabase outage, etc), unblock the UI after 5s so the signed-out
    // CTAs can reveal and the user can retry / sign in.
    const safety = setTimeout(() => {
      if (!mounted || settled) return;
      console.warn('[useAuth] session resolve timed out — unblocking UI');
      settle({ user: null, session: null, profile: null, loading: false });
    }, 5000);

    // Keep state in sync with Supabase auth events (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const user = session?.user ?? null;
        // Skip reloading the profile on pure token refreshes for the same user.
        const shouldReload = !user || loadedProfileForRef.current !== user.id;
        if (shouldReload) {
          const profile = user ? await loadProfile(user.id) : null;
          settle({ user, session, profile, loading: false });
        } else {
          // Token refresh for the same user — preserve the already-loaded
          // profile (avoids a stale-closure null that wipes the username).
          if (!mounted) return;
          settled = true;
          setState(prev => ({ ...prev, user, session, loading: false }));
        }
      } catch (e) {
        console.warn('[useAuth] authStateChange handler threw', e);
        if (!mounted) return;
        settled = true;
        // Preserve whatever profile we had — don't clobber on transient errors.
        setState(prev => ({ ...prev, user: session?.user ?? null, session: session ?? null, loading: false }));
      }
    });

    // Cross-component profile refresh: UsernameSheet dispatches this after
    // a successful insert so every useAuth instance reloads the profiles row
    // without needing a page reload.
    const onProfileUpdated = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        const uid = s?.user?.id ?? null;
        if (!uid) return;
        loadedProfileForRef.current = null;
        const profile = await loadProfile(uid);
        if (!mounted) return;
        setState(prev => ({ ...prev, profile }));
      } catch {
        // Non-fatal — next auth event will reconcile.
      }
    };
    window.addEventListener('popcorn:profile-updated', onProfileUpdated);

    return () => {
      mounted = false;
      clearTimeout(safety);
      subscription.unsubscribe();
      window.removeEventListener('popcorn:profile-updated', onProfileUpdated);
    };
    // loadProfile is stable; state.profile only read for refresh shortcut
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Re-fetch the profile row for the current user. Call after inserting a username. */
  const refreshProfile = useCallback(async () => {
    const userId = state.user?.id ?? null;
    // Force a refetch even if we already have this user cached.
    loadedProfileForRef.current = null;
    const profile = await loadProfile(userId);
    setState(s => ({ ...s, profile }));
    return profile;
  }, [loadProfile, state.user?.id]);

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  // Synchronously wipe Supabase's auth token out of localStorage. Without
  // this, the client's background token-refresh timer (or a late onAuthStateChange
  // from the async signOut call itself) can fire a SIGNED_IN / TOKEN_REFRESHED
  // event milliseconds after we clear local state, read the still-present
  // token, and re-hydrate the session — the "I logged out but got logged
  // back in" bug. Supabase v2 stores the session under `sb-<project>-auth-token`
  // (sometimes split into `.0`/`.1` chunks); nuking any matching key first
  // guarantees concurrent reads see no session.
  const purgeSupabaseStorage = () => {
    try {
      for (const k of Object.keys(localStorage)) {
        if (/^sb-.+-auth-token(\.\d+)?$/.test(k)) localStorage.removeItem(k);
      }
    } catch { /* private-mode / storage-disabled — not fatal */ }
  };

  const signOut = async () => {
    // Clear local state FIRST so the UI always responds on first click. The
    // Supabase client has been observed to wedge after a preceding
    // updateUser / comment insert — an `await` on signOut would then hang
    // indefinitely, making sign-out feel broken. We don't actually need to
    // wait for Supabase: `scope: 'local'` is just a localStorage purge, and
    // we're already doing the manual state reset right here.
    purgeSupabaseStorage();
    loadedProfileForRef.current = null;
    setState({ user: null, session: null, profile: null, loading: false });
    // Fire-and-forget the Supabase clear. If it throws or hangs, the UI is
    // already in the signed-out state — we don't care.
    void supabase.auth.signOut({ scope: 'local' }).catch((e) => {
      console.warn('[useAuth] signOut threw (local state already cleared)', e);
    });
  };

  // Race a supabase promise against a hard timeout so settings saves can't
  // hang the UI forever. Supabase's updateUser has been observed to stall in
  // the browser (notably after HMR / stale GoTrue state), leaving the
  // SAVING… button spinner spinning until the user reloads. 10s gives a
  // healthy network plenty of headroom while still surfacing a retryable
  // error if something's stuck.
  const withTimeout = <T>(p: Promise<T>, ms = 10000, label = "request"): Promise<T> =>
    Promise.race<T>([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out — check your connection and try again.`)), ms),
      ),
    ]);

  // Mobile WebViews have been observed to wedge `supabase.auth.updateUser`
  // when the session token is stale but still valid — the client queues the
  // call behind a refresh that never fires. Poking getSession first forces
  // the client to surface/refresh the current session before we attempt the
  // update, which has reliably unstuck mobile saves. Cheap on desktop.
  const primeSession = async () => {
    try { await withTimeout(supabase.auth.getSession(), 4000, "Session check"); }
    catch { /* swallow — if the update hangs we'll still time it out below */ }
  };

  const updateProfile = async (data: Record<string, unknown>) => {
    await primeSession();
    const { data: res, error } = await withTimeout(
      supabase.auth.updateUser({ data }),
      10000,
      "Save",
    );
    if (error) throw error;
    // Mirror the new metadata into local state immediately so the "You"
    // screen and settings row reflect the change even if the USER_UPDATED
    // auth event is delayed (or swallowed by a concurrent token refresh).
    const nextUser = res?.user ?? null;
    if (nextUser) setState(prev => ({ ...prev, user: nextUser }));
  };

  /** Update the signed-in user's password. Supabase sends a reauth email under
   * the hood only if the session is stale; for a fresh session this is a
   * silent update. */
  const updatePassword = async (newPassword: string) => {
    await primeSession();
    const { data: res, error } = await withTimeout(
      supabase.auth.updateUser({ password: newPassword }),
      10000,
      "Password update",
    );
    if (error) throw error;
    // Keep local user state in sync so subsequent session checks see the
    // post-update user object (and so the next sign-in with the new
    // password uses fresh credentials).
    const nextUser = res?.user ?? null;
    if (nextUser) setState(prev => ({ ...prev, user: nextUser }));
  };

  /** Permanently deletes the signed-in user's account. Hits the server-side
   * /api/auth/delete-account endpoint (which uses the service-role key to
   * purge from auth.users); Postgres ON DELETE CASCADE then cleans up every
   * downstream table (profiles, comments, comment_votes, notifications,
   * saved_articles). Signs the user out on success.
   *
   * We mirror `signOut()`'s pattern: clear local state + storage instantly
   * (fire-and-forget the Supabase call) so the UI can advance to the farewell
   * screen immediately. Awaiting the client-side `signOut` can wedge on the
   * mobile WebView after a POST — exactly what would leave a stale session in
   * localStorage and drop the user into the UsernameSheet on refresh. */
  const deleteAccount = async () => {
    const token = state.session?.access_token;
    if (!token) throw new Error("Not signed in");
    const resp = await fetch(`${apiBase()}/api/auth/delete-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error ?? `Delete failed (${resp.status})`);
    }
    purgeSupabaseStorage();
    loadedProfileForRef.current = null;
    setState({ user: null, session: null, profile: null, loading: false });
    void supabase.auth.signOut({ scope: 'local' }).catch(() => { /* already gone */ });
  };

  return {
    ...state,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    updatePassword,
    deleteAccount,
    refreshProfile,
  };
}
