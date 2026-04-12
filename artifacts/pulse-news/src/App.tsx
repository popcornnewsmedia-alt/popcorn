import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FeedPage } from "@/pages/FeedPage";
import NotFound from "@/pages/not-found";
import { EmailConfirmedScreen } from "@/components/EmailConfirmedScreen";
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

      // Fire welcome email — only after user has verified their email
      if (flagData.userId && flagData.email && flagData.name) {
        const apiUrl = import.meta.env.VITE_API_URL ?? "";
        fetch(`${apiUrl}/api/auth/send-welcome`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: flagData.userId,
            email: flagData.email,
            name: flagData.name,
          }),
        }).catch(() => { /* Non-fatal — welcome email failure shouldn't block the user */ });
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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
