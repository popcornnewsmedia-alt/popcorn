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

/**
 * Theatrical spotlight rendered behind the popcorn. A narrow hot-cream source
 * at the top diverges into a wide cone that bathes the bucket, landing in a
 * warm elliptical pool on the "stage floor". Ignites (with a short flicker)
 * slightly before the popcorn appears, then settles into a slow breathing
 * pulse until `settled` is true — at which point all animations stop so we
 * don't keep a permanent compositing layer alive.
 */
function Spotlight({ visible, settled }: { visible: boolean; settled: boolean }) {
  // Conceptually the beam still falls from above — preserving that
  // "light-from-above" feel — but we key the gradient so the cone is FULLY
  // TRANSPARENT over the wordmark/tagline and only fades into visibility once
  // it reaches the popcorn icon. No visible source point, no visible beam above
  // the popcorn. Everything stops animating once `settled` is true.
  const animating = visible && !settled;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        // Source point is ~200px above the popcorn — gives the beam room to
        // diverge visibly before it reaches the bucket. SVG is taller now
        // so the cone also extends ~30px below the bucket. Only the lower
        // ~55% of the div is actually lit (gradient opacity clips the top).
        top: '-200px',
        left: '50%',
        width: '300px',
        height: '360px',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: visible ? 1 : 0,
        // Baseline brightness for the "on" state after animations finish —
        // the ignite keyframe's final brightness(1.2) would otherwise snap
        // away when `animation:none` takes over at contentSettled.
        filter: visible ? 'brightness(1.2)' : 'brightness(1)',
        animation: animating
          ? 'sp-ignite 1.8s linear both, sp-breathe 4.2s ease-in-out 1.8s infinite'
          : 'none',
        transition: visible ? 'none' : 'opacity 0.4s ease-out',
      }}
    >
      <svg
        viewBox="0 0 300 360"
        width="300"
        height="360"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          {/* Core beam — narrow cone that only becomes visible as it
              reaches the popcorn. Fully transparent above the wordmark/
              tagline so the beam feels like it's lighting just the bucket. */}
          {/* Stops recalculated for the taller 360-unit SVG so the visible
              light still starts in the same place relative to the popcorn
              (around the top of the bucket) but now reaches ~30px below
              the bucket before fully fading out. */}
          <linearGradient id="sp-beam-core" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%"   stopColor="#fff1cd" stopOpacity="0" />
            <stop offset="52%"  stopColor="#fff1cd" stopOpacity="0" />
            <stop offset="63%"  stopColor="#fff4d8" stopOpacity="0.22" />
            <stop offset="80%"  stopColor="#fff4d8" stopOpacity="0.14" />
            <stop offset="96%"  stopColor="#fff1cd" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#fff1cd" stopOpacity="0" />
          </linearGradient>
          {/* Outer halo — wider, softer bloom, also clipped above popcorn */}
          <linearGradient id="sp-beam-wide" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%"   stopColor="#fff1cd" stopOpacity="0" />
            <stop offset="50%"  stopColor="#fff1cd" stopOpacity="0" />
            <stop offset="63%"  stopColor="#fff1cd" stopOpacity="0.1" />
            <stop offset="85%"  stopColor="#fff1cd" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#fff1cd" stopOpacity="0" />
          </linearGradient>
          {/* Floor pool — gentle warmth under the bucket, no puddle */}
          <radialGradient id="sp-floor" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#fff1cd" stopOpacity="0.16" />
            <stop offset="60%" stopColor="#fff1cd" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#fff1cd" stopOpacity="0" />
          </radialGradient>
          {/* Softening blur for the outer halo */}
          <filter id="sp-blur-soft" x="-25%" y="-10%" width="150%" height="130%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* Outer halo cone — wide, blurred bloom that softens the beam edges.
            Extended to y=330 so the halo trails past the popcorn. */}
        <path
          d="M 136 4 L 164 4 L 272 330 L 28 330 Z"
          fill="url(#sp-beam-wide)"
          filter="url(#sp-blur-soft)"
        />

        {/* Core beam cone — narrow at top, widening as it reaches past the
            popcorn into the stage floor (y=330, just below the bucket). */}
        <path
          d="M 143 0 L 157 0 L 228 330 L 72 330 Z"
          fill="url(#sp-beam-core)"
        />

        {/* Stage-floor pool where the beam lands — nudged down with the cone */}
        <ellipse
          cx="150"
          cy="322"
          rx="94"
          ry="17"
          fill="url(#sp-floor)"
        />
      </svg>
    </div>
  );
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
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [showCTAs, setShowCTAs] = useState(false);
  const [ctaSettled, setCtaSettled] = useState(false);
  const [contentSettled, setContentSettled] = useState(false);
  // Freeze a mount timestamp so we can guarantee a minimum brand display time,
  // no matter how fast Supabase resolves the session.
  const [splashStart] = useState(() => Date.now());

  // Staggered reveal sequence:
  //   0.40s → POPCORN wordmark fades up
  //   1.40s → CULTURE CURATED DAILY tagline fades up
  //   3.20s → spotlight begins flickering (popcorn still hidden) — delayed so
  //           the wordmark/tagline have a beat to breathe before the flicker.
  //   4.84s → spotlight STRIKES (91% of 1.8s ignite) AND popcorn EXPLODES in
  //           simultaneously — pop-explode keyframe bursts the bucket out of
  //           the lit cone with an overshoot/rebound.
  //   7.04s → popcorn explosion settles (2.2s pop-explode with halving damp tail)
  useEffect(() => {
    const sp = setTimeout(() => setShowSpotlight(true), 3200);
    // 3.2s + 1.8s × 0.91 = 4.838s → rounded to 4840ms to coincide with the
    // strike flare (brightness ramps to 1.95 at this keyframe).
    const t = setTimeout(() => setShowPopcorn(true), 4840);
    // Clear identity transforms once both animations finish. Popcorn settles
    // at 4.84s+2.2s=7.04s; ignite finishes at 5.0s. Buffer to 7.1s.
    const s = setTimeout(() => setContentSettled(true), 7100);
    return () => { clearTimeout(sp); clearTimeout(t); clearTimeout(s); };
  }, []);

  // Auth-aware fade / CTA logic. Re-runs any time auth state changes.
  useEffect(() => {
    if (authLoading) return; // wait for Supabase to resolve the session

    if (isAuthed) {
      // Signed in — show brand for a minimum duration, then fade.
      // Timed so the full staggered sequence can complete before fade-out.
      const MIN_VISIBLE = 7600;
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
    const CTA_DELAY = 6300;
    const elapsed = Date.now() - splashStart;
    const wait = Math.max(0, CTA_DELAY - elapsed);
    const ctaTimer = setTimeout(() => setShowCTAs(true), wait);
    // After the 3s CSS transition completes, drop the compositing layer
    const settleTimer = setTimeout(() => setCtaSettled(true), wait + 3400);
    return () => { clearTimeout(ctaTimer); clearTimeout(settleTimer); };
  }, [authLoading, isAuthed, onDone, splashStart]);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden"
      style={{
        backgroundColor: '#053980',
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
        /* Spotlight ignites like an old carbon-arc lamp — the filament
           sputters through several false starts before striking steady.
           All stages are dimmer than before: the flicker is soft and
           subtle, and the strike still reads as an obvious "light came
           on" moment because it clears the peak flicker opacity by a
           wide margin AND bumps brightness above 1.0 for the first time. */
        @keyframes sp-ignite {
          0%   { opacity: 0;    filter: brightness(1); }        /* cold */
          5%   { opacity: 0.18; filter: brightness(1); }        /* first spark */
          9%   { opacity: 0.02; filter: brightness(1); }        /* out */
          15%  { opacity: 0.28; filter: brightness(1); }        /* second attempt */
          20%  { opacity: 0.06; filter: brightness(1); }        /* sputters */
          28%  { opacity: 0.36; filter: brightness(1); }        /* stronger arc */
          34%  { opacity: 0.14; filter: brightness(1); }        /* dims */
          42%  { opacity: 0.46; filter: brightness(1); }        /* nearly on */
          48%  { opacity: 0.26; filter: brightness(1); }        /* wobble */
          56%  { opacity: 0.52; filter: brightness(1); }        /* climbing */
          62%  { opacity: 0.36; filter: brightness(1); }        /* brief dim */
          70%  { opacity: 0.5;  filter: brightness(1); }        /* bouncing */
          78%  { opacity: 0.42; filter: brightness(1); }        /* last wobble */
          85%  { opacity: 0.58; filter: brightness(1); }        /* catches */
          91%  { opacity: 1;    filter: brightness(1.5); }      /* STRIKE — clear flare */
          96%  { opacity: 1;    filter: brightness(1.3); }      /* flare eases */
          100% { opacity: 1;    filter: brightness(1.2); }      /* steady on, clearly brighter than flicker */
        }
        /* Barely-perceptible post-ignite breathing. Holds the softer
           "on" level established by the strike flare. */
        @keyframes sp-breathe {
          0%,100% { opacity: 1;    filter: brightness(1.2); }
          50%     { opacity: 0.96; filter: brightness(1.12); }
        }
        /* Popcorn explosion — bursts up out of the lit cone with an
           overshoot-rebound sequence, as if the light itself punched it
           into existence. Starts tiny deep in the floor pool, overshoots
           past final scale, springs back, then DAMPS OUT over a very
           long tail of ever-halving oscillations so it glides
           imperceptibly into rest rather than snapping. */
        @keyframes pop-explode {
          0%    { opacity: 0; transform: scale(0.05) translateY(38px); }
          8%    { opacity: 1; }
          16%   { transform: scale(1.28)    translateY(-7px); }     /* burst overshoot */
          25%   { transform: scale(0.9)     translateY(3px); }      /* rebound */
          33%   { transform: scale(1.082)   translateY(-1.9px); }   /* second overshoot */
          40%   { transform: scale(0.968)   translateY(0.85px); }   /* damping */
          47%   { transform: scale(1.020)   translateY(-0.5px); }   /* smaller */
          53%   { transform: scale(0.988)   translateY(0.27px); }   /* smaller */
          59%   { transform: scale(1.0075)  translateY(-0.14px); }  /* tinier */
          65%   { transform: scale(0.9965)  translateY(0.07px); }   /* tinier */
          70%   { transform: scale(1.0024)  translateY(-0.035px); } /* tiny */
          75%   { transform: scale(0.9991)  translateY(0.018px); }  /* tiny */
          80%   { transform: scale(1.0009)  translateY(-0.008px); } /* micro */
          84%   { transform: scale(0.99975) translateY(0.003px); }  /* micro */
          88%   { transform: scale(1.00008) translateY(-0.001px); } /* near zero */
          92%   { transform: scale(0.99998) translateY(0); }        /* near zero */
          96%   { transform: scale(1.000015) translateY(0); }       /* sub-pixel */
          100%  { opacity: 1; transform: scale(1) translateY(0); }  /* settled */
        }
        /* Source hot-spot pulses slowly, almost still. */
        @keyframes sp-source-pulse {
          0%,100% { transform: scale(1);    opacity: 1; }
          50%     { transform: scale(1.04); opacity: 0.85; }
        }
      `}</style>

      {/* Centre — wordmark, tagline, popcorn animation */}
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center"
        style={{ gap: '14px', paddingBottom: '110px' }}
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
            ...(contentSettled
              ? { opacity: 1, transform: 'none', animation: 'none' }
              : { animation: 'sp-wordmark-in 0.9s cubic-bezier(0.22,1,0.36,1) 0.4s both' }),
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
            ...(contentSettled
              ? { opacity: 1, transform: 'none', animation: 'none' }
              : { animation: 'sp-tagline-in 1.25s cubic-bezier(0.22,1,0.36,1) 1.4s both' }),
          }}
        >
          CULTURE CURATED DAILY
        </p>

        {/* Stage: spotlight paints behind a non-transforming parent so the
            popcorn's scale-in transition doesn't distort the beam.
            marginTop pushes the whole stage (spotlight cone + bucket)
            down below the tagline so they don't crowd the wordmark. */}
        <div style={{ position: 'relative', marginTop: '90px' }}>
          <Spotlight visible={showSpotlight} settled={contentSettled} />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              // Before pop: fully invisible. After pop-explode keyframe finishes,
              // its `both` fill keeps opacity:1 and transform identity. When
              // contentSettled fires, animation:none takes over and this inline
              // opacity becomes the source of truth.
              opacity: showPopcorn ? 1 : 0,
              animation: contentSettled
                ? 'none'
                : showPopcorn
                  // 2.2s total: first ~40% is the explosion, last ~60% is a
                  // very long halving-oscillation tail that glides into the
                  // ambient puff rhythm instead of snapping to rest.
                  ? 'pop-explode 2.2s cubic-bezier(0.22, 1, 0.36, 1) both'
                  : 'none',
            }}
          >
            <PopcornAnim />
          </div>
        </div>
      </div>

      {/* Bottom — sign-up CTAs, revealed only when signed-out and after the
          popcorn has started popping. Stays out of the way for returning users. */}
      <div
        className="relative z-10 px-6 flex-shrink-0 flex flex-col items-center"
        style={{
          marginTop: ctaSettled ? '-220px' : '-190px',
          paddingBottom: 'max(22px, calc(env(safe-area-inset-bottom) + 14px))',
          pointerEvents: showCTAs ? 'auto' : 'none',
          opacity: showCTAs ? 1 : 0,
          transform: ctaSettled ? 'none' : showCTAs ? 'translateY(-30px)' : 'translateY(-12px)',
          transition: ctaSettled ? 'none' : 'opacity 3s cubic-bezier(0.22,1,0.36,1) 0.3s, transform 3s cubic-bezier(0.22,1,0.36,1) 0.3s',
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
              boxShadow: '0 4px 24px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.35) inset',
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
