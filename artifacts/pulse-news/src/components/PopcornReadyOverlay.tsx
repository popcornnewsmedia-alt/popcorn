/**
 * PopcornReadyOverlay — celebratory popcorn-pop animation that plays for ~2.4s
 * whenever a daily feed is promoted to prod and the user lands in the app.
 *
 * Mount triggers:
 *   • CustomEvent("popcornFeedReady") — fired by push-registration.ts when a
 *     push arrives in the foreground.
 *   • sessionStorage flag set by push-registration.ts before navigation when
 *     the user taps the banner from the background — consumed on mount so a
 *     route change inside the app doesn't replay it.
 *
 * The SVG anatomy is the popcorn bucket + puffs + heat glow from SplashScreen,
 * with the spotlight cone and brand wordmark stripped.
 */
import { useEffect, useState } from "react";
import { consumeFeedReadyFlag, FEED_READY_EVENT } from "../lib/feed-ready-flag";

const VISIBLE_MS = 2400;   // when to start the fade
const FADE_MS    = 600;    // CSS transition length

export function PopcornReadyOverlay() {
  const [phase, setPhase] = useState<"hidden" | "visible" | "fading">("hidden");

  // Read the persisted flag once on mount (covers cold-start after banner tap).
  useEffect(() => {
    if (consumeFeedReadyFlag()) {
      setPhase("visible");
    }
  }, []);

  // Subscribe to foreground events while mounted.
  useEffect(() => {
    const onReady = () => {
      // Re-trigger from "fading" too in case a second push lands fast.
      setPhase("visible");
    };
    window.addEventListener(FEED_READY_EVENT, onReady);
    return () => window.removeEventListener(FEED_READY_EVENT, onReady);
  }, []);

  // Auto-dismiss timeline.
  useEffect(() => {
    if (phase !== "visible") return;
    const fadeTimer = window.setTimeout(() => setPhase("fading"), VISIBLE_MS);
    const hideTimer = window.setTimeout(() => setPhase("hidden"), VISIBLE_MS + FADE_MS);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [phase]);

  if (phase === "hidden") return null;

  const dismiss = () => {
    if (phase === "visible") setPhase("fading");
  };

  return (
    <div
      onClick={dismiss}
      role="presentation"
      style={{
        position:       "fixed",
        inset:          0,
        zIndex:         250,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            "14px",
        backgroundColor: "rgba(4,44,133, 0.92)",
        backdropFilter:  "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        opacity:    phase === "fading" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        paddingTop: "env(safe-area-inset-top)",
        pointerEvents: phase === "fading" ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes pcro-pop-explode {
          0%   { opacity: 0; transform: scale(0.05) translateY(38px); }
          8%   { opacity: 1; }
          16%  { transform: scale(1.28)    translateY(-7px); }
          25%  { transform: scale(0.9)     translateY(3px); }
          33%  { transform: scale(1.082)   translateY(-1.9px); }
          40%  { transform: scale(0.968)   translateY(0.85px); }
          47%  { transform: scale(1.020)   translateY(-0.5px); }
          53%  { transform: scale(0.988)   translateY(0.27px); }
          60%  { transform: scale(1.006)   translateY(-0.14px); }
          70%  { transform: scale(0.998)   translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pcro-pc-a {
          0%,100% { transform: translateY(0)    scaleY(1)    scaleX(1); }
          20%      { transform: translateY(2px)  scaleY(0.88) scaleX(1.1); }
          50%      { transform: translateY(-11px) scaleY(1.12) scaleX(0.91); }
          75%      { transform: translateY(-8px)  scaleY(1.06) scaleX(0.96); }
        }
        @keyframes pcro-pc-b {
          0%,100% { transform: translateY(0)    scaleY(1)    scaleX(1); }
          20%      { transform: translateY(2px)  scaleY(0.85) scaleX(1.12); }
          50%      { transform: translateY(-15px) scaleY(1.14) scaleX(0.89); }
          75%      { transform: translateY(-10px) scaleY(1.07) scaleX(0.95); }
        }
        @keyframes pcro-pc-c {
          0%,100% { transform: translateY(0)    scaleY(1)    scaleX(1); }
          20%      { transform: translateY(2px)  scaleY(0.9)  scaleX(1.08); }
          50%      { transform: translateY(-10px) scaleY(1.1)  scaleX(0.92); }
          75%      { transform: translateY(-7px)  scaleY(1.05) scaleX(0.97); }
        }
        @keyframes pcro-rumble {
          0%,100% { transform: none; }
          20%  { transform: translateX(-1.4px) rotate(-0.4deg); }
          50%  { transform: translateX(1.4px)  rotate(0.4deg); }
          80%  { transform: translateX(-0.7px); }
        }
        @keyframes pcro-heat {
          0%,100% { opacity: 0.11; }
          50%      { opacity: 0.26; }
        }
        @keyframes pcro-text-rise {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .pcro-stage {
          animation: pcro-pop-explode 1.6s cubic-bezier(0.22,1,0.36,1) both;
          transform-box: fill-box;
          transform-origin: center;
        }
        .pcro-bucket {
          animation: pcro-rumble 0.38s ease-in-out 2;
          transform-box: fill-box;
          transform-origin: center 50%;
        }
        .pcro-heat {
          animation: pcro-heat 1.0s ease-in-out 2;
        }
        .pcro-pca {
          animation: pcro-pc-a 1.35s cubic-bezier(0.34,1.5,0.64,1) 2;
          transform-box: fill-box;
          transform-origin: center 90%;
        }
        .pcro-pcb {
          animation: pcro-pc-b 1.35s cubic-bezier(0.34,1.5,0.64,1) 0.22s 2;
          transform-box: fill-box;
          transform-origin: center 90%;
        }
        .pcro-pcc {
          animation: pcro-pc-c 1.35s cubic-bezier(0.34,1.5,0.64,1) 0.44s 2;
          transform-box: fill-box;
          transform-origin: center 90%;
        }
        .pcro-text {
          animation: pcro-text-rise 0.7s cubic-bezier(0.22,1,0.36,1) 0.5s both;
        }
      `}</style>

      <div className="pcro-stage">
        <svg viewBox="0 0 100 100" width="180" height="180" aria-hidden="true" style={{ overflow: "visible" }}>
          {/* Heat glow */}
          <ellipse className="pcro-heat" cx="50" cy="61" rx="19" ry="10" fill="#fff1cd" />

          {/* Bucket */}
          <g className="pcro-bucket">
            <rect x="28" y="58" width="44" height="7" rx="2.5" fill="#fff1cd" />
            <path
              d="M30 65 L35 94 L65 94 L70 65Z"
              fill="transparent"
              stroke="#fff1cd"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </g>

          {/* Left puff */}
          <g className="pcro-pca">
            <circle cx="35" cy="50" r="6"   fill="#fff1cd" />
            <circle cx="29" cy="46" r="4.5" fill="#fff1cd" />
            <circle cx="35" cy="42" r="5"   fill="#fff1cd" />
            <circle cx="41" cy="46" r="4.5" fill="#fff1cd" />
          </g>

          {/* Centre puff */}
          <g className="pcro-pcb">
            <circle cx="50" cy="46" r="7" fill="#fff1cd" />
            <circle cx="43" cy="41" r="5" fill="#fff1cd" />
            <circle cx="50" cy="36" r="6" fill="#fff1cd" />
            <circle cx="57" cy="41" r="5" fill="#fff1cd" />
            <circle cx="44" cy="49" r="4" fill="#fff1cd" />
            <circle cx="56" cy="49" r="4" fill="#fff1cd" />
          </g>

          {/* Right puff */}
          <g className="pcro-pcc">
            <circle cx="65" cy="50" r="6"   fill="#fff1cd" />
            <circle cx="59" cy="46" r="4.5" fill="#fff1cd" />
            <circle cx="65" cy="42" r="5"   fill="#fff1cd" />
            <circle cx="71" cy="46" r="4.5" fill="#fff1cd" />
          </g>
        </svg>
      </div>

      <div
        className="pcro-text"
        style={{
          fontFamily:    "'Manrope', sans-serif",
          fontWeight:    600,
          fontSize:      "22px",
          color:         "#fff1cd",
          letterSpacing: "0.005em",
          textAlign:     "center",
        }}
      >
        Your Popcorn is ready
      </div>
    </div>
  );
}

export default PopcornReadyOverlay;
