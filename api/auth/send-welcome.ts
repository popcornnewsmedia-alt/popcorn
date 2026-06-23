import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendWelcomeEmail } from "../_lib/resend";
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
    const { userId, email, name } = req.body ?? {};

    if (!userId || !email || !name) {
      return res.status(400).json({ error: "Missing required fields: userId, email, name" });
    }

    // Idempotency — this endpoint is called on every sign-in, so only send the
    // welcome once per user (tracked via a user_metadata flag). This works
    // regardless of which device verifies the account.
    try {
      const { data: existing } = await supabase.auth.admin.getUserById(userId);
      if (existing?.user?.user_metadata?.welcome_sent) {
        return res.status(200).json({ message: "Welcome already sent — skipped", userId, skipped: true });
      }
    } catch (lookupErr) {
      // Non-fatal: if the lookup fails, proceed to send (better a rare duplicate
      // than a missed welcome).
      console.warn("Welcome dedup lookup failed:", lookupErr);
    }

    const appUrl = process.env.APP_URL || "https://popcornmedia.org";
    const emailResult = await sendWelcomeEmail(email, name, appUrl);

    if (!emailResult.success) {
      console.error("Failed to send welcome email:", emailResult.error);
      return res.status(500).json({
        error: "Failed to send welcome email",
        details: emailResult.error,
      });
    }

    // Mark as sent so future sign-ins don't re-send.
    try {
      const { data: cur } = await supabase.auth.admin.getUserById(userId);
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { ...(cur?.user?.user_metadata ?? {}), welcome_sent: true },
      });
    } catch (flagErr) {
      console.warn("Failed to set welcome_sent flag:", flagErr);
    }

    return res.status(200).json({
      message: "Welcome email sent successfully",
      userId,
      email,
    });
  } catch (error) {
    console.error("Send welcome error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
