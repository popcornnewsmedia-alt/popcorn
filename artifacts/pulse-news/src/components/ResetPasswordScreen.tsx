import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Lock, ArrowRight, Check } from "lucide-react";
import { GrainBackground } from "@/components/GrainBackground";
import { supabase } from "@/lib/supabase";

type Phase = "loading" | "ready" | "invalid" | "done";

/**
 * Landing page for the password-reset email link (/reset-password).
 *
 * Supabase's recovery link redirects here with the recovery token in the URL;
 * the client (detectSessionInUrl) parses it and establishes a temporary
 * recovery session, firing PASSWORD_RECOVERY. We wait for that session, let the
 * user set a new password twice, call updateUser({ password }), and — since the
 * recovery session becomes a full session — drop them straight into the feed,
 * signed in.
 *
 * If the page is opened without a valid recovery token (direct nav, expired or
 * already-used link), we show an "invalid link" state instead of the form.
 */
export function ResetPasswordScreen() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Wait for the recovery session that the link establishes. The hash is parsed
  // asynchronously, so we both check the current session and listen for the
  // PASSWORD_RECOVERY / SIGNED_IN event, with a timeout fallback to the
  // "invalid link" state.
  useEffect(() => {
    let settled = false;
    const markReady = () => { if (!settled) { settled = true; setPhase("ready"); } };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        markReady();
      }
    });
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; setPhase("invalid"); }
    }, 5000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const canSubmit = password.length >= 8 && confirm.length >= 8 && !submitting;

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setSubmitting(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        // Supabase rejects reusing the current password with this message.
        const m = (updErr.message || "").toLowerCase();
        setError(
          m.includes("different from the old") || m.includes("same")
            ? "That's the same as your current password. Enter a new one to continue, or try logging in with your old password."
            : updErr.message || "Couldn't update your password — please try again.",
        );
        setSubmitting(false);
        return;
      }
      // Recovery session is now a full session → the user is signed in.
      setPhase("done");
      setTimeout(() => setLocation("/"), 1400);
    } catch {
      setError("Something went wrong — please try again.");
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: "rgba(255,241,205,0.07)",
    fontSize: "15px",
    color: "#fff1cd",
    border: "1px solid rgba(255,241,205,0.13)",
  } as const;
  const labelStyle = {
    fontFamily: "'Macabro', 'Anton', sans-serif",
    fontSize: "9px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#fff1cd",
  } as const;

  return (
    <div className="fixed inset-0 z-[400] flex flex-col" style={{ background: "#042c85" }}>
      <GrainBackground />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-7">
        {phase === "loading" && (
          <p className="font-['Inter']" style={{ fontSize: "14px", color: "rgba(255,241,205,0.55)" }}>
            Checking your link…
          </p>
        )}

        {phase === "invalid" && (
          <div className="text-center" style={{ maxWidth: "360px" }}>
            <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "clamp(22px,5vw,28px)", color: "#fff1cd", lineHeight: 1.05, letterSpacing: "0.02em", marginBottom: "12px" }}>
              LINK EXPIRED.
            </h1>
            <p className="font-['Inter']" style={{ fontSize: "15px", color: "rgba(255,241,205,0.55)", lineHeight: 1.6 }}>
              This reset link is invalid or has already been used. Head back and request a fresh one.
            </p>
            <button
              onClick={() => setLocation("/")}
              className="mt-7 px-8 py-3.5 rounded-2xl transition-all duration-150 active:scale-[0.98]"
              style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "13px", letterSpacing: "0.08em", background: "#fff1cd", color: "#042c85" }}
            >
              BACK TO POPCORN
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="text-center flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#fff1cd" }}>
              <Check className="w-7 h-7" style={{ color: "#042c85" }} strokeWidth={2.5} />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "clamp(22px,5vw,28px)", color: "#fff1cd", lineHeight: 1.05, letterSpacing: "0.02em", marginBottom: "10px" }}>
                PASSWORD UPDATED.
              </h1>
              <p className="font-['Inter']" style={{ fontSize: "15px", color: "rgba(255,241,205,0.55)" }}>
                Signing you in…
              </p>
            </div>
          </div>
        )}

        {phase === "ready" && (
          <div className="w-full" style={{ maxWidth: "380px" }}>
            <div className="flex flex-col items-center text-center mb-7">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(255,241,205,0.10)", border: "1px solid rgba(255,241,205,0.18)" }}>
                <Lock className="w-6 h-6" style={{ color: "#fff1cd" }} strokeWidth={1.5} />
              </div>
              <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "clamp(22px,5vw,28px)", color: "#fff1cd", lineHeight: 1.05, letterSpacing: "0.02em" }}>
                SET A NEW PASSWORD.
              </h1>
            </div>

            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label style={labelStyle}>New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl px-4 py-3.5 outline-none font-['Inter'] placeholder-[rgba(255,241,205,0.22)]"
                  style={inputStyle}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label style={labelStyle}>Confirm new password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                  onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) handleSubmit(); }}
                  className="w-full rounded-xl px-4 py-3.5 outline-none font-['Inter'] placeholder-[rgba(255,241,205,0.22)]"
                  style={inputStyle}
                />
              </div>

              {error && (
                <p className="font-['Inter']" style={{ fontSize: "13px", color: "#ff8a80" }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="mt-1 w-full flex items-center justify-center gap-2 py-4 rounded-2xl transition-all duration-150 active:scale-[0.98]"
                style={{
                  fontFamily: "'Macabro', 'Anton', sans-serif",
                  fontSize: "14px",
                  letterSpacing: "0.08em",
                  background: canSubmit ? "#fff1cd" : "rgba(255,241,205,0.12)",
                  color: canSubmit ? "#042c85" : "rgba(255,241,205,0.28)",
                }}
              >
                {submitting ? "UPDATING…" : "UPDATE PASSWORD"}
                {!submitting && <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
