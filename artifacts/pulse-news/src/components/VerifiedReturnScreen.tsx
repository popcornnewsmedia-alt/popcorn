import { useState, useEffect } from "react";
import { Check, ArrowRight } from "lucide-react";
import { GrainBackground } from "@/components/GrainBackground";

interface VerifiedReturnScreenProps {
  /** Dismiss and stay on the web (lands on the normal signed-out home). */
  onContinueWeb: () => void;
}

// Tapping this in Safari hands control to the installed app via the custom URL
// scheme registered in Info.plist (the same doorway the Google sign-in uses).
const APP_SCHEME = "org.popcornmedia.app://";

/**
 * Web-only landing shown when an email-verification link is opened in a browser
 * that CAN'T complete the sign-in — i.e. the user created their account in the
 * native app, then tapped the link here in Safari. The browser only confirmed
 * the email (it doesn't hold the key to log in), so instead of dropping them on
 * a confusing half-signed-in public feed we tell them plainly: you're verified,
 * head back to the app. A genuine web sign-up never sees this (it logs in right
 * here), and they can still choose to continue on the web.
 */
export function VerifiedReturnScreen({ onContinueWeb }: VerifiedReturnScreenProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className="fixed inset-0 z-[520] flex flex-col"
      style={{ background: "#042c85", opacity: visible ? 1 : 0, transition: "opacity 0.4s ease" }}
    >
      <GrainBackground />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-7 px-8 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: "#fff1cd",
            animation: visible ? "check-pop 0.6s cubic-bezier(0.22,1,0.36,1) 0.2s both" : "none",
          }}
        >
          <Check className="w-7 h-7" style={{ color: "#042c85" }} strokeWidth={2.5} />
        </div>

        <div style={{ animation: visible ? "tagline-reveal 0.5s ease 0.5s both" : "none" }}>
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
            YOU'RE
            <br />
            VERIFIED.
          </h1>
          <p
            className="font-['Inter']"
            style={{ fontSize: "15px", color: "rgba(255,241,205,0.55)", lineHeight: 1.6, maxWidth: "320px" }}
          >
            Your email's confirmed. Head back to the Popcorn app to start reading.
          </p>
        </div>
      </div>

      <div
        className="relative z-10 flex flex-col items-center gap-3 px-6 pb-12"
        style={{ animation: visible ? "tagline-reveal 0.5s ease 0.7s both" : "none" }}
      >
        <a
          href={APP_SCHEME}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl active:scale-[0.98] transition-transform"
          style={{
            maxWidth: "360px",
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontSize: "14px",
            letterSpacing: "0.08em",
            background: "#fff1cd",
            color: "#042c85",
            textDecoration: "none",
          }}
        >
          OPEN THE POPCORN APP
          <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
        </a>

        <button
          onClick={onContinueWeb}
          className="mt-1 transition-opacity hover:opacity-80"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "12.5px",
            color: "rgba(255,241,205,0.50)",
            background: "transparent",
          }}
        >
          Continue on the web instead
        </button>
      </div>
    </div>
  );
}
