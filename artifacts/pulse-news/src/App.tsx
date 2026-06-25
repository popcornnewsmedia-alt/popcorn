import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
// Horizontal day-paginated feed (new). To revert to the legacy vertical feed,
// swap this line back to: import { FeedPage } from "@/pages/FeedPage";
import { FeedPageHorizontal as FeedPage } from "@/pages/FeedPageHorizontal";
import { DesktopHome } from "@/pages/DesktopHome";
import { SharedArticleRoute } from "@/pages/SharedArticleRoute";
import { useIsDesktopWeb } from "@/hooks/use-is-desktop-web";
import NotFound from "@/pages/not-found";
import { EmailConfirmedScreen } from "@/components/EmailConfirmedScreen";
import { VerifyEmailGate } from "@/components/VerifyEmailGate";
import { ResetPasswordScreen } from "@/components/ResetPasswordScreen";
import { FarewellScreen } from "@/components/FarewellScreen";
import { LegalPage } from "@/components/LegalPage";
import { UsernameSheet } from "@/components/UsernameSheet";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { VerifiedReturnScreen } from "@/components/VerifiedReturnScreen";
import { Capacitor } from "@capacitor/core";
import { PopcornReadyOverlay } from "@/components/PopcornReadyOverlay";
import { setupPushNotifications } from "@/lib/push-registration";
import { supabase } from "@/lib/supabase";
import { AuthProvider } from "@/hooks/use-auth";
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
      {/* Shared article deep-link — opens that article on the public website so
          recipients without the app can read it (no login required). */}
      <Route path="/a/:id">{(params) => <SharedArticleRoute id={Number(params.id)} />}</Route>
      {/* Supabase redirects here after email verification — just render the feed.
          App.tsx's onAuthStateChange will detect the session and show EmailConfirmedScreen. */}
      <Route path="/auth/callback" component={HomeRoute} />
      {/* Password-reset link lands here — set a new password, then signed in. */}
      <Route path="/reset-password" component={ResetPasswordScreen} />
      {/* Real, crawlable legal pages (also shown in-app as the LegalSheet modal). */}
      <Route path="/privacy">{() => <LegalPage kind="privacy" />}</Route>
      <Route path="/terms">{() => <LegalPage kind="terms" />}</Route>
      <Route path="/about">{() => <LegalPage kind="about" />}</Route>
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
// Captured at import time, BEFORE Supabase's detectSessionInUrl (or our own
// history.replaceState cleanup) strips the hash/query — used to detect that
// this web page load is the landing from an email-verification / auth link.
const _initialAuthUrl =
  typeof window !== "undefined" ? `${window.location.hash}${window.location.search}` : "";
// An auth-link landing carries one of these (signup confirm = #access_token /
// ?code / token_hash / type=signup). Recovery (password reset) is excluded —
// it has its own /reset-password screen.
const AUTH_LANDING =
  /[#?&](access_token|code|token_hash)=/.test(_initialAuthUrl) || /[#?&]type=signup/.test(_initialAuthUrl);
const AUTH_RECOVERY = /[#?&]type=recovery/.test(_initialAuthUrl);

// Reject a promise if it doesn't settle in `ms`. Used to guard the profile
// query in the username gate: right after an OAuth code exchange the Supabase
// client can be mid-token-refresh and a `.from(...).select()` hangs with no
// timeout — which previously left the handle-claim sheet un-shown until an app
// restart. We time out and retry instead.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

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
  // Post-sign-in flow for a brand-new account (Google first sign-in):
  //   checking → an instant cover hides the feed while we look up the profile
  //   welcome  → the new-account greeting + "claim my handle" CTA
  //   handle   → the UsernameSheet slides up
  //   idle     → nothing (returning user goes straight to the feed)
  // This ordering (cover BEFORE we know new-vs-returning) is what stops the feed
  // from flashing for a beat before the welcome appears.
  const [authStage, setAuthStage] = useState<"idle" | "checking" | "welcome" | "handle">("idle");
  // Web-only: a verification link opened in a browser that can't finish the
  // sign-in (account was created in the native app). Show a "you're verified —
  // return to the app" screen instead of a confusing half-signed-in feed.
  const [showReturnToApp, setShowReturnToApp] = useState(false);
  // Email of a signed-in-but-UNVERIFIED user. Supabase grants a session at
  // sign-up before the email is confirmed, so we wall off the feed until they
  // verify — null means either signed-out or already verified (no wall).
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  // Show the farewell overlay after an account is deleted (set by
  // useAuth.deleteAccount via flag + event, since the settings UI unmounts).
  const [showFarewell, setShowFarewell] = useState(false);
  useEffect(() => {
    if (typeof localStorage !== "undefined" && localStorage.getItem("popcorn_farewell")) {
      setShowFarewell(true);
    }
    const onFarewell = () => setShowFarewell(true);
    window.addEventListener("popcorn:farewell", onFarewell);
    return () => window.removeEventListener("popcorn:farewell", onFarewell);
  }, []);

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

    // Shared username gate: decide whether this signed-in user still needs to
    // claim a handle, and if so show the welcome interstitial + the sheet.
    //
    // The profile query is timeout-guarded and retried once. Right after a
    // Google OAuth code-exchange the client can be mid-token-refresh and this
    // query hangs indefinitely — that's why the claim-handle screen previously
    // only appeared after an app restart (the restart's getSession path ran the
    // query against a settled session). The timeout + retry makes it appear
    // immediately on the first sign-in instead.
    const evaluateUserGate = async (user: User) => {
      // async wrapper so withTimeout sees a real Promise (the Supabase query
      // builder is only a thenable, which trips up the generic inference).
      const fetchProfile = async () =>
        await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", user.id)
          .maybeSingle();

      let profile: { username: string } | null = null;
      let resolved = false;
      for (let attempt = 0; attempt < 2 && !resolved; attempt++) {
        try {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 700));
          const { data } = await withTimeout(fetchProfile(), 8000);
          profile = data;
          resolved = true;
        } catch {
          // timeout / transient (session mid-flight) — retry once.
        }
      }
      // Couldn't read the profile at all — drop the cover and let the user into
      // the feed; the next SIGNED_IN or an app restart re-runs this gate.
      if (!resolved) { setAuthStage((s) => (s === "checking" ? "idle" : s)); return; }
      // Has a handle → returning user; clear any cover, straight to the feed.
      if (profile) { setAuthStage((s) => (s === "checking" ? "idle" : s)); return; }

      // No handle yet. Confirm the session still maps to a real user before
      // prompting (a deleted-then-rehydrated session should be purged, not
      // upgraded through UsernameSheet).
      const { data: live, error: liveErr } = await supabase.auth.getUser();
      if (liveErr || !live?.user) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setAuthStage((s) => (s === "checking" ? "idle" : s));
        return;
      }
      const seed =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email?.split("@")[0] ??
        "";
      // Brand-new user → welcome interstitial first, then the handle claim.
      // Don't yank the user back if they've already advanced to the sheet.
      setUsernamePrompt((prev) => prev ?? { userId: user.id, seed });
      setAuthStage((s) => (s === "handle" ? "handle" : "welcome"));
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;

      const user = session.user;

      // iOS push-notification registration (no-op on web). Only re-registers
      // when permission is already granted — never cold-prompts. The first-time
      // permission ask is handled by the in-app nudge (EnableNotificationsNudge).
      setupPushNotifications(async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      });

      // Cover the feed IMMEDIATELY (same render as the feed mounts, so it never
      // flashes), then resolve new-vs-returning. Don't downgrade an in-progress
      // welcome/handle flow back to "checking" if SIGNED_IN re-fires.
      setAuthStage((s) => (s === "idle" ? "checking" : s));

      // Defer the gate OUT of the auth-event callback: running a Supabase query
      // synchronously inside the SIGNED_IN handler can wedge right after an
      // OAuth exchange. setTimeout(…, 0) lets the event return first.
      setTimeout(() => { void evaluateUserGate(user); }, 0);

      // Welcome email (idempotent + client-guarded). Also fired from the
      // session-restore path below, so Google OAuth new users get it regardless
      // of which auth event the redirect surfaces.
      maybeSendWelcome(user);
    });

    // Also run the gate for the session that already exists when App mounts
    // (e.g. a returning user refreshing the tab — onAuthStateChange doesn't
    //  always emit SIGNED_IN for rehydrated sessions).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      void evaluateUserGate(session.user);
      // Welcome email for a confirmed session that arrived WITHOUT a SIGNED_IN
      // event — the common Google OAuth redirect case. Idempotent +
      // client-guarded, so returning users never re-trigger it.
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

  /* ── Web-only: verification link opened where sign-in can't complete ────
     If the account was created in the native app and the link is tapped here
     in the browser, the browser confirms the email but can't log in (it doesn't
     hold the PKCE key). Rather than leave the user on a confusing half-signed-in
     public feed, show a "you're verified — return to the app" screen.

     Skipped for: native app, password-recovery links, web sign-ups (they set
     the awaiting-confirm flag in THIS browser → EmailConfirmedScreen handles
     them), and any landing where a session DOES materialise (web/Google login —
     we let the normal flow proceed). */
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!AUTH_LANDING || AUTH_RECOVERY) return;
    if (window.location.pathname.includes("reset-password")) return;
    if (localStorage.getItem("popcorn_awaiting_confirm")) return;

    let done = false;
    const finish = (showIt: boolean) => {
      if (done) return;
      done = true;
      if (showIt) setShowReturnToApp(true);
    };
    // If Supabase establishes a session here (web sign-up or Google web), bail —
    // INITIAL_SESSION / SIGNED_IN fires with a session and the normal flow wins.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) finish(false);
    });
    // Otherwise, after giving the code/hash exchange time to run, still no
    // session ⇒ this browser couldn't sign in ⇒ nudge back to the app.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      finish(!data.session);
    }, 2500);

    return () => { done = true; clearTimeout(t); subscription.unsubscribe(); };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        {showConfirmed && (
          <EmailConfirmedScreen onContinue={() => setShowConfirmed(false)} />
        )}
        {/* Web-only: verified-but-can't-log-in-here (account made in the app). */}
        {showReturnToApp && (
          <VerifiedReturnScreen onContinueWeb={() => setShowReturnToApp(false)} />
        )}
        {/* Block the feed for a signed-in-but-unverified account. Sits below the
            EmailConfirmedScreen (z-[500]) so the success screen wins once they
            verify, and above the feed/sign-up sheet so it can't be dismissed. */}
        {unverifiedEmail && <VerifyEmailGate email={unverifiedEmail} />}
        {showFarewell && <FarewellScreen />}
        {/* New-account flow. The WelcomeScreen (z-[500]) covers the feed the
            instant sign-in fires ("checking"), then shows the greeting
            ("welcome"); the handle sheet stays off-screen until the user taps
            "Claim my handle" ("handle") — then the cover lifts and it slides up. */}
        {(authStage === "checking" || authStage === "welcome") && (
          <WelcomeScreen
            stage={authStage}
            name={usernamePrompt?.seed}
            onContinue={() => setAuthStage("handle")}
          />
        )}
        {usernamePrompt && (
          <UsernameSheet
            isOpen={authStage === "handle"}
            userId={usernamePrompt.userId}
            defaultSeed={usernamePrompt.seed}
            onComplete={() => { setUsernamePrompt(null); setAuthStage("idle"); }}
          />
        )}
        <PopcornReadyOverlay />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
