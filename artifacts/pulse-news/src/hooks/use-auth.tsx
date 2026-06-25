import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { supabase, purgeNativeAuthStorage } from '@/lib/supabase';
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

// ── The auth engine ────────────────────────────────────────────────────────
// This used to be the exported `useAuth` hook, which meant EVERY component that
// called useAuth() spun up its own session resolver + onAuthStateChange
// subscription + token-refresh interplay. With ~11 consumers all running this
// concurrently, two of them could collide on a token refresh and wedge a
// client call (the "frozen spinner / works after refresh" class of bug).
//
// Now it runs ONCE, inside <AuthProvider>, and every useAuth() reads that one
// shared value via context. The body below is unchanged from the old hook.
function useAuthEngine() {
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

    // Keep state in sync with Supabase auth events (sign in, sign out, token refresh).
    //
    // CRITICAL: Do NOT await another Supabase call (e.g. loadProfile) synchronously
    // inside this callback. Supabase-js v2 holds the GoTrue navigator-lock for the
    // duration of signInWithPassword / signInWithOAuth, and fires this event WHILE
    // still holding that lock. Any DB query inside this callback that needs the
    // same lock will deadlock: signIn waits for this callback to return, this
    // callback waits for the DB call, the DB call waits for the lock. The symptom
    // is "login freezes, refresh shows logged in" — the token was persisted to
    // localStorage before the deadlock, so a reload reads it cleanly via
    // getSession (which runs outside the locked context).
    //
    // Fix: update user/session synchronously so the UI can react (FeedPage's
    // user-effect closes the sign-in sheet). Defer loadProfile to a 0ms timeout
    // so it runs AFTER the lock releases.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const user = session?.user ?? null;
      const shouldReload = !user || loadedProfileForRef.current !== user.id;

      if (!shouldReload) {
        // Token refresh for the same user — preserve the already-loaded profile.
        settled = true;
        setState(prev => ({ ...prev, user, session, loading: false }));
        return;
      }

      // Flip UI state immediately (user is now authed; sheet can close) WITHOUT
      // awaiting anything. If signing out (user === null) clear profile now.
      settled = true;
      setState(prev => ({
        ...prev,
        user,
        session,
        profile: user ? prev.profile : null,
        loading: false,
      }));

      if (!user) {
        loadedProfileForRef.current = null;
        return;
      }

      // Defer the profile fetch outside the auth-lock to avoid the deadlock
      // described above. setTimeout(…, 0) is sufficient; the signIn promise
      // will have resolved by the time this fires.
      setTimeout(async () => {
        try {
          const profile = await loadProfile(user.id);
          if (!mounted) return;
          setState(prev => ({ ...prev, profile }));
        } catch (e) {
          console.warn('[useAuth] deferred profile fetch threw', e);
        }
      }, 0);
    });

    // Cross-component profile refresh: UsernameSheet dispatches this after
    // a successful insert so the shared auth value reloads the profiles row
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

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Store first + last separately (and a combined full_name) so email
      // templates can greet by first name and we keep structured name data.
      options: { data: { full_name: fullName, first_name: firstName.trim(), last_name: lastName.trim() } },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  /** Send a BRANDED password-reset email. We hit our own Vercel function
   * (`/api/auth/send-reset`) which generates the recovery link and delivers it
   * through our Resend template — instead of `resetPasswordForEmail`, which
   * sends Supabase's plain default email. The link lands on /reset-password
   * where the user sets a new password and is signed in. The redirect MUST be
   * the web app (an email link can't reopen the Capacitor WebView origin), so
   * native points at the production site. */
  const resetPassword = async (email: string) => {
    const base = Capacitor.isNativePlatform()
      ? 'https://www.popcornmedia.org'
      : window.location.origin;
    const resp = await fetch(`${apiBase()}/api/auth/send-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), redirectTo: `${base}/reset-password` }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error ?? 'Could not send the reset email. Please try again.');
    }
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
    // On native builds the session lives in Capacitor Preferences, not
    // localStorage — clear it there too. Fire-and-forget: the UI is already
    // being reset by the caller and we don't want to await native I/O.
    void purgeNativeAuthStorage();
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

  // Race a supabase promise against a hard timeout so calls can't hang the UI
  // forever.
  const withTimeout = <T,>(p: Promise<T>, ms = 10000, label = "request"): Promise<T> =>
    Promise.race<T>([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out — check your connection and try again.`)), ms),
      ),
    ]);

  // Resolve a valid access token, tolerating a lagging React state and an
  // expired-but-refreshable session (getSession refreshes, refreshSession is
  // the explicit fallback). Returns undefined only when truly signed out.
  const getAccessToken = async (): Promise<string | undefined> => {
    // Read the current session (getSession returns what's stored, which may be
    // expired). Never blindly trust a cached token — a stale one makes the
    // server reject the request as "invalid or expired session".
    let session: Session | null = null;
    try {
      const { data } = await withTimeout(supabase.auth.getSession(), 12000, "Session check");
      session = data.session;
    } catch { /* fall through to refresh */ }
    const stillValid =
      !!session?.access_token &&
      !!session.expires_at &&
      session.expires_at * 1000 > Date.now() + 60_000; // 60s clock skew
    if (stillValid) return session!.access_token;
    // Expired, near-expiry, or unreadable → force a refresh to get a fresh token.
    try {
      const { data } = await withTimeout(supabase.auth.refreshSession(), 12000, "Session refresh");
      if (data.session?.access_token) return data.session.access_token;
    } catch { /* give up */ }
    // Last resort — whatever token we have (the server will be the final judge).
    return session?.access_token ?? state.session?.access_token;
  };

  // POST to a server auth endpoint with a Bearer token. If the server rejects
  // the token (401 — expired OR revoked, e.g. after a password change, which an
  // expires_at check can't detect), force a fresh token and retry ONCE.
  const authedPost = async (path: string, body?: unknown): Promise<Response> => {
    const send = (token: string) =>
      fetch(`${apiBase()}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const token = await getAccessToken();
    if (!token) throw new Error("You appear to be signed out. Please sign in again.");
    let resp = await send(token);
    if (resp.status === 401) {
      try {
        const { data } = await withTimeout(supabase.auth.refreshSession(), 12000, "Session refresh");
        if (data.session?.access_token) resp = await send(data.session.access_token);
      } catch { /* return the original 401 below */ }
    }
    return resp;
  };

  const updateProfile = async (data: Record<string, unknown>) => {
    // Server-side (admin) metadata write — the client updateUser stalls when
    // the session is mid-flight (frozen SAVING…).
    const resp = await authedPost("/api/auth/update-metadata", { metadata: data });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error ?? "Couldn't save your changes. Please try again.");
    }
    // Reflect locally right away, and refresh the session in the background so
    // the JWT picks up the new metadata. Fire-and-forget so a slow refresh
    // can't re-stall the save.
    setState(prev => prev.user
      ? { ...prev, user: { ...prev.user, user_metadata: { ...(prev.user.user_metadata ?? {}), ...data } } }
      : prev);
    void supabase.auth.refreshSession().catch(() => { /* non-fatal */ });
  };

  /** Update the signed-in user's password via the server-side set-password
   * endpoint (admin) — the client updateUser stalls in WebViews. The server
   * also sends the "password changed" confirmation email. */
  const updatePassword = async (newPassword: string) => {
    const resp = await authedPost("/api/auth/set-password", { password: newPassword });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error ?? "Couldn't update your password. Please try again.");
    }
  };

  /** Permanently deletes the signed-in user's account via the server-side
   * /api/auth/delete-account endpoint (service-role; cascades clean up
   * downstream tables). Fires the farewell overlay, then clears local state. */
  const deleteAccount = async () => {
    const resp = await authedPost("/api/auth/delete-account");
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error ?? `Delete failed (${resp.status})`);
    }
    // Trigger the App-level farewell overlay BEFORE clearing the session —
    // signing out unmounts the settings UI, so the farewell can't live there.
    try { localStorage.setItem("popcorn_farewell", "1"); } catch { /* ignore */ }
    window.dispatchEvent(new Event("popcorn:farewell"));
    purgeSupabaseStorage();
    loadedProfileForRef.current = null;
    setState({ user: null, session: null, profile: null, loading: false });
    void supabase.auth.signOut({ scope: 'local' }).catch(() => { /* already gone */ });
  };

  return {
    ...state,
    signUp,
    signIn,
    resetPassword,
    signInWithGoogle,
    signOut,
    updateProfile,
    updatePassword,
    deleteAccount,
    refreshProfile,
  };
}

// ── Context wiring ─────────────────────────────────────────────────────────
type AuthValue = ReturnType<typeof useAuthEngine>;

const AuthContext = createContext<AuthValue | null>(null);

/** Runs the auth engine ONCE and shares it with the whole app. Mount near the
 *  root, above every component that calls useAuth(). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthEngine();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Read the shared auth value. Identical shape to the old per-component hook,
 *  so all existing call sites work unchanged. */
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
