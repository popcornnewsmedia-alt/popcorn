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
              background: CREAM,
              color: BLUE,
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
              background: "transparent",
              color: CREAM,
              border: `1.5px solid ${CREAM}`,
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

function GoogleGlyph({ fill = "#042c85" }: { fill?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill={fill}
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.71-1.58 2.68-3.9 2.68-6.62z"
      />
      <path
        fill={fill}
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"
        opacity=".85"
      />
      <path
        fill={fill}
        d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"
        opacity=".7"
      />
      <path
        fill={fill}
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
        opacity=".55"
      />
    </svg>
  );
}
