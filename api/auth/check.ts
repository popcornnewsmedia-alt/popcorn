import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";

/**
 * Unified identifier-availability endpoint.
 *
 * Merged from the earlier `username-available.ts` + `user-exists.ts` handlers
 * to stay under Vercel's 12-function Hobby-plan cap. Dispatches on `kind`:
 *
 *   POST /api/auth/check
 *     { kind: "username", value: "bharat" } → { available: boolean, reason?: string }
 *     { kind: "email",    value: "a@b.com" } → { exists: boolean }
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
    const { kind, value } = (req.body ?? {}) as { kind?: string; value?: string };
    const raw = (value ?? "").toString().trim();
    if (!kind || !raw) return res.status(400).json({ error: "Missing kind or value" });

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
