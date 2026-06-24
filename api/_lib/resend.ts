import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
// "Popcorn <noreply@…>" so mail clients show the friendly sender name
// "Popcorn" instead of the bare address (matches the Supabase SMTP sender name).
const FROM_EMAIL = "Popcorn <noreply@popcornmedia.org>";
const APP_URL = process.env.APP_URL || "https://popcornmedia.org";

/* ── Verification email ──────────────────────────────────────────────────── */

// First word only — greetings read better as "Hey Bharat" than full name.
function firstName(name: string | undefined | null, fallback: string): string {
  return (name || "").trim().split(/\s+/)[0] || fallback;
}

function verificationHtml(name: string, confirmLink: string): string {
  const first = firstName(name, "there");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
<style>
@font-face{font-family:'Macabro';src:url('https://popcornmedia.org/fonts/MACABRO.woff2') format('woff2');font-weight:normal;font-style:normal;font-display:swap;}
</style>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <!-- Top strip: blue, logo + wordmark -->
        <tr><td background="https://popcornmedia.org/email-grain-blue.png" style="background-color:#042c85;background-image:url('https://popcornmedia.org/email-grain-blue.png');background-repeat:repeat;background-position:top center;padding:30px 20px 26px;text-align:center;">
          <img src="https://popcornmedia.org/logo-latest.png" alt="Popcorn" width="72" height="72" style="display:inline-block;border-radius:16px;"/>
          <div style="margin-top:14px;font-family:'Macabro','Anton','Helvetica Neue',Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:0.05em;color:#fff1cd;text-transform:uppercase;">POPCORN</div>
        </td></tr>
        <!-- Body: white -->
        <tr><td style="background:#ffffff;padding:40px 28px 34px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding-bottom:16px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:0.01em;color:#042c85;line-height:1.15;text-transform:uppercase;">
                VERIFY YOUR EMAIL.
              </h1>
            </td></tr>
            <tr><td style="padding-bottom:28px;text-align:center;">
              <p style="margin:0;font-size:15px;color:#4a4a4a;line-height:1.65;">
                Hey ${first}, thanks for signing up for Popcorn. Click the button below to verify your email and activate your account.
              </p>
            </td></tr>
            <tr><td style="padding-bottom:28px;text-align:center;">
              <a href="${confirmLink}" style="display:inline-block;padding:14px 38px;background:#042c85;color:#fff1cd;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;border-radius:999px;">
                VERIFY EMAIL
              </a>
            </td></tr>
            <tr><td style="text-align:center;">
              <p style="margin:0;font-size:12px;color:#9aa0a8;line-height:1.6;">
                If the button doesn't work, copy and paste this link:<br/>
                <a href="${confirmLink}" style="color:#042c85;word-break:break-all;">${confirmLink}</a>
              </p>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer: white -->
        <tr><td style="background:#ffffff;border-top:1px solid #eceae3;padding:24px 20px 32px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#9aa0a8;line-height:1.7;">
            Popcorn Media<br/>
            <a href="mailto:hello@popcornmedia.org" style="color:#9aa0a8;text-decoration:none;">hello@popcornmedia.org</a>
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
  const first = firstName(name, "Reader");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
<style>
@font-face{font-family:'Macabro';src:url('https://popcornmedia.org/fonts/MACABRO.woff2') format('woff2');font-weight:normal;font-style:normal;font-display:swap;}
</style>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <!-- Top strip: blue, logo + wordmark -->
        <tr><td background="https://popcornmedia.org/email-grain-blue.png" style="background-color:#042c85;background-image:url('https://popcornmedia.org/email-grain-blue.png');background-repeat:repeat;background-position:top center;padding:30px 20px 26px;text-align:center;">
          <img src="https://popcornmedia.org/logo-latest.png" alt="Popcorn" width="72" height="72" style="display:inline-block;border-radius:16px;"/>
          <div style="margin-top:14px;font-family:'Macabro','Anton','Helvetica Neue',Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:0.05em;color:#fff1cd;text-transform:uppercase;">POPCORN</div>
        </td></tr>
        <!-- Body: white -->
        <tr><td style="background:#ffffff;padding:40px 28px 34px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding-bottom:18px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:0.01em;color:#042c85;line-height:1.15;text-transform:uppercase;">
                WELCOME, ${first.toUpperCase()}.
              </h1>
            </td></tr>
            <tr><td style="padding-bottom:14px;text-align:center;">
              <p style="margin:0;font-size:15px;color:#4a4a4a;line-height:1.7;">
                You're officially part of Popcorn: culturally relevant stories every day, handpicked for you.
              </p>
            </td></tr>
            <tr><td style="padding-bottom:14px;text-align:center;">
              <p style="margin:0;font-size:15px;color:#4a4a4a;line-height:1.7;">
                Every day we gather around <strong style="color:#042c85;">15 of the most relevant stories</strong> from across culture: the surprising, the fascinating, the things worth knowing. In an age of hyper-personalised feeds that just show you more of what you already like, the best discoveries are the ones you weren't looking for. So we keep it organic, a curated mix rather than an echo chamber.
              </p>
            </td></tr>
            <tr><td style="padding-bottom:28px;text-align:center;">
              <p style="margin:0;font-size:15px;color:#4a4a4a;line-height:1.7;">
                Skim the headlines for the quick version, or tap in for the full story. Either way, you'll always know what the world's talking about.
              </p>
            </td></tr>
            <tr><td style="padding-bottom:30px;text-align:center;">
              <a href="${link}" style="display:inline-block;padding:14px 38px;background:#042c85;color:#fff1cd;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;border-radius:999px;">
                START READING
              </a>
            </td></tr>
            <tr><td style="text-align:center;">
              <p style="margin:0;font-size:15px;color:#4a4a4a;line-height:1.6;">
                See you inside,<br/>
                <span style="font-family:'Macabro','Anton','Helvetica Neue',Arial,sans-serif;font-size:17px;letter-spacing:0.03em;color:#042c85;">Team Popcorn</span>
              </p>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer: white -->
        <tr><td style="background:#ffffff;border-top:1px solid #eceae3;padding:24px 20px 32px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#9aa0a8;line-height:1.7;">
            Popcorn Media<br/>
            <a href="mailto:hello@popcornmedia.org" style="color:#9aa0a8;text-decoration:none;">hello@popcornmedia.org</a>
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

/* \u2500\u2500 Account-deleted email \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function accountDeletedHtml(name: string, appLink?: string): string {
  const link = appLink || APP_URL;
  const first = firstName(name, "there");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
<style>
@font-face{font-family:'Macabro';src:url('https://popcornmedia.org/fonts/MACABRO.woff2') format('woff2');font-weight:normal;font-style:normal;font-display:swap;}
</style>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <!-- Top strip: blue, logo + wordmark -->
        <tr><td background="https://popcornmedia.org/email-grain-blue.png" style="background-color:#042c85;background-image:url('https://popcornmedia.org/email-grain-blue.png');background-repeat:repeat;background-position:top center;padding:30px 20px 26px;text-align:center;">
          <img src="https://popcornmedia.org/logo-latest.png" alt="Popcorn" width="72" height="72" style="display:inline-block;border-radius:16px;"/>
          <div style="margin-top:14px;font-family:'Macabro','Anton','Helvetica Neue',Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:0.05em;color:#fff1cd;text-transform:uppercase;">POPCORN</div>
        </td></tr>
        <!-- Body: white -->
        <tr><td style="background:#ffffff;padding:40px 28px 34px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding-bottom:16px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:0.01em;color:#042c85;line-height:1.15;text-transform:uppercase;">
                YOUR ACCOUNT WAS DELETED.
              </h1>
            </td></tr>
            <tr><td style="padding-bottom:14px;text-align:center;">
              <p style="margin:0;font-size:15px;color:#4a4a4a;line-height:1.7;">
                Hey ${first}, your Popcorn account and all its data have been permanently deleted, as you requested. We're sorry to see you go.
              </p>
            </td></tr>
            <tr><td style="padding-bottom:28px;text-align:center;">
              <p style="margin:0;font-size:15px;color:#4a4a4a;line-height:1.7;">
                Changed your mind? You're always welcome back \u2014 just sign up again any time. We hope to see you soon.
              </p>
            </td></tr>
            <tr><td style="padding-bottom:30px;text-align:center;">
              <a href="${link}" style="display:inline-block;padding:14px 38px;background:#042c85;color:#fff1cd;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;border-radius:999px;">
                RETURN TO POPCORN
              </a>
            </td></tr>
            <tr><td style="text-align:center;">
              <p style="margin:0;font-size:12px;color:#9aa0a8;line-height:1.6;">
                If you didn't request this, please contact us right away at
                <a href="mailto:hello@popcornmedia.org" style="color:#042c85;">hello@popcornmedia.org</a>.
              </p>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer: white -->
        <tr><td style="background:#ffffff;border-top:1px solid #eceae3;padding:24px 20px 32px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#9aa0a8;line-height:1.7;">
            Popcorn Media<br/>
            <a href="mailto:hello@popcornmedia.org" style="color:#9aa0a8;text-decoration:none;">hello@popcornmedia.org</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendAccountDeletedEmail(
  email: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Popcorn account has been deleted",
      html: accountDeletedHtml(name),
    });
    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error.message };
    }
    console.log(`Account-deleted email sent to ${email}`, result.data);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to send account-deleted email:", message);
    return { success: false, error: message };
  }
}
