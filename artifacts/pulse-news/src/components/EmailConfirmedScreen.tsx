import { useState, useEffect } from "react";
import { Check, ArrowRight } from "lucide-react";
import { GrainBackground } from "@/components/GrainBackground";

interface EmailConfirmedScreenProps {
  onContinue: () => void;
}

export function EmailConfirmedScreen({ onContinue }: EmailConfirmedScreenProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entry animations on next frame
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleContinue = () => {
    setVisible(false);
    setTimeout(onContinue, 420);
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col"
      style={{
        background: "#053980",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      <GrainBackground />

      {/* Content — vertically centred */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-7 px-8 text-center">
        {/* Animated check circle */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{
            background: "#fff1cd",
            animation: visible
              ? "check-pop 0.6s cubic-bezier(0.22,1,0.36,1) 0.2s both"
              : "none",
          }}
        >
          <Check
            className="w-11 h-11"
            style={{ color: "#053980" }}
            strokeWidth={2.5}
          />
        </div>

        {/* Copy */}
        <div
          style={{
            animation: visible
              ? "tagline-reveal 0.5s ease 0.5s both"
              : "none",
          }}
        >
          <h1
            style={{
              fontFamily: "'Macabro', 'Anton', sans-serif",
              fontSize: "36px",
              color: "#fff1cd",
              lineHeight: 1.05,
              letterSpacing: "0.02em",
              marginBottom: "12px",
            }}
          >
            YOU'RE ALL
            <br />
            SIGNED UP.
          </h1>
          <p
            className="font-['Inter']"
            style={{
              fontSize: "15px",
              color: "rgba(255,241,205,0.50)",
              lineHeight: 1.5,
            }}
          >
            Your account is confirmed.
            <br />
            Your feed awaits.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div
        className="relative z-10 px-6 pb-12"
        style={{
          animation: visible ? "tagline-reveal 0.5s ease 0.7s both" : "none",
        }}
      >
        <button
          onClick={handleContinue}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl transition-all duration-150 active:scale-[0.98]"
          style={{
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontSize: "14px",
            letterSpacing: "0.08em",
            background: "#fff1cd",
            color: "#053980",
          }}
        >
          START READING
          <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
