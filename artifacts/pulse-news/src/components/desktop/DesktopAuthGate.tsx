import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { GrainBackground } from "@/components/GrainBackground";

interface DesktopAuthGateProps {
  onSignInWithEmail: () => void;
  onCreateAccount: () => void;
  onDismiss: () => void;
}

const BLUE = "#042c85";
const CREAM = "#fff1cd";

/* ─────────────────────────────────────────────────────────────────────
   DesktopAuthGate — the membership invitation (NYT-style).

   Pops up after a preview window. Dismissible: a close button, an
   Escape key, and a quiet "Keep browsing" link all let the reader past.
   Once dismissed, DesktopHome keeps a persistent footer banner up and
   article bodies stay blocked until the reader signs in.

   Styling mirrors the Popcorn system — signature blue, cream, grain,
   Macabro wordmark, Newsreader italic — reading as an invitation.
   ─────────────────────────────────────────────────────────────────── */
export function DesktopAuthGate({
  onSignInWithEmail,
  onCreateAccount,
  onDismiss,
}: DesktopAuthGateProps) {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Staggered reveal — flip after first frame so the CSS transitions run.
  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // Escape dismisses the gate (the persistent footer remains).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const handleGoogle = async () => {
    try {
      setError(null);
      await signInWithGoogle();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't sign in just now. Try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-6"
      onClick={onDismiss}
      style={{
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        opacity: mounted ? 1 : 0,
        transition: "opacity 520ms ease-out",
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[460px] overflow-hidden"
        style={{
          background: BLUE,
          color: CREAM,
          isolation: "isolate",
          borderRadius: "20px",
          boxShadow:
            "0 30px 80px rgba(4,12,40,0.45), 0 2px 0 rgba(255,255,255,0.06) inset",
          transform: mounted
            ? "translateY(0) scale(1)"
            : "translateY(16px) scale(0.975)",
          opacity: mounted ? 1 : 0,
          transition:
            "transform 560ms cubic-bezier(0.22,1,0.36,1), opacity 420ms ease-out",
        }}
      >
        {/* Grain texture — matches the sign-in screen exactly (default variant, rendered plainly) */}
        {mounted && <GrainBackground />}

        {/* Close — dismisses to the persistent footer */}
        <button
          onClick={onDismiss}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[rgba(255,241,205,0.18)] transition-colors"
          style={{ color: CREAM, zIndex: 3, opacity: 0.85 }}
        >
          <X size={18} strokeWidth={1.8} />
        </button>

        {/* ── Header — wordmark ──────────────────────────────────────── */}
        <div className="relative px-12 pt-14 pb-2" style={{ zIndex: 2 }}>
          <h2
            className="text-center leading-[0.92]"
            style={{
              fontFamily: "'Macabro', serif",
              fontSize: "52px",
              color: CREAM,
              letterSpacing: "-0.01em",
            }}
          >
            POPCORN
          </h2>
          <p
            className="text-center mt-4 mx-auto"
            style={{
              fontFamily: "'Newsreader', serif",
              fontStyle: "italic",
              fontSize: "16.5px",
              lineHeight: 1.5,
              color: CREAM,
              opacity: 0.84,
              maxWidth: "30ch",
            }}
          >
            Sign in to continue reading — save stories, follow the feed, and pick
            up right where you left off.
          </p>
        </div>

        {/* ── Body — the only ways through ───────────────────────────── */}
        <div className="relative px-12 pt-8 pb-12" style={{ zIndex: 2 }}>
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-full transition-all hover:scale-[1.015] active:scale-[0.99]"
            style={{
              background: "rgba(255,241,205,0.07)",
              color: CREAM,
              border: "1px solid rgba(255,241,205,0.22)",
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 700,
              fontSize: "14px",
              letterSpacing: "0.04em",
            }}
          >
            <GoogleGlyph />
            Continue with Google
          </button>

          <div className="flex items-center gap-4 my-6">
            <div
              className="flex-1 h-px"
              style={{ background: "rgba(255,241,205,0.22)" }}
            />
            <span
              className="text-[10px] uppercase"
              style={{
                fontFamily: "'Manrope', sans-serif",
                letterSpacing: "0.32em",
                color: CREAM,
                opacity: 0.6,
                fontWeight: 600,
              }}
            >
              or
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: "rgba(255,241,205,0.22)" }}
            />
          </div>

          <button
            onClick={onSignInWithEmail}
            className="w-full py-3.5 rounded-full transition-all hover:scale-[1.015] active:scale-[0.99]"
            style={{
              background: CREAM,
              color: BLUE,
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 700,
              fontSize: "14px",
              letterSpacing: "0.04em",
            }}
          >
            Sign in with email
          </button>

          <p
            className="text-center mt-7"
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: "13px",
              color: CREAM,
              opacity: 0.8,
            }}
          >
            New here?{" "}
            <button
              onClick={onCreateAccount}
              className="underline decoration-1 underline-offset-[3px] hover:opacity-70"
              style={{ color: CREAM, fontWeight: 600 }}
            >
              Create an account
            </button>
          </p>

          {error && (
            <div
              className="mt-5 text-center text-sm"
              style={{ fontFamily: "'Newsreader', serif", color: "#ffd2cb" }}
            >
              {error}
            </div>
          )}

          <button
            onClick={onDismiss}
            className="block mx-auto mt-6 text-[11px] uppercase hover:opacity-80 transition-opacity"
            style={{
              fontFamily: "'Manrope', sans-serif",
              letterSpacing: "0.3em",
              color: CREAM,
              opacity: 0.55,
              fontWeight: 600,
            }}
          >
            Keep browsing →
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
