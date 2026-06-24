import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../_lib/supabase";
import { sendResetPasswordEmail } from "../_lib/resend";

/**
 * Sends a BRANDED password-reset email (via Resend) instead of Supabase's
 * default template. We generate the recovery action link ourselves with the
 * service-role client (`admin.generateLink type:"recovery"`) — which does NOT
 * send any email — then deliver it through our own template so it matches the
 * welcome / verification / account-deleted emails.
 *
 * Privacy: we always return 200 ok, whether or not an account exists, so this
 * endpoint can't be used to enumerate registered emails.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DEFAULT_REDIRECT = "https://www.popcornmedia.org/reset-password";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, redirectTo } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Missing email" });
    }
    // Only honour a redirect that's one of our own https URLs; otherwise fall
    // back to the canonical reset page (also guards the Supabase allow-list).
    const redirect =
      typeof redirectTo === "string" &&
      /^https:\/\/(www\.)?popcornmedia\.org\/reset-password$/.test(redirectTo)
        ? redirectTo
        : DEFAULT_REDIRECT;

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirect },
    });

    if (error || !data?.properties?.action_link) {
      // Most commonly "user not found" — never reveal that. Silently succeed.
      console.warn("generateLink(recovery) skipped:", error?.message);
      return res.json({ ok: true });
    }

    const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      (meta.first_name as string | undefined) ||
      (meta.full_name as string | undefined) ||
      (meta.name as string | undefined) ||
      "there";

    const sent = await sendResetPasswordEmail(email, name, data.properties.action_link);
    if (!sent.success) {
      return res.status(500).json({ error: "Failed to send reset email" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("send-reset error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
