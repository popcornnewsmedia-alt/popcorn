import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";

/**
 * Sets a new password for the caller during the password-reset flow.
 *
 * The client's own supabase.auth.updateUser() has been observed to hang in the
 * recovery/WebView flow (frozen "UPDATING…"), so we do the change server-side:
 *   - The caller sends the recovery session's access token as a Bearer token.
 *   - We verify it via getUser(token) to recover the user id (never trusting a
 *     body-supplied id).
 *   - We set the password with the service-role admin client.
 * The caller's recovery session stays valid, so the user remains signed in.
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
    if (!token) return res.status(401).json({ error: "Missing reset token" });

    const { password } = (req.body ?? {}) as { password?: string };
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const { data: userData, error: getUserErr } = await supabase.auth.getUser(token);
    if (getUserErr || !userData?.user) {
      return res.status(401).json({ error: "Your reset link has expired. Please request a new one." });
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(userData.user.id, { password });
    if (updErr) {
      console.error("set-password failed:", updErr);
      return res.status(500).json({ error: updErr.message ?? "Couldn't update your password." });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("set-password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
