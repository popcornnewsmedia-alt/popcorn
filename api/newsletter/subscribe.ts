import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Conservative RFC-5322-ish check — good enough to reject typos and bots while
// staying permissive about real-world addresses (subdomains, plus-tags, etc.).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const raw = (req.body?.email ?? "") as string;
    // Honeypot — a hidden field real users never fill. Bots that auto-fill
    // every input trip it; we silently accept so they don't learn to adapt.
    const trap = (req.body?.company ?? "") as string;
    if (trap.trim()) return res.status(200).json({ ok: true, status: "subscribed" });

    const email = raw.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const source = (req.body?.source ?? "website") as string;

    // Upsert on email so a re-submit (or a previously unsubscribed address
    // signing up again) is idempotent and re-activates the subscription.
    const { error } = await supabase
      .from("newsletter_subscribers")
      .upsert(
        {
          email,
          status: "subscribed",
          source: source.slice(0, 40),
          unsubscribed_at: null,
        },
        { onConflict: "email" },
      );

    if (error) {
      console.error("Newsletter subscribe error:", error);
      return res.status(500).json({ error: "Couldn't sign you up — please try again." });
    }

    console.log(`Newsletter signup: ${email} (${source})`);
    return res.status(200).json({ ok: true, status: "subscribed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Newsletter subscribe exception:", message);
    return res.status(500).json({ error: "Something went wrong — please try again." });
  }
}
