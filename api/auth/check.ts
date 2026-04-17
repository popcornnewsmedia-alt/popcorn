import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";

/**
 * Unified identifier-availability + username-reservation endpoint.
 *
 * Merged from the earlier `username-available.ts` + `user-exists.ts` handlers
 * to stay under Vercel's 12-function Hobby-plan cap. Dispatches on `kind`:
 *
 *   POST /api/auth/check
 *     { kind: "username", value: "bharat" }
 *       → { available: boolean, reason?: string }
 *
 *     { kind: "email", value: "a@b.com" }
 *       → { exists: boolean }
 *
 *     { kind: "reserve-username", userId: "<uuid>", username: "bharat" }
 *       → { ok: true } | { ok: false, reason: "format"|"reserved"|"taken"|"no_user"|"already_has_profile" }
 *
 *       Reserves a handle for a freshly-created Supabase auth user who does
 *       not yet have a `profiles` row (e.g. just completed email signup; no
 *       client-side session yet because email confirmation is pending). The
 *       user_id is treated as a capability: it's an unguessable UUID, and
 *       the write is a one-shot (fails if a profile row already exists).
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const RESERVED = new Set([
  "admin", "popcorn", "root", "api", "support", "system", "null", "undefined",
  "moderator", "staff", "help", "about", "terms", "privacy", "login", "signup",
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = (req.body ?? {}) as {
      kind?: string;
      value?: string;
      userId?: string;
      username?: string;
    };
    const { kind } = body;
    if (!kind) return res.status(400).json({ error: "Missing kind" });

    if (kind === "reserve-username") {
      const userId = (body.userId ?? "").toString().trim();
      const candidate = (body.username ?? "").toString().trim().toLowerCase();
      if (!userId || !candidate) {
        return res.status(400).json({ error: "Missing userId or username" });
      }
      if (!USERNAME_REGEX.test(candidate)) return res.json({ ok: false, reason: "format" });
      if (RESERVED.has(candidate)) return res.json({ ok: false, reason: "reserved" });

      // Confirm the auth user actually exists before we write a profile row.
      const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(userId);
      if (userErr || !userRes?.user) {
        return res.json({ ok: false, reason: "no_user" });
      }

      // One-shot: if the user already has a profile, refuse silently so we
      // don't let a third party squat an existing user's row. Legit callers
      // only hit this in the narrow window between signup and first sign-in.
      const { data: existing, error: existErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existErr) {
        console.error("reserve-username existing lookup error:", existErr);
        return res.status(500).json({ error: "Lookup failed" });
      }
      if (existing) return res.json({ ok: false, reason: "already_has_profile" });

      const { error: insertErr } = await supabase
        .from("profiles")
        .insert({ user_id: userId, username: candidate });
      if (insertErr) {
        const code = (insertErr as { code?: string }).code;
        if (code === "23505") return res.json({ ok: false, reason: "taken" });
        console.error("reserve-username insert error:", insertErr);
        return res.status(500).json({ error: "Insert failed" });
      }
      return res.json({ ok: true });
    }

    const raw = (body.value ?? "").toString().trim();
    if (!raw) return res.status(400).json({ error: "Missing value" });

    if (kind === "username") {
      const candidate = raw.toLowerCase();
      if (!USERNAME_REGEX.test(candidate)) return res.json({ available: false, reason: "format" });
      if (RESERVED.has(candidate)) return res.json({ available: false, reason: "reserved" });

      const { data, error } = await supabase.rpc("username_available", { candidate });
      if (error) {
        const { data: rows, error: qerr } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("username", candidate)
          .limit(1);
        if (qerr) {
          console.error("check/username fallback error:", qerr);
          return res.status(500).json({ error: "Lookup failed" });
        }
        const taken = (rows ?? []).length > 0;
        return res.json({ available: !taken, ...(taken ? { reason: "taken" } : {}) });
      }

      const available = Boolean(data);
      return res.json({ available, ...(available ? {} : { reason: "taken" }) });
    }

    if (kind === "email") {
      const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (error) {
        console.error("check/email lookup error:", error);
        return res.status(500).json({ error: "Lookup failed" });
      }
      const exists = (data?.users ?? []).some(
        (u) => u.email?.toLowerCase() === raw.toLowerCase()
      );
      return res.json({ exists });
    }

    return res.status(400).json({ error: "Unknown kind" });
  } catch (error) {
    console.error("check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
