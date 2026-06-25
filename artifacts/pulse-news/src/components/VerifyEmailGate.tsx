import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { GrainBackground } from "@/components/GrainBackground";
import { supabase, purgeNativeAuthStorage } from "@/lib/supabase";
import { getPendingCredential, clearPendingCredential } from "@/lib/pending-credential";

interface VerifyEmailGateProps {
  /** The unverified account's email, shown in the copy. */
  email: string;
}

/**
 * Blocking full-screen wall shown while a brand-new account's email is NOT yet
 * verified. App.tsx renders this above the feed (z-[480]) on both web and the
 * iOS WebView. Without it a new account could browse without ever verifying.
 *
 * Key constraint: an email/password sign-up gets NO Supabase session until the
 * email is confirmed, and the confirmation link opens in the user's mail app /
 * external browser (on iOS, Safari — NOT the app WebView), so the app can't
 * observe the click and has no token to refresh.
 *
 * So "I've verified — continue" does NOT rely on refreshSession. It SIGNS IN
 * with the account's email + password, which Supabase only accepts once the
 * email is confirmed. That pulls a fresh, verified session onto THIS device no
 * matter where the link was clicked (same phone, or a laptop) — fully
 * device-agnostic. The password comes from the in-memory stash set at sign-up;
 * if that's gone (app relaunched / different device), we ask for it inline.
 */
export function VerifyEmailGate({ email }: VerifyEmailGateProps) {
  const [busy, setBusy] = useState<"check" | "resend" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  // Inline password fallback — revealed when we have no cached password to
  // sign in with (app was relaunched, or the user signed up on another device).
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pw, setPw] = useState("");

  const finishVerified = () => {
    // Reload into a clean state — App re-reads the now-verified session, drops
    // this wall, and runs the welcome-email + username hooks.
    //
    // We deliberately DO NOT clear `popcorn_awaiting_confirm` here. On reload,
    // App's awaiting-confirm effect sees the flag + a now-confirmed session and
    // shows the "Welcome to Popcorn" EmailConfirmedScreen (then clears the flag
    // itself). Clearing it here skipped that screen and dropped the user
    // straight onto the feed with no welcome.
    clearPendingCredential();
    window.location.reload();
  };

  // Try to sign in with the given password. Returns a status so callers can
  // decide whether to fall back to the inline password field.
  const attemptSignIn = async (
    password: string,
  ): Promise<"ok" | "unverified" | "badpw" | "error"> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.session) {
      finishVerified();
      return "ok";
    }
    const m = (error?.message ?? "").toLowerCase();
    if (m.includes("not confirmed") || m.includes("not been confirmed")) {
      setMsg({
        tone: "err",
        text: "We can't see a verification yet. Click the link in your email, then tap this again.",
      });
      return "unverified";
    }
    if (m.includes("invalid login") || m.includes("invalid") || m.includes("credentials")) {
      setMsg({ tone: "err", text: "That password doesn't match. Please try again." });
      return "badpw";
    }
    setMsg({ tone: "err", text: "Something went wrong — please try again." });
    return "error";
  };

  const handleCheck = async () => {
    setBusy("check");
    setMsg(null);
    try {
      // 1. If a session already exists (web shares localStorage with the verify
      //    tab; or any config that issues a pre-verification session), just
      //    refresh it to pick up email_confirmed_at.
      const { data: cur } = await supabase.auth.getSession();
      if (cur?.session) {
        const { data, error } = await supabase.auth.refreshSession();
        const u = data?.user;
        if (!error && u && (u.email_confirmed_at || u.confirmed_at)) {
          finishVerified();
          return;
        }
      }

      // 2. No verified session on this device. Sign in with email + password to
      //    pull a fresh verified session over — works regardless of where the
      //    link was clicked. Use the cached password if we have it.
      const cached = getPendingCredential(email);
      if (cached) {
        const r = await attemptSignIn(cached);
        if (r === "ok") return;            // reloading
        if (r === "unverified") { setBusy(null); return; }  // not verified yet
        // Stale cached password (badpw/error) → fall through to manual entry.
      }

      // 3. No usable cached password — ask for it inline.
      setBusy(null);
      setNeedsPassword(true);
      if (!cached) setMsg(null);
    } catch {
      setBusy(null);
      setMsg({ tone: "err", text: "Something went wrong — please try again." });
    }
  };

  const handlePasswordContinue = async () => {
    if (!pw || busy) return;
    setBusy("check");
    setMsg(null);
    const r = await attemptSignIn(pw);
    if (r !== "ok") setBusy(null);
  };

  const handleResend = async () => {
    setBusy("resend");
    setMsg(null);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      setMsg(
        error
          ? { tone: "err", text: "Couldn't resend just now — try again in a moment." }
          : { tone: "ok", text: "Sent. Check your inbox (and your spam folder)." },
      );
    } catch {
      setMsg({ tone: "err", text: "Couldn't resend just now — try again in a moment." });
    } finally {
      setBusy(null);
    }
  };

  const handleUseDifferent = async () => {
    // Sign out locally + purge native storage, then reload to the signed-out
    // splash so the user can sign in / sign up with a different address.
    localStorage.removeItem("popcorn_awaiting_confirm");
    clearPendingCredential();
    await supabase.auth.signOut({ scope: "local" }).catch(() => { /* already gone */ });
    void purgeNativeAuthStorage();
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 z-[480] flex flex-col"
      style={{ background: "#042c85" }}
    >
      <GrainBackground />

      {/* Content — vertically centred */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-7 px-8 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,241,205,0.10)", border: "1px solid rgba(255,241,205,0.18)" }}
        >
          <Mail className="w-7 h-7" style={{ color: "#fff1cd" }} strokeWidth={1.5} />
        </div>

        <div>
          <h1
            style={{
              fontFamily: "'Macabro', 'Anton', sans-serif",
              fontSize: "clamp(22px, 5vw, 28px)",
              color: "#fff1cd",
              lineHeight: 1.05,
              letterSpacing: "0.02em",
              marginBottom: "12px",
            }}
          >
            VERIFY YOUR
            <br />
            EMAIL.
          </h1>
          <p
            className="font-['Inter']"
            style={{ fontSize: "15px", color: "rgba(255,241,205,0.55)", lineHeight: 1.6, maxWidth: "340px" }}
          >
            We sent a confirmation link to{" "}
            <span style={{ color: "#fff1cd", fontWeight: 600 }}>{email}</span>.
            Click it to unlock your feed.
          </p>

          {msg && (
            <p
              className="font-['Inter']"
              style={{
                marginTop: "16px",
                fontSize: "13px",
                lineHeight: 1.5,
                color: msg.tone === "ok" ? "#fff1cd" : "rgba(255,200,200,0.95)",
                maxWidth: "320px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {msg.text}
            </p>
          )}
        </div>
      </div>

      {/* CTAs */}
      <div className="relative z-10 flex flex-col items-center gap-3 px-6 pb-12">
        {/* Inline password fallback — only when we have no cached password to
            sign in with (app relaunched, or verified from a different device). */}
        {needsPassword && (
          <div className="w-full flex flex-col gap-2" style={{ maxWidth: "360px" }}>
            <p
              className="font-['Inter']"
              style={{ fontSize: "12.5px", color: "rgba(255,241,205,0.55)", lineHeight: 1.5, textAlign: "center" }}
            >
              Enter your password to finish signing in on this device.
            </p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handlePasswordContinue(); }}
              placeholder="Your password"
              autoFocus
              className="w-full rounded-2xl px-4 py-3.5 outline-none font-['Inter'] placeholder-[rgba(255,241,205,0.22)]"
              style={{
                background: "rgba(255,241,205,0.07)",
                fontSize: "15px",
                color: "#fff1cd",
                border: "1px solid rgba(255,241,205,0.13)",
              }}
            />
          </div>
        )}

        <button
          onClick={needsPassword ? handlePasswordContinue : handleCheck}
          disabled={busy !== null || (needsPassword && !pw)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
          style={{
            maxWidth: "360px",
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontSize: "14px",
            letterSpacing: "0.08em",
            background: "#fff1cd",
            color: "#042c85",
          }}
        >
          {busy === "check" ? "CHECKING…" : needsPassword ? "CONTINUE" : "I'VE VERIFIED — CONTINUE"}
          {busy !== "check" && <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
        </button>

        <button
          onClick={handleResend}
          disabled={busy !== null}
          className="w-full py-3 rounded-2xl transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
          style={{
            maxWidth: "360px",
            fontFamily: "'Inter', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.02em",
            background: "transparent",
            color: "#fff1cd",
            border: "1px solid rgba(255,241,205,0.30)",
          }}
        >
          {busy === "resend" ? "SENDING…" : "Resend the link"}
        </button>

        <button
          onClick={handleUseDifferent}
          disabled={busy !== null}
          className="mt-1 transition-opacity hover:opacity-100 disabled:opacity-40"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "12px",
            color: "rgba(255,241,205,0.45)",
            background: "transparent",
          }}
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}
