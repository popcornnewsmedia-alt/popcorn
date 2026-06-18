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
              onClick={onSignInWithEmail}
              className="px-6 py-3 rounded-full transition-all hover:scale-[1.02] active:scale-[0.99] whitespace-nowrap"
              style={{
                background: CREAM,
                color: BLUE,
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 700,
                fontSize: "14px",
                letterSpacing: "0.03em",
              }}
            >
              Sign in with email
            </button>
            <button
              onClick={signInWithGoogle}
              className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-full transition-all hover:scale-[1.02] active:scale-[0.99]"
              style={{
                background: "rgba(255,241,205,0.07)",
                color: CREAM,
                border: "1px solid rgba(255,241,205,0.22)",
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 700,
                fontSize: "14px",
                letterSpacing: "0.03em",
              }}
            >
              <GoogleGlyph />
              Continue with Google
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

function GoogleGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
