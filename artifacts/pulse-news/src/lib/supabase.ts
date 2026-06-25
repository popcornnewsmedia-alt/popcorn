import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// On iOS/Android native builds, persist the Supabase auth session in the
// device's native key-value store (Capacitor Preferences → iOS UserDefaults /
// Android SharedPreferences) instead of WKWebView localStorage. WKWebView
// localStorage can be evicted by iOS under storage pressure, which silently
// logged users out between launches. Preferences survives app restarts
// reliably. On web we leave Supabase's default (localStorage) untouched so
// existing browser sessions keep working.
const nativeSessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string): Promise<void> => {
    await Preferences.remove({ key });
  },
};

// Synchronously-fired purge of the native-stored auth token on sign-out.
// Mirrors the localStorage purge in use-auth.ts: without this, a late
// token-refresh could re-read the still-present native token and re-hydrate
// the session right after we cleared local state ("logged out but logged back
// in"). No-op on web (localStorage purge there is handled in use-auth.ts).
export async function purgeNativeAuthStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { keys } = await Preferences.keys();
    await Promise.all(
      keys
        .filter((k) => /^sb-.+-auth-token(\.\d+)?$/.test(k))
        .map((k) => Preferences.remove({ key: k })),
    );
  } catch {
    /* ignore — fire-and-forget */
  }
}

// Custom URL scheme that lets the OS hand control back to the native app after
// an external OAuth / email-link round-trip. Registered in
// ios/App/App/Info.plist (CFBundleURLSchemes) and must ALSO be added to the
// Supabase dashboard's allowed Redirect URLs. On web we redirect to the page
// origin as before.
export const NATIVE_AUTH_REDIRECT = 'org.popcornmedia.app://auth/callback';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  {
    auth: {
      // Native builds: store the session token in native storage (see above).
      // Web: omit `storage` so Supabase falls back to localStorage as before.
      ...(Capacitor.isNativePlatform()
        ? {
            storage: nativeSessionStorage,
            // The OAuth redirect comes back via the custom URL scheme and is
            // handled manually by the appUrlOpen listener in use-auth.tsx
            // (exchangeCodeForSession). Don't also try to parse the WKWebView
            // URL — there's no auth code there and it would race our handler.
            detectSessionInUrl: false,
          }
        : {}),
      // PKCE is required for the manual exchangeCodeForSession step on native
      // (the code verifier is persisted in auth storage). It's also the
      // supabase-js v2 default on web, so this is a no-op there.
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      // Disable the default navigator.locks-based inter-tab lock. It causes
      // a 5-second stall on every auth call during dev HMR (stale client
      // instances hold orphaned locks) and isn't needed for our single-tab
      // flow. Multi-tab users may see slightly stale auth across tabs, but
      // a token refresh will reconcile.
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
  },
);
