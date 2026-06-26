import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";

/**
 * Newsletter subscription for the SIGNED-IN caller.
 *
 * Security model (mirrors api/auth/delete-account.ts):
 *   - Caller sends a Supabase JWT in `Authorization: Bearer <token>`.
 *   - We verify it via `supabase.auth.getUser(token)` and read the email from
 *     the VERIFIED user — never from the request body. This stops anyone from
 *     subscribing/unsubscribing an address that isn't theirs.
 *
 *   GET  → { subscribed: boolean }   current status for the caller's email
 *   POST → { subscribe: boolean }    set status; returns { subscribed }
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authz = req.headers.authorization ?? "";
    const token = authz.startsWith("Bearer ") ? authz.slice("Bearer ".length) : "";
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    const { data: userData, error: getUserErr } = await supabase.auth.getUser(token);
    if (getUserErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const email = (
      userData.user.email ||
      (userData.user.user_metadata as { email?: string } | undefined)?.email ||
      ""
    )
      .trim()
      .toLowerCase();
    if (!email) return res.status(400).json({ error: "Account has no email address" });

    // ── GET: read current status ──────────────────────────────────────────
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("status")
        .eq("email", email)
        .maybeSingle();
      if (error) {
        console.error("newsletter/me GET error:", error);
        return res.status(500).json({ error: "Couldn't read subscription" });
      }
      return res.status(200).json({ subscribed: data?.status === "subscribed" });
    }

    // ── POST: set status ──────────────────────────────────────────────────
    const subscribe = req.body?.subscribe === true;
    const source = ((req.body?.source ?? "app-profile") as string).slice(0, 40);

    if (subscribe) {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .upsert(
          { email, status: "subscribed", source, unsubscribed_at: null },
          { onConflict: "email" },
        );
      if (error) {
        console.error("newsletter/me subscribe error:", error);
        return res.status(500).json({ error: "Couldn't subscribe" });
      }
      console.log(`Newsletter subscribe (profile): ${email}`);
      return res.status(200).json({ subscribed: true });
    }

    // Unsubscribe — only touch a row that already exists; a no-op if absent.
    const { error } = await supabase
      .from("newsletter_subscribers")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("email", email);
    if (error) {
      console.error("newsletter/me unsubscribe error:", error);
      return res.status(500).json({ error: "Couldn't unsubscribe" });
    }
    console.log(`Newsletter unsubscribe (profile): ${email}`);
    return res.status(200).json({ subscribed: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("newsletter/me exception:", message);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
