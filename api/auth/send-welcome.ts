import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendWelcomeEmail } from "../_lib/resend";

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

    const appUrl = process.env.APP_URL || "https://popcornmedia.org";
    const emailResult = await sendWelcomeEmail(email, name, appUrl);

    if (!emailResult.success) {
      console.error("Failed to send welcome email:", emailResult.error);
      return res.status(500).json({
        error: "Failed to send welcome email",
        details: emailResult.error,
      });
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
