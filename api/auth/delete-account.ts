import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";

/**
 * Permanently deletes the signed-in caller's account.
 *
 * Security model:
 *   - Caller must send a valid Supabase JWT in `Authorization: Bearer <token>`.
 *   - We call `supabase.auth.getUser(token)` to verify the token *and* recover
 *     the user id — we never trust a user id supplied in the body.
 *   - We then use the service-role client to delete that user from `auth.users`.
 *   - All downstream tables (profiles, comments, comment_votes, notifications)
 *     cascade automatically via ON DELETE CASCADE on their user_id FKs.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const auth = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    // Verify the JWT by round-tripping it through Supabase. This is the only
    // way to authoritatively bind the request to a user id.
    const { data: userData, error: getUserErr } = await supabase.auth.getUser(token);
    if (getUserErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const userId = userData.user.id;

    const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId);
    if (deleteErr) {
      console.error("delete-account failed:", deleteErr);
      return res.status(500).json({ error: deleteErr.message ?? "Delete failed" });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("delete-account error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
