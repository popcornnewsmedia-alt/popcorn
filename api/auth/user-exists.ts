import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      console.error("user-exists lookup error:", error);
      return res.status(500).json({ error: "Lookup failed" });
    }

    const exists = (data?.users ?? []).some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    return res.json({ exists });
  } catch (error) {
    console.error("user-exists error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
