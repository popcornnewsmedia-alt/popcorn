import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";
import { sendVerificationEmail } from "../_lib/resend";

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
    const { email, name } = req.body ?? {};

    if (!email || !name) {
      return res.status(400).json({ error: "Missing required fields: email, name" });
    }

    const appUrl = process.env.APP_URL || "https://popcornmedia.org";
    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: "email_verification",
      email,
      options: { redirectTo: `${appUrl}/auth/callback` },
    });

    if (linkError || !data?.properties?.verification_link) {
      console.error("Failed to generate email link:", linkError);
      return res.status(500).json({ error: "Failed to generate verification link" });
    }

    const emailResult = await sendVerificationEmail(
      email,
      name,
      data.properties.verification_link,
    );

    if (!emailResult.success) {
      return res.status(500).json({
        error: "Failed to send verification email",
        details: emailResult.error,
      });
    }

    return res.status(200).json({ message: "Verification email resent", email });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
