import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
// Horizontal day-paginated feed (new). To revert to the legacy vertical feed,
// swap this line back to: import { FeedPage } from "@/pages/FeedPage";
import { FeedPageHorizontal as FeedPage } from "@/pages/FeedPageHorizontal";
import NotFound from "@/pages/not-found";
import { EmailConfirmedScreen } from "@/components/EmailConfirmedScreen";
import { UsernameSheet } from "@/components/UsernameSheet";
import { supabase } from "@/lib/supabase";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={FeedPage} />
      {/* Supabase redirects here after email verification — just render the feed.
          App.tsx's onAuthStateChange will detect the session and show EmailConfirmedScreen. */}
      <Route path="/auth/callback" component={FeedPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [usernamePrompt, setUsernamePrompt] = useState<{ userId: string; seed: string } | null>(null);

  /* ── Username gate (runs on every SIGNED_IN) ─────────────────────────
     If the user has no profiles row we force the blocking UsernameSheet
     before the feed becomes interactive. Also handles the welcome-email
     hook for Google OAuth new users. */
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;

      const user = session.user;
      const provider = user.app_metadata?.provider;

      // Username gate: fetch profile row; prompt if missing.
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!profile) {
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

      // Welcome-email logic is Google-specific.
      if (provider !== "google") return;

      // Detect new user: created_at is within the last 2 minutes
      const createdAt = new Date(user.created_at).getTime();
      const isNewUser = Date.now() - createdAt < 120_000;
      if (!isNewUser) return;

      // Prevent duplicate welcome emails
      const sentKey = `popcorn_welcome_sent_${user.id}`;
      if (localStorage.getItem(sentKey)) return;
      localStorage.setItem(sentKey, "1");

      // TODO: Re-enable welcome email once Resend domain is verified (June 2026 domain transfer)
      // const name = user.user_metadata?.full_name || user.user_metadata?.name || "Reader";
      // const email = user.email;
      // if (!email) return;
      // const apiUrl = import.meta.env.VITE_API_URL ?? "";
      // fetch(`${apiUrl}/api/auth/send-welcome`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ userId: user.id, email, name }),
      // }).catch(() => { /* Non-fatal */ });
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
          const seed =
            (session.user.user_metadata?.full_name as string | undefined) ??
            (session.user.user_metadata?.name as string | undefined) ??
            session.user.email?.split("@")[0] ??
            "";
          setUsernamePrompt({ userId: session.user.id, seed });
        }
      } catch { /* Non-fatal */ }
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

      // TODO: Re-enable welcome email once Resend domain is verified (June 2026 domain transfer)
      // if (flagData.userId && flagData.email && flagData.name) {
      //   const apiUrl = import.meta.env.VITE_API_URL ?? "";
      //   fetch(`${apiUrl}/api/auth/send-welcome`, {
      //     method: "POST",
      //     headers: { "Content-Type": "application/json" },
      //     body: JSON.stringify({
      //       userId: flagData.userId,
      //       email: flagData.email,
      //       name: flagData.name,
      //     }),
      //   }).catch(() => { /* Non-fatal — welcome email failure shouldn't block the user */ });
      // }

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
        {usernamePrompt && (
          <UsernameSheet
            isOpen={true}
            userId={usernamePrompt.userId}
            defaultSeed={usernamePrompt.seed}
            onComplete={() => setUsernamePrompt(null)}
          />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
