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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showConfirmed, setShowConfirmed] = useState(false);

  useEffect(() => {
    const flag = localStorage.getItem("popcorn_awaiting_confirm");
    if (!flag) return;

    // Expire the flag after 1 hour to avoid stale triggers
    if (Date.now() - parseInt(flag) > 3_600_000) {
      localStorage.removeItem("popcorn_awaiting_confirm");
      return;
    }

    const activate = (session: unknown) => {
      if (!session) return;
      localStorage.removeItem("popcorn_awaiting_confirm");
      // Clean hash/query fragments left by Supabase redirect
      if (
        window.location.hash.includes("access_token") ||
        window.location.hash.includes("type=")
      ) {
        history.replaceState(null, "", window.location.pathname);
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
