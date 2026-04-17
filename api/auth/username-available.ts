import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";

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
    const raw = (req.body?.username ?? "").toString();
    const candidate = raw.trim().toLowerCase();

    if (!candidate) return res.status(400).json({ error: "Missing username" });

    if (!USERNAME_REGEX.test(candidate)) {
      return res.json({ available: false, reason: "format" });
    }
    if (RESERVED.has(candidate)) {
      return res.json({ available: false, reason: "reserved" });
    }

    // Prefer the RPC — honours citext uniqueness + SQL-side reserved list.
    const { data, error } = await supabase.rpc("username_available", { candidate });
    if (error) {
      // If the RPC is not deployed yet, fall back to a direct lookup so the
      // endpoint still works during the incremental rollout.
      const { data: rows, error: qerr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", candidate)
        .limit(1);
      if (qerr) {
        console.error("username-available fallback error:", qerr);
        return res.status(500).json({ error: "Lookup failed" });
      }
      const taken = (rows ?? []).length > 0;
      return res.json({ available: !taken, ...(taken ? { reason: "taken" } : {}) });
    }

    const available = Boolean(data);
    return res.json({ available, ...(available ? {} : { reason: "taken" }) });
  } catch (error) {
    console.error("username-available error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
