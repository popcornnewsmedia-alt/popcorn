import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface DesktopAuthModalProps {
  onClose: () => void;
  onSignInWithEmail: () => void;
  onCreateAccount: () => void;
}

const BLUE = "#042c85";
const CREAM = "#fff1cd";
const PAPER = "#fbf4dc";
const INK = "#0a2a5a";

/* ─────────────────────────────────────────────────────────────────────
   DesktopAuthModal — centred, slim, editorial.
   First-load popup for signed-out desktop visitors. Dismissible.
   Reuses useAuth().signInWithGoogle and delegates email auth to the
   existing SignInSheet / SignUpFlow sheets via the parent.
   ─────────────────────────────────────────────────────────────────── */
export function DesktopAuthModal({
  onClose,
  onSignInWithEmail,
  onCreateAccount,
}: DesktopAuthModalProps) {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // staggered reveal — set after first frame for the CSS transition
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      className="fixed inset-0 z-[100] flex items-center justify-center px-6"
      onClick={onClose}
      style={{
        background: "rgba(4,44,133,0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        opacity: mounted ? 1 : 0,
        transition: "opacity 320ms ease-out",
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] overflow-hidden"
        style={{
          background: PAPER,
          color: INK,
          borderRadius: "2px",
          boxShadow: "0 30px 80px -20px rgba(4,44,133,0.55), 0 0 0 1px rgba(4,44,133,0.12)",
          transform: mounted ? "translateY(0) scale(1)" : "translateY(12px) scale(0.985)",
          opacity: mounted ? 1 : 0,
          transition: "transform 420ms cubic-bezier(0.23,1,0.32,1), opacity 320ms ease-out",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[rgba(4,44,133,0.08)] transition-colors"
          style={{ color: BLUE }}
        >
          <X size={18} strokeWidth={1.8} />
        </button>

        {/* Top rule + eyebrow */}
        <div className="px-12 pt-12 pb-2">
          <div className="flex items-center gap-4 mb-10">
            <div className="flex-1 h-px" style={{ background: "rgba(4,44,133,0.25)" }} />
            <span
              className="text-[10px] uppercase whitespace-nowrap"
              style={{
                fontFamily: "'Macabro', serif",
                letterSpacing: "0.36em",
                color: BLUE,
                opacity: 0.85,
              }}
            >
              Welcome
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(4,44,133,0.25)" }} />
          </div>

          <h2
            className="text-center leading-[0.95]"
            style={{
              fontFamily: "'Macabro', serif",
              fontSize: "76px",
              color: BLUE,
              letterSpacing: "-0.01em",
            }}
          >
            POPCORN
          </h2>
          <p
            className="text-center mt-4"
            style={{
              fontFamily: "'Newsreader', serif",
              fontStyle: "italic",
              fontSize: "17px",
              lineHeight: 1.45,
              color: BLUE,
              opacity: 0.78,
            }}
          >
            Sign in to save stories, follow along, and never lose your place.
          </p>
        </div>

        {/* Body */}
        <div className="px-12 pt-8 pb-12">
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-full transition-all hover:scale-[1.015] active:scale-[0.99]"
            style={{
              background: BLUE,
              color: CREAM,
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
            <div className="flex-1 h-px" style={{ background: "rgba(4,44,133,0.18)" }} />
            <span
              className="text-[10px] uppercase"
              style={{
                fontFamily: "'Manrope', sans-serif",
                letterSpacing: "0.32em",
                color: BLUE,
                opacity: 0.55,
                fontWeight: 600,
              }}
            >
              or
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(4,44,133,0.18)" }} />
          </div>

          <button
            onClick={onSignInWithEmail}
            className="w-full py-3.5 rounded-full transition-all hover:scale-[1.015] active:scale-[0.99]"
            style={{
              background: "transparent",
              color: BLUE,
              border: `1.5px solid ${BLUE}`,
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
              color: BLUE,
              opacity: 0.75,
            }}
          >
            New here?{" "}
            <button
              onClick={onCreateAccount}
              className="underline decoration-1 underline-offset-[3px] hover:opacity-70"
              style={{ color: BLUE, fontWeight: 600 }}
            >
              Create an account
            </button>
          </p>

          <button
            onClick={onClose}
            className="block mx-auto mt-5 text-[11px] uppercase hover:opacity-70 transition-opacity"
            style={{
              fontFamily: "'Manrope', sans-serif",
              letterSpacing: "0.3em",
              color: BLUE,
              opacity: 0.55,
              fontWeight: 600,
            }}
          >
            Keep browsing →
          </button>

          {error && (
            <div
              className="mt-5 text-center text-sm"
              style={{
                fontFamily: "'Newsreader', serif",
                color: "#c0392b",
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#fff1cd"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.71-1.58 2.68-3.9 2.68-6.62z"
      />
      <path
        fill="#fff1cd"
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"
        opacity=".85"
      />
      <path
        fill="#fff1cd"
        d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"
        opacity=".7"
      />
      <path
        fill="#fff1cd"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
        opacity=".55"
      />
    </svg>
  );
}
