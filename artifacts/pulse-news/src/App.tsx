import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
// Horizontal day-paginated feed (new). To revert to the legacy vertical feed,
// swap this line back to: import { FeedPage } from "@/pages/FeedPage";
import { FeedPageHorizontal as FeedPage } from "@/pages/FeedPageHorizontal";
import { DesktopHome } from "@/pages/DesktopHome";
import { useIsDesktopWeb } from "@/hooks/use-is-desktop-web";
import NotFound from "@/pages/not-found";
import { EmailConfirmedScreen } from "@/components/EmailConfirmedScreen";
import { VerifyEmailGate } from "@/components/VerifyEmailGate";
import { ResetPasswordScreen } from "@/components/ResetPasswordScreen";
import { UsernameSheet } from "@/components/UsernameSheet";
import { PopcornReadyOverlay } from "@/components/PopcornReadyOverlay";
import { setupPushNotifications } from "@/lib/push-registration";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function HomeRoute() {
  // Desktop web (≥1024px AND not Capacitor / installed PWA) gets the
  // editorial publication layout. Everything else — mobile web, iPad
  // PWA, Capacitor iOS — gets the existing full-bleed FeedPage. The
  // viewport hook re-evaluates on resize so dev-tools width changes
  // hot-swap layouts.
  const isDesktop = useIsDesktopWeb();
  // DEV override: append ?app=1 to force the mobile app layout inside a
  // desktop preview browser (which always reports pointer:fine + hover).
  const forceApp =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("app") === "1";
  return isDesktop && !forceApp ? <DesktopHome /> : <FeedPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      {/* Supabase redirects here after email verification — just render the feed.
          App.tsx's onAuthStateChange will detect the session and show EmailConfirmedScreen. */}
      <Route path="/auth/callback" component={HomeRoute} />
      {/* Password-reset link lands here — set a new password, then signed in. */}
      <Route path="/reset-password" component={ResetPasswordScreen} />
      <Route component={NotFound} />
    </Switch>
  );
}

// The welcome email is triggered from three places (SIGNED_IN, session restore,
// and the email-verification flow). For a brand-new user these can fire
// near-simultaneously — before the server's welcome_sent flag is written — so
// the server's idempotency check alone can't stop a double send (both requests
// read welcome_sent=false and both send). Dedupe per app-load with a
// module-level set so at most ONE request goes out per user; the server flag
// then prevents re-sends on future loads/devices.
const welcomeRequested = new Set<string>();
function requestWelcomeOnce(userId: string, email: string, name: string) {
  if (welcomeRequested.has(userId)) return;
  welcomeRequested.add(userId);
  // Same-origin Vercel function — relative path. (VITE_API_URL points at the
  // Railway news API, which has no /api/auth/* routes.)
  void fetch(`/api/auth/send-welcome`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, email, name }),
  }).catch(() => { /* Non-fatal */ });
}

function App() {
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [usernamePrompt, setUsernamePrompt] = useState<{ userId: string; seed: string } | null>(null);
  // Email of a signed-in-but-UNVERIFIED user. Supabase grants a session at
  // sign-up before the email is confirmed, so we wall off the feed until they
  // verify — null means either signed-out or already verified (no wall).
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  /* ── Email-verification wall ──────────────────────────────────────────
     A signed-in user whose email isn't confirmed (email/password sign-ups —
     Google OAuth users are pre-confirmed) gets a blocking wall over the feed
     until they verify. Re-evaluated on every auth event so the wall drops the
     moment a token refresh reports the email as confirmed, and re-appears on a
     fresh unverified sign-up. */
  useEffect(() => {
    let cancelled = false;
    const evaluate = (session: Session | null) => {
      if (cancelled) return;
      const u = session?.user;
      const confirmed = !!(u && (u.email_confirmed_at || u.confirmed_at));
      // Verified session → no wall. Unconfirmed session → wall (covers any
      // config where Supabase DOES issue a pre-verification session).
      if (u) { setUnverifiedEmail(confirmed ? null : (u.email ?? "your email")); return; }
      // No session — the common email/password case, since Supabase withholds
      // the session until the email is confirmed. Show the wall while a fresh
      // sign-up is still awaiting verification (flag set by SignUpFlow), so the
      // user can't slip past into the public preview.
      const raw = localStorage.getItem("popcorn_awaiting_confirm");
      if (raw) {
        try {
          const f = JSON.parse(raw);
          if (f?.email && Date.now() - (f.ts ?? 0) < 3_600_000) { setUnverifiedEmail(f.email); return; }
        } catch { /* legacy timestamp-only flag — nothing to show */ }
      }
      setUnverifiedEmail(null);
    };
    // One read on mount; thereafter react to the session the EVENT provides.
    // CRITICAL: do NOT call getSession() inside the auth-change handler. Doing
    // so on every event (incl. USER_UPDATED / TOKEN_REFRESHED) can feed back
    // into more events and wedge in-flight auth ops like updateUser — which
    // surfaced as a frozen "SAVING…/UPDATING…" spinner that never cleared.
    supabase.auth.getSession().then(({ data: { session } }) => evaluate(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => evaluate(session));
    // Awaiting-confirm flag (no session in hand) — re-read on our own event and
    // on cross-tab storage changes of that specific key. Rare, so the one-off
    // getSession here is harmless.
    const recheck = () => { supabase.auth.getSession().then(({ data: { session } }) => evaluate(session)); };
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === "popcorn_awaiting_confirm") recheck(); };
    window.addEventListener("popcorn:awaiting-confirm", recheck);
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("popcorn:awaiting-confirm", recheck);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  /* ── Username gate (runs on every SIGNED_IN) ─────────────────────────
     If the user has no profiles row we force the blocking UsernameSheet
     before the feed becomes interactive. Also handles the welcome-email
     hook for Google OAuth new users.

     When the profiles row is missing we also verify the user still exists
     server-side via `getUser()`. A deleted-then-rehydrated session (the
     user cleared their account from another tab/device) would otherwise
     land on UsernameSheet instead of the signed-out splash. */
  useEffect(() => {
    // Fire the welcome email for a confirmed user, at most once. Two layers
    // keep this "new users only, never on a returning sign-in":
    //   1. Client guard — skip if this session already carries welcome_sent.
    //   2. Server idempotency — /api/auth/send-welcome re-checks the DB flag
    //      and sends at most once per user.
    // Called from BOTH the SIGNED_IN handler and the session-restore path
    // below: a Google OAuth redirect surfaces as either event depending on
    // timing, so covering both is what makes new-Google-user welcomes reliable.
    const maybeSendWelcome = (user: User) => {
      const email = user.email;
      const confirmed = !!(user.email_confirmed_at || user.confirmed_at);
      if (!email || !confirmed) return;
      if (user.user_metadata?.welcome_sent) return; // already welcomed — never re-send
      const name =
        (user.user_metadata?.first_name as string | undefined) ||
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        "Reader";
      requestWelcomeOnce(user.id, email, name);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;

      const user = session.user;
      const provider = user.app_metadata?.provider;

      // iOS push-notification registration (no-op on web). Only re-registers
      // when permission is already granted — never cold-prompts. The first-time
      // permission ask is handled by the in-app nudge (EnableNotificationsNudge).
      setupPushNotifications(async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      });

      // Username gate: fetch profile row; prompt if missing.
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!profile) {
          // Before prompting, make sure this session is still backed by a
          // real user. A stale session for a deleted account should be
          // purged, not upgraded through UsernameSheet.
          const { data: live, error: liveErr } = await supabase.auth.getUser();
          if (liveErr || !live?.user) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
            return;
          }
          const seed =
            (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            user.email?.split("@")[0] ??
            "";
          setUsernamePrompt({ userId: user.id, seed });
        }
      } catch {
        // Non-fatal — user can continue, profile gate will retry on next sign-in.
      }

      // Welcome email (idempotent + client-guarded). Also fired from the
      // session-restore path below, so Google OAuth new users get it regardless
      // of which auth event the redirect surfaces.
      maybeSendWelcome(user);
    });

    // Also run the gate for the session that already exists when App mounts
    // (e.g. a returning user refreshing the tab — onAuthStateChange doesn't
    //  always emit SIGNED_IN for rehydrated sessions).
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (!profile) {
          // Same deleted-user guard as the SIGNED_IN branch: confirm the
          // session still points at a real user before showing the sheet.
          const { data: live, error: liveErr } = await supabase.auth.getUser();
          if (liveErr || !live?.user) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
            return;
          }
          const seed =
            (session.user.user_metadata?.full_name as string | undefined) ??
            (session.user.user_metadata?.name as string | undefined) ??
            session.user.email?.split("@")[0] ??
            "";
          setUsernamePrompt({ userId: session.user.id, seed });
        }
      } catch { /* Non-fatal */ }
      // Welcome email for a confirmed session that arrived WITHOUT a SIGNED_IN
      // event — the common Google OAuth redirect case this comment flags above.
      // Idempotent + client-guarded, so returning users never re-trigger it.
      // (The deleted-account branch returns before this, so we never welcome a
      // purged user.)
      maybeSendWelcome(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* ── Email-verified confirmation (manual email/password signups) ──── */
  useEffect(() => {
    const rawFlag = localStorage.getItem("popcorn_awaiting_confirm");
    if (!rawFlag) return;

    // Already shown in this browser tab — don't re-trigger on hot-reload or
    // rapid refreshes before the flag was removed.
    if (sessionStorage.getItem("popcorn_confirmed_shown")) {
      localStorage.removeItem("popcorn_awaiting_confirm");
      return;
    }

    // Parse the flag — supports both legacy string (timestamp) and new JSON format
    let flagData: { ts: number; userId?: string; email?: string; name?: string } = { ts: 0 };
    try {
      flagData = JSON.parse(rawFlag);
    } catch {
      // Legacy: plain timestamp string
      flagData = { ts: parseInt(rawFlag) || 0 };
    }

    // Expire the flag after 1 hour to avoid stale triggers
    if (Date.now() - flagData.ts > 3_600_000) {
      localStorage.removeItem("popcorn_awaiting_confirm");
      return;
    }

    const activate = (session: unknown) => {
      if (!session) return;
      // Re-check flag — getSession and onAuthStateChange can both call this;
      // only the first call should show the screen.
      if (!localStorage.getItem("popcorn_awaiting_confirm")) return;
      localStorage.removeItem("popcorn_awaiting_confirm");
      // Mark as shown so a fast refresh can never re-trigger
      sessionStorage.setItem("popcorn_confirmed_shown", "1");
      // Clean hash/query fragments left by Supabase redirect
      if (
        window.location.hash.includes("access_token") ||
        window.location.hash.includes("type=")
      ) {
        history.replaceState(null, "", window.location.pathname);
      }

      if (flagData.userId && flagData.email && flagData.name) {
        requestWelcomeOnce(flagData.userId, flagData.email, flagData.name);
      }

      setShowConfirmed(true);
    };

    // Check if session already exists (token in URL was already exchanged)
    supabase.auth.getSession().then(({ data: { session } }) => activate(session));

    // Also listen for the sign-in event (token exchange may still be in flight)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => activate(session));

    return () => subscription.unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        {showConfirmed && (
          <EmailConfirmedScreen onContinue={() => setShowConfirmed(false)} />
        )}
        {/* Block the feed for a signed-in-but-unverified account. Sits below the
            EmailConfirmedScreen (z-[500]) so the success screen wins once they
            verify, and above the feed/sign-up sheet so it can't be dismissed. */}
        {unverifiedEmail && <VerifyEmailGate email={unverifiedEmail} />}
        {usernamePrompt && (
          <UsernameSheet
            isOpen={true}
            userId={usernamePrompt.userId}
            defaultSeed={usernamePrompt.seed}
            onComplete={() => setUsernamePrompt(null)}
          />
        )}
        <PopcornReadyOverlay />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
