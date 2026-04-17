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

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (data: Record<string, unknown>) => {
    const { error } = await supabase.auth.updateUser({ data });
    if (error) throw error;
  };

  /** Update the signed-in user's password. Supabase sends a reauth email under
   * the hood only if the session is stale; for a fresh session this is a
   * silent update. */
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  /** Permanently deletes the signed-in user's account. Hits the server-side
   * /api/auth/delete-account endpoint (which uses the service-role key to
   * purge from auth.users); Postgres ON DELETE CASCADE then cleans up every
   * downstream table (profiles, comments, comment_votes, notifications).
   * Signs the user out on success. */
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
    await supabase.auth.signOut();
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
