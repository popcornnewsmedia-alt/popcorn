import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiBase } from "@/lib/api-base";

/**
 * Newsletter subscription state for the signed-in user, backed by
 * /api/newsletter/me (JWT-verified — the server derives the email from the
 * session, so nothing about the address is trusted from the client).
 *
 * `subscribed` is null until the first status read resolves, so the UI can
 * show a quiet loading state instead of flashing "off".
 */
export function useNewsletter(enabled: boolean, source = "app-profile") {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessToken = useCallback(async (): Promise<string | undefined> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }, []);

  // Read current status when the surface becomes active.
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      try {
        const token = await accessToken();
        if (!token) return;
        const res = await fetch(`${apiBase()}/api/newsletter/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (active && res.ok) setSubscribed(!!data.subscribed);
      } catch {
        /* leave as null — toggle still works */
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled, accessToken]);

  const setSubscription = useCallback(
    async (next: boolean) => {
      if (busy) return;
      setError(null);
      const prev = subscribed;
      setSubscribed(next); // optimistic
      setBusy(true);
      try {
        const token = await accessToken();
        if (!token) throw new Error("no-session");
        const res = await fetch(`${apiBase()}/api/newsletter/me`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subscribe: next, source }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "failed");
        setSubscribed(!!data.subscribed);
      } catch {
        setSubscribed(prev); // revert on failure
        setError("Couldn't update — please try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, subscribed, accessToken, source],
  );

  return { subscribed, busy, error, setSubscription };
}
