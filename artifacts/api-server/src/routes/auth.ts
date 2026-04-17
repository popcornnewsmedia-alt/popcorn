import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase-client";
import { sendVerificationEmail, sendWelcomeEmail } from "../lib/resend-client";

const router = Router();

interface SignUpRequest {
  email: string;
  password: string;
  name: string;
}

interface ConfirmEmailRequest {
  token: string;
}

/**
 * POST /api/auth/signup
 * Create a new user account and send verification email
 */
router.post("/signup", async (req: Request<{}, {}, SignUpRequest>, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        error: "Missing required fields: email, password, name",
      });
    }

    // Create user in Supabase Auth
    const { data, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // User must verify their email
      user_metadata: {
        name,
      },
    });

    if (signUpError || !data.user) {
      console.error("Supabase signup error:", signUpError);
      return res.status(400).json({
        error: signUpError?.message || "Failed to create user",
      });
    }

    // Generate email confirmation link
    const { data: confirmData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "email_verification",
        email: email,
        options: {
          redirectTo: `${process.env.APP_URL || "https://popcornmedia.org"}/auth/callback`,
        },
      });

    if (linkError || !confirmData?.properties?.verification_link) {
      console.error("Failed to generate email link:", linkError);
      return res.status(500).json({
        error: "Failed to generate verification link",
      });
    }

    // Send verification email via Resend
    const emailResult = await sendVerificationEmail(
      email,
      name,
      confirmData.properties.verification_link
    );

    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
      // Email failed but user was created - don't fail the whole request
      // User can request email resend later
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
});

/**
 * POST /api/auth/send-welcome
 * Send welcome email to a verified user (called after email confirmation)
 */
router.post(
  "/send-welcome",
  async (req: Request<{}, {}, { userId: string; email: string; name: string }>, res: Response) => {
    try {
      const { userId, email, name } = req.body;

      if (!userId || !email || !name) {
        return res.status(400).json({
          error: "Missing required fields: userId, email, name",
        });
      }

      const appUrl = process.env.APP_URL || "https://popcornmedia.org";

      // Send welcome email via Resend
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
);

/**
 * POST /api/auth/resend-verification
 * Resend verification email to user
 */
router.post(
  "/resend-verification",
  async (req: Request<{}, {}, { email: string; name: string }>, res: Response) => {
    try {
      const { email, name } = req.body;

      if (!email || !name) {
        return res.status(400).json({
          error: "Missing required fields: email, name",
        });
      }

      // Generate new verification link
      const { data, error: linkError } = await supabase.auth.admin.generateLink({
        type: "email_verification",
        email: email,
        options: {
          redirectTo: `${process.env.APP_URL || "https://popcornmedia.org"}/auth/callback`,
        },
      });

      if (linkError || !data?.properties?.verification_link) {
        console.error("Failed to generate email link:", linkError);
        return res.status(500).json({
          error: "Failed to generate verification link",
        });
      }

      // Send verification email
      const emailResult = await sendVerificationEmail(
        email,
        name,
        data.properties.verification_link
      );

      if (!emailResult.success) {
        return res.status(500).json({
          error: "Failed to send verification email",
          details: emailResult.error,
        });
      }

      return res.status(200).json({
        message: "Verification email resent",
        email,
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
);

/**
 * POST /api/auth/username-available
 * Dev-server mirror of the Vercel serverless endpoint at
 * `api/auth/username-available.ts`. Returns `{ available: boolean, reason? }`.
 * Reserved list + regex live in SQL (via the `username_available` RPC); we
 * fall back to a direct `profiles` lookup if the RPC is not deployed yet.
 */
router.post(
  "/username-available",
  async (req: Request<{}, {}, { username: string }>, res: Response) => {
    try {
      const raw = (req.body?.username ?? "").toString();
      const candidate = raw.trim().toLowerCase();
      if (!candidate) return res.status(400).json({ error: "Missing username" });

      const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
      const RESERVED = new Set([
        "admin", "popcorn", "root", "api", "support", "system", "null", "undefined",
        "moderator", "staff", "help", "about", "terms", "privacy", "login", "signup",
      ]);

      if (!USERNAME_REGEX.test(candidate)) {
        return res.json({ available: false, reason: "format" });
      }
      if (RESERVED.has(candidate)) {
        return res.json({ available: false, reason: "reserved" });
      }

      const { data, error } = await supabase.rpc("username_available", { candidate });
      if (error) {
        const { data: rows, error: qerr } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("username", candidate)
          .limit(1);
        if (qerr) {
          console.error("username-available fallback error:", qerr);
          return res.status(500).json({ error: "Lookup failed" });
        }
        const taken = (rows ?? []).length > 0;
        return res.json({ available: !taken, ...(taken ? { reason: "taken" } : {}) });
      }

      const available = Boolean(data);
      return res.json({ available, ...(available ? {} : { reason: "taken" }) });
    } catch (error) {
      console.error("username-available error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /api/auth/resolve-identifier
 * Dev-server mirror of the Vercel serverless endpoint at
 * `api/auth/resolve-identifier.ts`. Accepts `{ identifier }` and returns
 * `{ email }` so the client can sign in with either email or username.
 */
router.post(
  "/resolve-identifier",
  async (req: Request<{}, {}, { identifier: string }>, res: Response) => {
    try {
      const raw = (req.body?.identifier ?? "").toString().trim();
      if (!raw) return res.status(400).json({ error: "Missing identifier" });

      if (raw.includes("@")) {
        return res.json({ email: raw });
      }

      const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
      const candidate = raw.toLowerCase();
      if (!USERNAME_REGEX.test(candidate)) {
        return res.json({ email: null, reason: "not_found" });
      }

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", candidate)
        .maybeSingle();

      if (profErr) {
        console.error("resolve-identifier profile error:", profErr);
        return res.status(500).json({ error: "Lookup failed" });
      }
      if (!profile?.user_id) {
        return res.json({ email: null, reason: "not_found" });
      }

      const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(profile.user_id);
      if (userErr || !userRes?.user?.email) {
        console.error("resolve-identifier user error:", userErr);
        return res.json({ email: null, reason: "not_found" });
      }

      return res.json({ email: userRes.user.email });
    } catch (error) {
      console.error("resolve-identifier error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /api/auth/user-exists
 * Check whether an email is registered (used to distinguish
 * "account not found" from "wrong password" on the client).
 */
router.post(
  "/user-exists",
  async (req: Request<{}, {}, { email: string }>, res: Response) => {
    try {
      const { email } = req.body;
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
);

export default router;
