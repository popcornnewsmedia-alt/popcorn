import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";

// Resolves a sign-in identifier (email OR username) to an email address so
// the client can call `supabase.auth.signInWithPassword({ email, ... })`.
//
// If the identifier contains "@" it is returned verbatim (email path).
// Otherwise it is treated as a username: profiles row -> user_id -> auth email.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const raw = (req.body?.identifier ?? "").toString().trim();
    if (!raw) return res.status(400).json({ error: "Missing identifier" });

    // Email path — don't leak existence, just echo so the client can proceed.
    if (raw.includes("@")) {
      return res.json({ email: raw });
    }

    const candidate = raw.toLowerCase();
    if (!USERNAME_REGEX.test(candidate)) {
      return res.json({ email: null, reason: "not_found" });
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", candidate)
      .maybeSingle();

    if (profErr) {
      console.error("resolve-identifier profile error:", profErr);
      return res.status(500).json({ error: "Lookup failed" });
    }
    if (!profile?.user_id) {
      return res.json({ email: null, reason: "not_found" });
    }

    const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(profile.user_id);
    if (userErr || !userRes?.user?.email) {
      console.error("resolve-identifier user error:", userErr);
      return res.json({ email: null, reason: "not_found" });
    }

    return res.json({ email: userRes.user.email });
  } catch (error) {
    console.error("resolve-identifier error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
