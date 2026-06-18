import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { GrainBackground } from "@/components/GrainBackground";

interface DesktopAuthFooterProps {
  onSignInWithEmail: () => void;
  onCreateAccount: () => void;
}

const BLUE = "#042c85";
const CREAM = "#fff1cd";

/* ─────────────────────────────────────────────────────────────────────
   DesktopAuthFooter — the persistent NYT-style membership bar.

   Sits pinned to the bottom of the viewport for signed-out readers who
   dismissed the gate. It never goes away on its own — it's the standing
   reminder that the full edition is one sign-in away, mirroring the
   sticky subscribe bars on NYT / The Atlantic / The Cut.

   Signature blue, cream type, the same grain as the gate and sign-in
   sheet so it reads as one continuous system.
   ─────────────────────────────────────────────────────────────────── */
export function DesktopAuthFooter({
  onSignInWithEmail,
  onCreateAccount,
}: DesktopAuthFooterProps) {
  const { signInWithGoogle } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Slide up after first frame.
  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[110]"
      style={{
        transform: mounted ? "translateY(0)" : "translateY(100%)",
        transition: "transform 560ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {/* The wall — tall solid panel that blocks the lower half of the page */}
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{
          background: BLUE,
          color: CREAM,
          isolation: "isolate",
          minHeight: "50vh",
          borderTop: "1px solid rgba(255,241,205,0.16)",
          boxShadow: "0 -18px 50px rgba(4,12,40,0.35)",
        }}
      >
        {/* Same grain as the gate / sign-in sheet */}
        <GrainBackground />

        <div
          className="relative mx-auto text-center px-8 pb-14 pt-12"
          style={{ zIndex: 2, maxWidth: 560 }}
        >
          <h2
            className="leading-[0.92]"
            style={{
              fontFamily: "'Macabro', serif",
              fontSize: "58px",
              color: CREAM,
              letterSpacing: "-0.01em",
            }}
          >
            POPCORN
          </h2>
          <p
            className="mx-auto mt-4"
            style={{
              fontFamily: "'Newsreader', serif",
              fontStyle: "italic",
              fontSize: "19px",
              lineHeight: 1.5,
              color: CREAM,
              opacity: 0.88,
              maxWidth: "34ch",
            }}
          >
            Sign in to continue reading — it's free, and you keep your place.
          </p>

          <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
            <button
              onClick={signInWithGoogle}
              className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-full transition-all hover:scale-[1.02] active:scale-[0.99]"
              style={{
                background: CREAM,
                color: BLUE,
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 700,
                fontSize: "14px",
                letterSpacing: "0.03em",
              }}
            >
              <GoogleGlyph fill={BLUE} />
              Continue with Google
            </button>
            <button
              onClick={onSignInWithEmail}
              className="px-6 py-3 rounded-full transition-all hover:scale-[1.02] active:scale-[0.99] whitespace-nowrap"
              style={{
                background: "transparent",
                color: CREAM,
                border: `1.5px solid ${CREAM}`,
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 700,
                fontSize: "14px",
                letterSpacing: "0.03em",
              }}
            >
              Sign in with email
            </button>
          </div>

          <p
            className="mt-6"
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
        </div>
      </div>
    </div>
  );
}

function GoogleGlyph({ fill = "#042c85" }: { fill?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
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
