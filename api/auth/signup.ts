import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";
import { sendVerificationEmail } from "../_lib/resend";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, password, name } = req.body ?? {};

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields: email, password, name" });
    }

    // Create user in Supabase Auth
    const { data, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { name },
    });

    if (signUpError || !data.user) {
      console.error("Supabase signup error:", signUpError);
      return res.status(400).json({
        error: signUpError?.message || "Failed to create user",
      });
    }

    // Generate email verification link
    const appUrl = process.env.APP_URL || "https://popcornmedia.org";
    const { data: confirmData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "email_verification",
      email,
      options: { redirectTo: `${appUrl}/auth/callback` },
    });

    if (linkError || !confirmData?.properties?.verification_link) {
      console.error("Failed to generate email link:", linkError);
      return res.status(500).json({ error: "Failed to generate verification link" });
    }

    // Send verification email via Resend
    const emailResult = await sendVerificationEmail(
      email,
      name,
      confirmData.properties.verification_link,
    );

    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
      return res.status(201).json({
        message: "User created, but verification email failed to send",
        userId: data.user.id,
        email: data.user.email,
        emailSendError: emailResult.error,
      });
    }

    return res.status(201).json({
      message: "Verification email sent",
      userId: data.user.id,
      email: data.user.email,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
