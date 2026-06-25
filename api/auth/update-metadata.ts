import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";

/**
 * Merges fields into the caller's user_metadata (display name, topics,
 * notification prefs, etc.).
 *
 * The client's supabase.auth.updateUser() stalls when the session is mid-flight
 * (e.g. right after sign-in or once a token has aged out) — the frozen "SAVING…"
 * spinner. Doing it server-side with the service-role admin client removes that
 * dependency: the caller sends a Bearer access token, we verify it to recover
 * the user id, then merge + write.
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
    if (!token) return res.status(401).json({ error: "Missing token" });

    const { metadata } = (req.body ?? {}) as { metadata?: Record<string, unknown> };
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return res.status(400).json({ error: "Missing metadata object" });
    }

    const { data: userData, error: getUserErr } = await supabase.auth.getUser(token);
    if (getUserErr || !userData?.user) {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }

    // Shallow-merge into existing user_metadata so we never clobber other keys.
    const current = (userData.user.user_metadata ?? {}) as Record<string, unknown>;
    const merged = { ...current, ...metadata };

    const { error: updErr } = await supabase.auth.admin.updateUserById(userData.user.id, {
      user_metadata: merged,
    });
    if (updErr) {
      console.error("update-metadata failed:", updErr);
      return res.status(500).json({ error: updErr.message ?? "Couldn't save your changes." });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("update-metadata error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
