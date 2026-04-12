/**
 * Quick Resend test — sends both email templates using the test sender.
 *
 * Usage:  node test-emails.mjs <your-email>
 * Example: node test-emails.mjs bharat@example.com
 *
 * NOTE: Uses "Popcorn <onboarding@resend.dev>" as the sender because
 * popcornmedia.org is not yet verified.  Once you add the DNS records
 * and verify, the real "noreply@popcornmedia.org" sender will work.
 */

import { Resend } from "resend";

const API_KEY = process.env.RESEND_API_KEY || "re_hrvseBJG_5mj43FipdLJwoztgbXKeKMgc";
const TO = process.argv[2];

if (!TO) {
  console.error("Usage: node test-emails.mjs <recipient-email>");
  process.exit(1);
}

const resend = new Resend(API_KEY);

// We use Resend's built-in test sender while domain is not verified
const FROM = "Popcorn <onboarding@resend.dev>";

// ── Verification email ────────────────────────────────────────────
const verifyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Lora:ital@0;1&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:20px 0;background:#053980;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#053980;background-image:radial-gradient(circle at 10% 20%,rgba(255,241,205,0.05) 0%,transparent 40%),radial-gradient(circle at 90% 80%,rgba(255,241,205,0.05) 0%,transparent 40%);overflow:hidden;">
    <!-- Header -->
    <div style="background:#053980;background-image:radial-gradient(circle at 20% 50%,rgba(255,241,205,0.08) 0%,transparent 50%),radial-gradient(circle at 80% 80%,rgba(255,241,205,0.08) 0%,transparent 50%);padding:48px 32px;text-align:center;">
      <p style="font-size:14px;font-weight:bold;color:#fff1cd;letter-spacing:0.12em;margin:0 0 24px 0;text-transform:uppercase;font-family:'Anton',sans-serif;">🍿 POPCORN</p>
      <p style="font-size:32px;font-weight:bold;color:#fff1cd;letter-spacing:0.02em;margin:0 0 16px 0;line-height:1.2;font-family:'Anton',sans-serif;text-transform:uppercase;">CONFIRM YOUR<br/>ACCOUNT.</p>
      <p style="font-size:16px;color:rgba(255,241,205,0.85);margin:0 0 32px 0;line-height:1.6;font-family:'Lora',serif;font-style:italic;">Hi there, click the button below to activate your Popcorn account.</p>
      <a href="https://popcornmedia.org" style="background:#fff1cd;color:#053980;padding:16px 48px;border-radius:12px;font-size:13px;font-weight:bold;text-decoration:none;display:inline-block;margin-bottom:24px;letter-spacing:0.08em;font-family:'Anton',sans-serif;text-transform:uppercase;">CONFIRM EMAIL</a>
      <p style="font-size:12px;color:rgba(255,241,205,0.65);margin:16px 0 0 0;line-height:1.6;">Or copy this link: <span style="color:#fff1cd;word-break:break-all;">https://popcornmedia.org/auth/callback?token=example</span></p>
    </div>
    <!-- Footer -->
    <div style="background:#053980;padding:28px 32px;text-align:center;border-top:1px solid rgba(255,241,205,0.10);">
      <p style="font-size:13px;color:rgba(255,241,205,0.70);margin:0 0 12px 0;line-height:1.6;">Questions? Reach out to us at <span style="color:#fff1cd;font-weight:bold;">hello@popcornmedia.org</span></p>
      <p style="font-size:11px;color:rgba(255,241,205,0.50);margin:0;line-height:1.6;">© 2026 Popcorn Media. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

// ── Welcome email ─────────────────────────────────────────────────
const welcomeHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Lora:ital@0;1&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:20px 0;background:#053980;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#053980;background-image:radial-gradient(circle at 10% 20%,rgba(255,241,205,0.05) 0%,transparent 40%),radial-gradient(circle at 90% 80%,rgba(255,241,205,0.05) 0%,transparent 40%);overflow:hidden;">

    <!-- Header -->
    <div style="padding:48px 32px 40px;text-align:center;background-image:radial-gradient(circle at 20% 50%,rgba(255,241,205,0.08) 0%,transparent 50%),radial-gradient(circle at 80% 80%,rgba(255,241,205,0.08) 0%,transparent 50%);">
      <p style="font-size:13px;color:#fff1cd;letter-spacing:0.12em;margin:0 0 20px 0;text-transform:uppercase;font-family:'Anton',sans-serif;">🍿 POPCORN</p>
      <p style="font-size:36px;color:#fff1cd;letter-spacing:0.02em;margin:0 0 12px 0;line-height:1.15;font-family:'Anton',sans-serif;text-transform:uppercase;">WELCOME,<br/>BHARAT.</p>
      <p style="font-size:16px;color:rgba(255,241,205,0.80);margin:0;font-style:italic;font-family:'Lora',serif;">Your culture feed is ready.</p>
    </div>

    <!-- Mission Section -->
    <div style="padding:40px 32px;border-bottom:1px solid rgba(255,241,205,0.10);">
      <p style="font-size:12px;color:#fff1cd;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 20px 0;font-family:'Anton',sans-serif;">THE POPCORN DIFFERENCE</p>
      <p style="font-size:15px;color:rgba(255,241,205,0.90);line-height:1.7;margin:0 0 14px 0;font-family:'Lora',serif;">Most feeds today promise personalization. What they actually deliver is repetition. You click one thing, and suddenly you are drowning in more of the same. More noise. More filler. Less signal.</p>
      <p style="font-size:15px;color:rgba(255,241,205,0.90);line-height:1.7;margin:0 0 14px 0;font-family:'Lora',serif;">Because here is the truth. <strong style="color:#fff1cd;">You do not know what you do not know.</strong> And that is exactly what makes culture interesting.</p>
      <p style="font-size:15px;color:rgba(255,241,205,0.90);line-height:1.7;margin:0 0 14px 0;font-family:'Lora',serif;"><strong style="color:#fff1cd;">Popcorn takes a different approach. We do the work for you.</strong></p>
      <p style="font-size:15px;color:rgba(255,241,205,0.90);line-height:1.7;margin:0 0 14px 0;font-family:'Lora',serif;">Every day, we hand pick the stories that are actually worth your attention. Across music, film, gaming, fashion, tech, and internet culture. The unexpected. The interesting. The ones that cut through.</p>
      <p style="font-size:14px;color:#fff1cd;line-height:1.8;margin:24px 0 0 0;">
        🎬 No endless loops<br/>
        🎬 No noise dressed as news<br/>
        🎬 No endless scrolling. See the headlines for the day, dive into what interests you, and you are done
      </p>
    </div>

    <!-- Features -->
    <div style="padding:40px 32px;">
      <p style="font-size:12px;color:#fff1cd;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 20px 0;font-family:'Anton',sans-serif;">WHAT IS WAITING FOR YOU</p>

      <div style="background:rgba(255,241,205,0.08);border:1px solid rgba(255,241,205,0.15);border-radius:8px;padding:16px;margin-bottom:12px;">
        <p style="font-size:13px;color:#fff1cd;margin:0 0 8px 0;font-family:'Anton',sans-serif;">📰 A CURATED FEED</p>
        <p style="font-size:13px;color:rgba(255,241,205,0.80);margin:0;line-height:1.6;">A tight selection of stories that matter. No clutter. No filler.</p>
      </div>

      <div style="background:rgba(255,241,205,0.08);border:1px solid rgba(255,241,205,0.15);border-radius:8px;padding:16px;margin-bottom:12px;">
        <p style="font-size:13px;color:#fff1cd;margin:0 0 8px 0;font-family:'Anton',sans-serif;">💬 JOIN THE CONVERSATION</p>
        <p style="font-size:13px;color:rgba(255,241,205,0.80);margin:0;line-height:1.6;">React, comment, and see what others are saying.</p>
      </div>

      <div style="background:rgba(255,241,205,0.08);border:1px solid rgba(255,241,205,0.15);border-radius:8px;padding:16px;margin-bottom:12px;">
        <p style="font-size:13px;color:#fff1cd;margin:0 0 8px 0;font-family:'Anton',sans-serif;">📚 SAVE WHAT STICKS</p>
        <p style="font-size:13px;color:rgba(255,241,205,0.80);margin:0;line-height:1.6;">Bookmark anything worth coming back to.</p>
      </div>
    </div>

    <!-- Closing -->
    <div style="padding:40px 32px;text-align:center;border-top:1px solid rgba(255,241,205,0.10);">
      <p style="font-size:15px;color:rgba(255,241,205,0.90);margin:0 0 12px 0;font-family:'Lora',serif;">That is it.</p>
      <p style="font-size:15px;color:rgba(255,241,205,0.90);margin:0 0 12px 0;font-family:'Lora',serif;">Simple. Sharp. Worth your time.</p>
      <p style="font-size:20px;color:#fff1cd;margin:16px 0 0 0;font-family:'Anton',sans-serif;">Welcome to Popcorn.</p>
    </div>

    <!-- CTA -->
    <div style="padding:32px;text-align:center;">
      <a href="https://popcornmedia.org" style="background:#fff1cd;color:#053980;padding:16px 48px;border-radius:12px;font-size:13px;font-weight:bold;text-decoration:none;display:inline-block;letter-spacing:0.08em;font-family:'Anton',sans-serif;text-transform:uppercase;">START READING</a>
    </div>

    <!-- Footer -->
    <div style="padding:28px 32px;text-align:center;border-top:1px solid rgba(255,241,205,0.10);">
      <p style="font-size:13px;color:rgba(255,241,205,0.70);margin:0 0 8px 0;line-height:1.6;">Questions or feedback? Reach out at <span style="color:#fff1cd;font-weight:bold;">hello@popcornmedia.org</span></p>
      <p style="font-size:11px;color:rgba(255,241,205,0.50);margin:0;line-height:1.6;">© 2026 Popcorn Media. All rights reserved.</p>
    </div>

  </div>
</body>
</html>`;

console.log(`\n🍿 Sending test emails to ${TO}...\n`);

// Send Verification Email
try {
  const verify = await resend.emails.send({
    from: FROM,
    to: TO,
    subject: "Verify your Popcorn account",
    html: verifyHtml,
  });
  if (verify.error) {
    console.error("❌ Verification email failed:", verify.error);
  } else {
    console.log("✅ Verification email sent!", verify.data);
  }
} catch (e) {
  console.error("❌ Verification email error:", e.message);
}

// Send Welcome Email
try {
  const welcome = await resend.emails.send({
    from: FROM,
    to: TO,
    subject: "Welcome to Popcorn — Culture News Curated for You",
    html: welcomeHtml,
  });
  if (welcome.error) {
    console.error("❌ Welcome email failed:", welcome.error);
  } else {
    console.log("✅ Welcome email sent!", welcome.data);
  }
} catch (e) {
  console.error("❌ Welcome email error:", e.message);
}

console.log("\n📬 Check your inbox (and spam folder) for the test emails!");
console.log("📊 You can also see delivery status at: https://resend.com/emails\n");
