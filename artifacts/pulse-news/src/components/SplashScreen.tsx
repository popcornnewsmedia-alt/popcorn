import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { GrainBackground } from "./GrainBackground";
import type { LegalKind } from "./LegalSheet";

interface SplashScreenProps {
  /** Fired when the splash has fully faded out and the app can take over. */
  onDone: () => void;
  /** Supabase auth loading state — splash waits for it to resolve before deciding its next phase. */
  authLoading: boolean;
  /** Supabase user — if truthy, splash auto-fades. If falsy, splash reveals CTAs and waits for sign-up/sign-in. */
  isAuthed: boolean;
  onCreateAccount: () => void;
  onSignIn: () => void;
  onOpenLegal: (kind: LegalKind) => void;
}

function PopcornAnim() {
  return (
    <svg viewBox="0 0 100 100" width="116" height="116" aria-hidden="true" style={{ overflow: 'visible' }}>
      <style>{`
        /* ── Squash-and-stretch puff bounce ── */
        @keyframes pc-a {
          0%,100% { transform: translateY(0) scaleY(1) scaleX(1); }
          20%      { transform: translateY(2px) scaleY(0.88) scaleX(1.1); }
          50%      { transform: translateY(-11px) scaleY(1.12) scaleX(0.91); }
          75%      { transform: translateY(-8px) scaleY(1.06) scaleX(0.96); }
        }
        @keyframes pc-b {
          0%,100% { transform: translateY(0) scaleY(1) scaleX(1); }
          20%      { transform: translateY(2px) scaleY(0.85) scaleX(1.12); }
          50%      { transform: translateY(-15px) scaleY(1.14) scaleX(0.89); }
          75%      { transform: translateY(-10px) scaleY(1.07) scaleX(0.95); }
        }
        @keyframes pc-c {
          0%,100% { transform: translateY(0) scaleY(1) scaleX(1); }
          20%      { transform: translateY(2px) scaleY(0.9) scaleX(1.08); }
          50%      { transform: translateY(-10px) scaleY(1.1) scaleX(0.92); }
          75%      { transform: translateY(-7px) scaleY(1.05) scaleX(0.97); }
        }
        .pca { animation: pc-a 1.35s cubic-bezier(0.34,1.5,0.64,1) infinite;          transform-box: fill-box; transform-origin: center 90%; }
        .pcb { animation: pc-b 1.35s cubic-bezier(0.34,1.5,0.64,1) infinite 0.22s;   transform-box: fill-box; transform-origin: center 90%; }
        .pcc { animation: pc-c 1.35s cubic-bezier(0.34,1.5,0.64,1) infinite 0.44s;   transform-box: fill-box; transform-origin: center 90%; }

        /* ── Bucket rumble ── */
        @keyframes rumble {
          0%,100% { transform: none; }
          20%  { transform: translateX(-1.4px) rotate(-0.4deg); }
          50%  { transform: translateX(1.4px)  rotate(0.4deg); }
          80%  { transform: translateX(-0.7px); }
        }
        .bucket-grp { animation: rumble 0.38s ease-in-out infinite; transform-box: fill-box; transform-origin: center 50%; }

        /* ── Heat glow ── */
        @keyframes heat {
          0%,100% { opacity: 0.11; }
          50%      { opacity: 0.26; }
        }
        .heat-glow { animation: heat 1.0s ease-in-out infinite; }

        /* ── Flying kernels — 6 unique arcing trajectories ── */
        @keyframes fly-1 {
          0%   { transform: translate(0,0)     rotate(0deg)    scale(0);    opacity:0; }
          7%   { transform: translate(-3px,-6px)  rotate(40deg)   scale(1.1);  opacity:1; }
          55%  { transform: translate(-25px,-37px) rotate(215deg)  scale(1);    opacity:1; }
          80%  { transform: translate(-28px,-24px) rotate(305deg)  scale(0.65); opacity:0.5; }
          100% { transform: translate(-30px,-13px) rotate(360deg)  scale(0.15); opacity:0; }
        }
        @keyframes fly-2 {
          0%   { transform: translate(0,0)     rotate(0deg)    scale(0);    opacity:0; }
          7%   { transform: translate(3px,-6px)   rotate(-40deg)  scale(1.1);  opacity:1; }
          55%  { transform: translate(23px,-40px)  rotate(-200deg) scale(1);    opacity:1; }
          80%  { transform: translate(26px,-27px)  rotate(-290deg) scale(0.65); opacity:0.5; }
          100% { transform: translate(27px,-15px)  rotate(-355deg) scale(0.15); opacity:0; }
        }
        @keyframes fly-3 {
          0%   { transform: translate(0,0)    rotate(0deg)   scale(0);    opacity:0; }
          7%   { transform: translate(-1px,-8px) rotate(70deg)  scale(1.1);  opacity:1; }
          55%  { transform: translate(-7px,-46px) rotate(235deg) scale(1);    opacity:1; }
          80%  { transform: translate(-8px,-34px) rotate(325deg) scale(0.55); opacity:0.4; }
          100% { transform: translate(-9px,-23px) rotate(395deg) scale(0.1);  opacity:0; }
        }
        @keyframes fly-4 {
          0%   { transform: translate(0,0)    rotate(0deg)   scale(0);    opacity:0; }
          7%   { transform: translate(6px,-4px)  rotate(-70deg) scale(1.1);  opacity:1; }
          55%  { transform: translate(31px,-27px) rotate(-215deg) scale(1);    opacity:1; }
          80%  { transform: translate(34px,-16px) rotate(-308deg) scale(0.55); opacity:0.4; }
          100% { transform: translate(35px,-7px)  rotate(-375deg) scale(0.1);  opacity:0; }
        }
        @keyframes fly-5 {
          0%   { transform: translate(0,0)    rotate(0deg)  scale(0);    opacity:0; }
          7%   { transform: translate(-6px,-3px) rotate(110deg) scale(1.1);  opacity:1; }
          55%  { transform: translate(-34px,-21px) rotate(265deg) scale(1);    opacity:1; }
          80%  { transform: translate(-36px,-11px) rotate(355deg) scale(0.55); opacity:0.35; }
          100% { transform: translate(-37px,-3px)  rotate(415deg) scale(0.1);  opacity:0; }
        }
        @keyframes fly-6 {
          0%   { transform: translate(0,0)    rotate(0deg)   scale(0);    opacity:0; }
          7%   { transform: translate(1px,-9px)  rotate(-90deg) scale(1.1);  opacity:1; }
          55%  { transform: translate(10px,-48px) rotate(-220deg) scale(1);    opacity:1; }
          80%  { transform: translate(11px,-36px) rotate(-315deg) scale(0.5);  opacity:0.3; }
          100% { transform: translate(12px,-26px) rotate(-385deg) scale(0.1);  opacity:0; }
        }

        .k1 { animation: fly-1 2.00s ease-in-out infinite;       transform-box: fill-box; transform-origin: center; }
        .k2 { animation: fly-2 1.85s ease-in-out infinite 0.33s; transform-box: fill-box; transform-origin: center; }
        .k3 { animation: fly-3 1.70s ease-in-out infinite 0.66s; transform-box: fill-box; transform-origin: center; }
        .k4 { animation: fly-4 1.90s ease-in-out infinite 0.98s; transform-box: fill-box; transform-origin: center; }
        .k5 { animation: fly-5 2.10s ease-in-out infinite 1.32s; transform-box: fill-box; transform-origin: center; }
        .k6 { animation: fly-6 1.65s ease-in-out infinite 0.16s; transform-box: fill-box; transform-origin: center; }
      `}</style>

      {/* Heat glow — ellipse at bucket mouth */}
      <ellipse className="heat-glow" cx="50" cy="61" rx="19" ry="10" fill="#fff1cd"/>

      {/* Bucket — rumbles subtly */}
      <g className="bucket-grp">
        <rect x="28" y="58" width="44" height="7" rx="2.5" fill="#fff1cd"/>
        <path d="M30 65 L35 94 L65 94 L70 65Z" fill="transparent" stroke="#fff1cd" strokeWidth="1.8" strokeLinejoin="round"/>
      </g>

      {/* Flying kernels — all originate from bucket mouth ~(50,60) */}
      <g className="k1">
        <circle cx="50" cy="60" r="3.6" fill="#fff1cd"/>
        <circle cx="47" cy="58" r="2.6" fill="#fff1cd"/>
        <circle cx="53" cy="58" r="2.3" fill="#fff1cd"/>
      </g>
      <g className="k2">
        <circle cx="50" cy="60" r="3.1" fill="#fff1cd"/>
        <circle cx="48" cy="57.5" r="2.1" fill="#fff1cd"/>
        <circle cx="53" cy="58.5" r="2.3" fill="#fff1cd"/>
      </g>
      <g className="k3">
        <circle cx="50" cy="60" r="3.3" fill="#fff1cd"/>
        <circle cx="47.5" cy="58" r="2.4" fill="#fff1cd"/>
        <circle cx="52.5" cy="57.5" r="2.1" fill="#fff1cd"/>
      </g>
      <g className="k4">
        <circle cx="50" cy="60" r="2.9" fill="#fff1cd"/>
        <circle cx="52.5" cy="58.5" r="2.2" fill="#fff1cd"/>
        <circle cx="48"   cy="58"   r="1.9" fill="#fff1cd"/>
      </g>
      <g className="k5">
        <circle cx="50"   cy="60"   r="3.1" fill="#fff1cd"/>
        <circle cx="47"   cy="58.5" r="2.3" fill="#fff1cd"/>
        <circle cx="52.5" cy="57.5" r="1.9" fill="#fff1cd"/>
      </g>
      <g className="k6">
        <circle cx="50"   cy="60"   r="2.7" fill="#fff1cd"/>
        <circle cx="48"   cy="57.5" r="2.1" fill="#fff1cd"/>
        <circle cx="52.5" cy="58.5" r="1.9" fill="#fff1cd"/>
      </g>

      {/* Left puff */}
      <g className="pca">
        <circle cx="35" cy="50" r="6"   fill="#fff1cd"/>
        <circle cx="29" cy="46" r="4.5" fill="#fff1cd"/>
        <circle cx="35" cy="42" r="5"   fill="#fff1cd"/>
        <circle cx="41" cy="46" r="4.5" fill="#fff1cd"/>
      </g>

      {/* Centre puff */}
      <g className="pcb">
        <circle cx="50" cy="46" r="7"   fill="#fff1cd"/>
        <circle cx="43" cy="41" r="5"   fill="#fff1cd"/>
        <circle cx="50" cy="36" r="6"   fill="#fff1cd"/>
        <circle cx="57" cy="41" r="5"   fill="#fff1cd"/>
        <circle cx="44" cy="49" r="4"   fill="#fff1cd"/>
        <circle cx="56" cy="49" r="4"   fill="#fff1cd"/>
      </g>

      {/* Right puff */}
      <g className="pcc">
        <circle cx="65" cy="50" r="6"   fill="#fff1cd"/>
        <circle cx="59" cy="46" r="4.5" fill="#fff1cd"/>
        <circle cx="65" cy="42" r="5"   fill="#fff1cd"/>
        <circle cx="71" cy="46" r="4.5" fill="#fff1cd"/>
      </g>
    </svg>
  );
}

/**
 * Splash screen — dual purpose:
 *  • Returning signed-in users see a 4-second brand intro, then it fades into
 *    the feed.
 *  • New / signed-out users see the same popcorn animation, and after the
 *    kernels start popping, two CTA buttons reveal beneath the bucket:
 *    "Create your account" and "I already have an account". The splash does
 *    NOT auto-fade in this case — it stays put until the user authenticates,
 *    at which point the parent flips `isAuthed` and the splash fades away.
 */
export function SplashScreen({
  onDone,
  authLoading,
  isAuthed,
  onCreateAccount,
  onSignIn,
  onOpenLegal,
}: SplashScreenProps) {
  const [phase, setPhase] = useState<"visible" | "fading">("visible");
  const [showPopcorn, setShowPopcorn] = useState(false);
  const [showCTAs, setShowCTAs] = useState(false);
  // Freeze a mount timestamp so we can guarantee a minimum brand display time,
  // no matter how fast Supabase resolves the session.
  const [splashStart] = useState(() => Date.now());

  // Staggered reveal sequence:
  //   0.40s → POPCORN wordmark fades up
  //   1.40s → CULTURE CURATED DAILY tagline fades up
  //   3.30s → popcorn SVG lifts + scales in
  //   4.80s → LOG IN / CREATE YOUR ACCOUNT buttons rise into view
  useEffect(() => {
    const t = setTimeout(() => setShowPopcorn(true), 3300);
    return () => clearTimeout(t);
  }, []);

  // Auth-aware fade / CTA logic. Re-runs any time auth state changes.
  useEffect(() => {
    if (authLoading) return; // wait for Supabase to resolve the session

    if (isAuthed) {
      // Signed in — show brand for a minimum duration, then fade.
      // Timed so the full staggered sequence can complete before fade-out.
      const MIN_VISIBLE = 5800;
      const elapsed = Date.now() - splashStart;
      const wait = Math.max(0, MIN_VISIBLE - elapsed);
      setShowCTAs(false);
      const fadeTimer = setTimeout(() => setPhase("fading"), wait);
      const doneTimer = setTimeout(() => onDone(), wait + 650);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(doneTimer);
      };
    }

    // Signed out — CTAs arrive last, after the popcorn has fully popped.
    const CTA_DELAY = 4200;
    const elapsed = Date.now() - splashStart;
    const wait = Math.max(0, CTA_DELAY - elapsed);
    const ctaTimer = setTimeout(() => setShowCTAs(true), wait);
    return () => clearTimeout(ctaTimer);
  }, [authLoading, isAuthed, onDone, splashStart]);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden"
      style={{
        backgroundColor: '#053980',
        isolation: 'isolate',
        opacity: phase === "fading" ? 0 : 1,
        transition: 'opacity 0.6s ease-out',
        pointerEvents: phase === "fading" ? 'none' : 'auto',
      }}
    >
      {/* ── Hidden defs ── */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <defs>
          <filter id="sp-stamp" x="-8%" y="-20%" width="116%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="4" seed="6" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <GrainBackground />

      <style>{`
        @keyframes sp-rise {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes sp-wordmark-in {
          0%   { opacity: 0; transform: translateY(18px) scale(0.985); letter-spacing: 0.12em; }
          60%  { opacity: 1; }
          100% { opacity: 1; transform: translateY(0) scale(1); letter-spacing: 0.03em; }
        }
        @keyframes sp-tagline-in {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Centre — wordmark, tagline, popcorn animation */}
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center"
        style={{ gap: '14px', paddingBottom: '80px', transform: 'translateY(-30px)' }}
      >
        <span
          style={{
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontWeight: 400,
            fontSize: 'clamp(37px, 10.4vw, 50px)',
            color: '#fff1cd',
            letterSpacing: '0.03em',
            lineHeight: 1,
            textTransform: 'uppercase',
            display: 'block',
            filter: 'url(#sp-stamp)',
            animation: 'sp-wordmark-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.4s both',
          }}
        >
          POPCORN
        </span>

        <p
          style={{
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontWeight: 400,
            fontSize: '15px',
            color: '#fff1cd',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: 0,
            animation: 'sp-tagline-in 1.25s cubic-bezier(0.22,1,0.36,1) 1.4s both',
          }}
        >
          CULTURE CURATED DAILY
        </p>

        <div
          style={{
            marginTop: '-10px',
            opacity: showPopcorn ? 1 : 0,
            transform: showPopcorn ? 'scale(1) translateY(0)' : 'scale(0.1) translateY(28px)',
            transition: showPopcorn
              ? 'opacity 0.9s ease-out, transform 1.5s cubic-bezier(0.34, 1.95, 0.64, 1)'
              : 'none',
          }}
        >
          <PopcornAnim />
        </div>
      </div>

      {/* Bottom — sign-up CTAs, revealed only when signed-out and after the
          popcorn has started popping. Stays out of the way for returning users. */}
      <div
        className="relative z-10 px-6 flex-shrink-0 flex flex-col items-center"
        style={{
          marginTop: '-190px',
          paddingBottom: 'max(22px, calc(env(safe-area-inset-bottom) + 14px))',
          pointerEvents: showCTAs ? 'auto' : 'none',
          opacity: showCTAs ? 1 : 0,
          transform: showCTAs ? 'translateY(-30px)' : 'translateY(-12px)',
          transition: 'opacity 3s cubic-bezier(0.22,1,0.36,1) 0.3s, transform 3s cubic-bezier(0.22,1,0.36,1) 0.3s',
        }}
      >
        <div
          className="flex flex-col gap-2.5 w-full"
          style={{ maxWidth: '300px' }}
        >
          <button
            onClick={onSignIn}
            className="w-full flex items-center justify-center gap-2 rounded-full transition-all duration-150 active:scale-[0.98]"
            style={{
              fontFamily: "'Macabro', 'Anton', sans-serif",
              fontSize: '13px',
              letterSpacing: '0.10em',
              padding: '13px 20px',
              background: '#fff1cd',
              color: '#053980',
              boxShadow: '0 10px 30px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.35) inset',
            }}
          >
            LOG IN
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>

          <button
            onClick={onCreateAccount}
            className="w-full rounded-full transition-opacity hover:opacity-80 active:opacity-60"
            style={{
              fontFamily: "'Macabro', 'Anton', sans-serif",
              fontSize: '13px',
              letterSpacing: '0.10em',
              padding: '13px 20px',
              color: '#fff1cd',
              background: 'transparent',
              border: '1px solid rgba(255,241,205,0.32)',
            }}
          >
            CREATE YOUR ACCOUNT
          </button>
        </div>

        {/* Legal footnote — outside 300px button container so it fits on one line */}
        <p
          className="font-['Inter']"
          style={{
            marginTop: '14px',
            textAlign: 'center',
            fontSize: '10.5px',
            lineHeight: 1.55,
            color: 'rgba(255,241,205,0.35)',
          }}
        >
          By continuing you agree to our{" "}
          <button
            onClick={() => onOpenLegal("terms")}
            className="inline"
            style={{
              color: 'rgba(255,241,205,0.72)',
              borderBottom: '1px solid rgba(255,241,205,0.28)',
              fontWeight: 600,
            }}
          >
            Terms
          </button>{" "}
          &{" "}
          <button
            onClick={() => onOpenLegal("privacy")}
            className="inline"
            style={{
              color: 'rgba(255,241,205,0.72)',
              borderBottom: '1px solid rgba(255,241,205,0.28)',
              fontWeight: 600,
            }}
          >
            Privacy
          </button>.{" · "}
          <button
            onClick={() => onOpenLegal("about")}
            className="inline"
            style={{
              color: 'rgba(255,241,205,0.72)',
              borderBottom: '1px solid rgba(255,241,205,0.28)',
              fontWeight: 600,
            }}
          >
            About Popcorn
          </button>
        </p>
      </div>
    </div>
  );
}
