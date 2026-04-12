import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "noreply@popcornmedia.org";
const APP_URL = process.env.APP_URL || "https://popcornmedia.org";

/* ── Verification email ──────────────────────────────────────────────────── */

function verificationHtml(name: string, confirmLink: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#053980;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#053980;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;">
        <!-- Logo -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <span style="font-size:18px;font-weight:800;letter-spacing:0.06em;color:#fff1cd;text-transform:uppercase;">POPCORN</span>
        </td></tr>
        <!-- Heading -->
        <tr><td style="padding-bottom:16px;text-align:center;">
          <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:0.02em;color:#fff1cd;line-height:1.1;text-transform:uppercase;">
            VERIFY YOUR<br/>EMAIL.
          </h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding-bottom:28px;text-align:center;">
          <p style="margin:0;font-size:14px;color:rgba(255,241,205,0.55);line-height:1.6;">
            Hey ${name}, thanks for signing up for Popcorn.<br/>
            Click the button below to verify your email and activate your account.
          </p>
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <a href="${confirmLink}" style="display:inline-block;padding:14px 36px;background:#fff1cd;color:#053980;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;border-radius:999px;">
            VERIFY EMAIL
          </a>
        </td></tr>
        <!-- Fallback link -->
        <tr><td style="padding-bottom:28px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,241,205,0.30);line-height:1.6;">
            If the button doesn't work, copy and paste this link:<br/>
            <a href="${confirmLink}" style="color:rgba(255,241,205,0.50);word-break:break-all;">${confirmLink}</a>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="border-top:1px solid rgba(255,241,205,0.08);padding-top:20px;text-align:center;">
          <p style="margin:0;font-size:10px;color:rgba(255,241,205,0.22);line-height:1.6;">
            Popcorn Media &middot; Culture news, curated.<br/>
            <a href="mailto:hello@popcornmedia.org" style="color:rgba(255,241,205,0.30);text-decoration:none;">hello@popcornmedia.org</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ── Welcome email ───────────────────────────────────────────────────────── */

function welcomeHtml(name: string, appLink?: string): string {
  const link = appLink || APP_URL;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#053980;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#053980;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;">
        <!-- Logo -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <span style="font-size:18px;font-weight:800;letter-spacing:0.06em;color:#fff1cd;text-transform:uppercase;">POPCORN</span>
        </td></tr>
        <!-- Heading -->
        <tr><td style="padding-bottom:16px;text-align:center;">
          <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:0.02em;color:#fff1cd;line-height:1.1;text-transform:uppercase;">
            WELCOME,<br/>${(name || "READER").toUpperCase()}.
          </h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding-bottom:12px;text-align:center;">
          <p style="margin:0;font-size:14px;color:rgba(255,241,205,0.55);line-height:1.65;">
            You're officially part of Popcorn. We curate the most interesting culture stories from around the globe &mdash; the surprising, the fascinating, the things you didn't know you wanted to know.
          </p>
        </td></tr>
        <tr><td style="padding-bottom:28px;text-align:center;">
          <p style="margin:0;font-size:14px;color:rgba(255,241,205,0.55);line-height:1.65;">
            Your personalised feed is ready. Dive in.
          </p>
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <a href="${link}" style="display:inline-block;padding:14px 36px;background:#fff1cd;color:#053980;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;border-radius:999px;">
            START READING
          </a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="border-top:1px solid rgba(255,241,205,0.08);padding-top:20px;text-align:center;">
          <p style="margin:0;font-size:10px;color:rgba(255,241,205,0.22);line-height:1.6;">
            Popcorn Media &middot; Culture news, curated.<br/>
            <a href="mailto:hello@popcornmedia.org" style="color:rgba(255,241,205,0.30);text-decoration:none;">hello@popcornmedia.org</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ── Exported senders ────────────────────────────────────────────────────── */

export async function sendVerificationEmail(
  email: string,
  name: string,
  confirmLink: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Verify your Popcorn account",
      html: verificationHtml(name, confirmLink),
    });
    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error.message };
    }
    console.log(`Verification email sent to ${email}`, result.data);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to send verification email:", message);
    return { success: false, error: message };
  }
}

export async function sendWelcomeEmail(
  email: string,
  name: string,
  appLink?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to Popcorn \u2014 Culture News Curated for You",
      html: welcomeHtml(name, appLink),
    });
    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error.message };
    }
    console.log(`Welcome email sent to ${email}`, result.data);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to send welcome email:", message);
    return { success: false, error: message };
  }
}
