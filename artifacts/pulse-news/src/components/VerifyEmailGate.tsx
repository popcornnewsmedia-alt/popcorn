import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { GrainBackground } from "@/components/GrainBackground";
import { supabase, purgeNativeAuthStorage } from "@/lib/supabase";

interface VerifyEmailGateProps {
  /** The unverified account's email, shown in the copy. */
  email: string;
}

/**
 * Blocking full-screen wall shown when a user is signed in but their email is
 * NOT yet verified. Supabase hands out a session on sign-up before the email is
 * confirmed, so without this wall a brand-new account could browse the whole
 * feed without ever verifying — defeating the point of verification. App.tsx
 * renders this above the feed (z-[480]) whenever `user && !email_confirmed_at`,
 * on both web and the iOS WebView.
 *
 * The verification link itself opens in the user's mail app / external browser
 * (especially on iOS, where it lands in Safari, not the app WebView), so we
 * can't auto-detect the click. Instead we give the user an explicit
 * "I've verified" action that force-refreshes the session from the server
 * (picking up email_confirmed_at) and reloads into the now-unlocked feed.
 */
export function VerifyEmailGate({ email }: VerifyEmailGateProps) {
  const [busy, setBusy] = useState<"check" | "resend" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const handleCheck = async () => {
    setBusy("check");
    setMsg(null);
    try {
      // refreshSession swaps the stale token for a fresh one off the server,
      // which reflects email_confirmed_at if the user has since clicked the
      // link (works even on iOS, where verification happened in Safari and
      // localStorage isn't shared with the WebView).
      const { data, error } = await supabase.auth.refreshSession();
      const u = data?.user;
      const confirmed = !!(u && (u.email_confirmed_at || u.confirmed_at));
      if (!error && confirmed) {
        // Reload into a clean state — App re-reads the session, sees it
        // confirmed, drops this wall, and any stale sign-up sheet resets.
        window.location.reload();
        return;
      }
      setBusy(null);
      setMsg({
        tone: "err",
        text: "We can't see a verification yet. Click the link in your email, then tap this again.",
      });
    } catch {
      setBusy(null);
      setMsg({ tone: "err", text: "Something went wrong — please try again." });
    }
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
        <button
          onClick={handleCheck}
          disabled={busy !== null}
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
          {busy === "check" ? "CHECKING…" : "I'VE VERIFIED — CONTINUE"}
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
