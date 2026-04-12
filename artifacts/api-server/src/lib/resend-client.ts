import { Resend } from "resend";
import { VerifyEmail } from "../emails/VerifyEmail";
import { WelcomeEmail } from "../emails/WelcomeEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "noreply@popcornmedia.org";

export async function sendVerificationEmail(
  email: string,
  name: string,
  confirmLink: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Verify your Popcorn account",
      react: VerifyEmail({ name, confirmLink }),
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
  appLink?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to Popcorn — Culture News Curated for You",
      react: WelcomeEmail({ name, appLink }),
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
