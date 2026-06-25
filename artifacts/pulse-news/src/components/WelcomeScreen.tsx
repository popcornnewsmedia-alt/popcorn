import { useState, useEffect } from "react";
import { Check, ArrowRight } from "lucide-react";
import { GrainBackground } from "@/components/GrainBackground";

interface WelcomeScreenProps {
  /**
   * "checking" = instant full-screen cover shown the moment sign-in fires, while
   * we look up whether this account still needs a handle (hides the feed so it
   * never flashes). "welcome" = the brand-new-account greeting + claim CTA.
   */
  stage: "checking" | "welcome";
  /** First name / handle seed, used to personalise the greeting when available. */
  name?: string;
  onContinue: () => void;
}

/**
 * Post-authentication cover + interstitial for a brand-new account (the Google
 * first-sign-in path). The SAME instance stays mounted across "checking" →
 * "welcome", and its background is opaque from the first frame, so the feed is
 * never visible underneath: authenticate → (brief check) → welcome → claim
 * handle → feed. Dismisses to reveal the UsernameSheet.
 */
export function WelcomeScreen({ stage, name, onContinue }: WelcomeScreenProps) {
  const [contentVisible, setContentVisible] = useState(false);
  const first = (name ?? "").trim().split(/\s+/)[0];

  useEffect(() => {
    if (stage === "welcome") requestAnimationFrame(() => setContentVisible(true));
  }, [stage]);

  return (
    // Opaque from frame 1 (no opacity fade-in) so it hides the feed instantly.
    <div className="fixed inset-0 z-[500] flex flex-col" style={{ background: "#042c85" }}>
      <GrainBackground />

      {stage === "checking" ? (
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div
            className="w-9 h-9 rounded-full animate-spin"
            style={{ border: "2px solid rgba(255,241,205,0.22)", borderTopColor: "#fff1cd" }}
          />
        </div>
      ) : (
        <>
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-7 px-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: "#fff1cd",
                animation: contentVisible
                  ? "check-pop 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s both"
                  : "none",
              }}
            >
              <Check className="w-7 h-7" style={{ color: "#042c85" }} strokeWidth={2.5} />
            </div>

            <div style={{ animation: contentVisible ? "tagline-reveal 0.5s ease 0.35s both" : "none" }}>
              <h1
                style={{
                  fontFamily: "'Macabro', 'Anton', sans-serif",
                  fontSize: "clamp(22px, 5vw, 28px)",
                  color: "#fff1cd",
                  lineHeight: 1.05,
                  letterSpacing: "0.02em",
                  marginBottom: "12px",
                  whiteSpace: "pre-line",
                }}
              >
                {first ? `WELCOME,\n${first.toUpperCase()}.` : "YOU'RE IN."}
              </h1>
              <p
                className="font-['Inter']"
                style={{ fontSize: "15px", color: "rgba(255,241,205,0.50)", lineHeight: 1.5, maxWidth: "320px" }}
              >
                You're signed in to Popcorn.
                <br />
                One quick thing — claim your handle.
              </p>
            </div>
          </div>

          <div
            className="relative z-10 flex justify-center px-6 pb-12"
            style={{ animation: contentVisible ? "tagline-reveal 0.5s ease 0.55s both" : "none" }}
          >
            <button
              onClick={onContinue}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl transition-all duration-150 active:scale-[0.98]"
              style={{
                maxWidth: "360px",
                fontFamily: "'Macabro', 'Anton', sans-serif",
                fontSize: "14px",
                letterSpacing: "0.08em",
                background: "#fff1cd",
                color: "#042c85",
              }}
            >
              CLAIM MY HANDLE
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
