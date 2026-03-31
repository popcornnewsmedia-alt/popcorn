import { useEffect, useState } from "react";
import { GrainBackground } from "./GrainBackground";

interface SplashScreenProps {
  onDone: () => void;
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
      <ellipse className="heat-glow" cx="50" cy="61" rx="19" ry="10" fill="#fff3d3"/>

      {/* Bucket — rumbles subtly */}
      <g className="bucket-grp">
        <rect x="28" y="58" width="44" height="7" rx="2.5" fill="#fff3d3"/>
        <path d="M30 65 L35 94 L65 94 L70 65Z" fill="transparent" stroke="#fff3d3" strokeWidth="1.8" strokeLinejoin="round"/>
      </g>

      {/* Flying kernels — all originate from bucket mouth ~(50,60) */}
      <g className="k1">
        <circle cx="50" cy="60" r="3.6" fill="#fff3d3"/>
        <circle cx="47" cy="58" r="2.6" fill="#fff3d3"/>
        <circle cx="53" cy="58" r="2.3" fill="#fff3d3"/>
      </g>
      <g className="k2">
        <circle cx="50" cy="60" r="3.1" fill="#fff3d3"/>
        <circle cx="48" cy="57.5" r="2.1" fill="#fff3d3"/>
        <circle cx="53" cy="58.5" r="2.3" fill="#fff3d3"/>
      </g>
      <g className="k3">
        <circle cx="50" cy="60" r="3.3" fill="#fff3d3"/>
        <circle cx="47.5" cy="58" r="2.4" fill="#fff3d3"/>
        <circle cx="52.5" cy="57.5" r="2.1" fill="#fff3d3"/>
      </g>
      <g className="k4">
        <circle cx="50" cy="60" r="2.9" fill="#fff3d3"/>
        <circle cx="52.5" cy="58.5" r="2.2" fill="#fff3d3"/>
        <circle cx="48"   cy="58"   r="1.9" fill="#fff3d3"/>
      </g>
      <g className="k5">
        <circle cx="50"   cy="60"   r="3.1" fill="#fff3d3"/>
        <circle cx="47"   cy="58.5" r="2.3" fill="#fff3d3"/>
        <circle cx="52.5" cy="57.5" r="1.9" fill="#fff3d3"/>
      </g>
      <g className="k6">
        <circle cx="50"   cy="60"   r="2.7" fill="#fff3d3"/>
        <circle cx="48"   cy="57.5" r="2.1" fill="#fff3d3"/>
        <circle cx="52.5" cy="58.5" r="1.9" fill="#fff3d3"/>
      </g>

      {/* Left puff */}
      <g className="pca">
        <circle cx="35" cy="50" r="6"   fill="#fff3d3"/>
        <circle cx="29" cy="46" r="4.5" fill="#fff3d3"/>
        <circle cx="35" cy="42" r="5"   fill="#fff3d3"/>
        <circle cx="41" cy="46" r="4.5" fill="#fff3d3"/>
      </g>

      {/* Centre puff */}
      <g className="pcb">
        <circle cx="50" cy="46" r="7"   fill="#fff3d3"/>
        <circle cx="43" cy="41" r="5"   fill="#fff3d3"/>
        <circle cx="50" cy="36" r="6"   fill="#fff3d3"/>
        <circle cx="57" cy="41" r="5"   fill="#fff3d3"/>
        <circle cx="44" cy="49" r="4"   fill="#fff3d3"/>
        <circle cx="56" cy="49" r="4"   fill="#fff3d3"/>
      </g>

      {/* Right puff */}
      <g className="pcc">
        <circle cx="65" cy="50" r="6"   fill="#fff3d3"/>
        <circle cx="59" cy="46" r="4.5" fill="#fff3d3"/>
        <circle cx="65" cy="42" r="5"   fill="#fff3d3"/>
        <circle cx="71" cy="46" r="4.5" fill="#fff3d3"/>
      </g>
    </svg>
  );
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<"visible" | "fading">("visible");
  const [showPopcorn, setShowPopcorn] = useState(false);

  useEffect(() => {
    const popcornTimer = setTimeout(() => setShowPopcorn(true), 1500);
    const fadeTimer    = setTimeout(() => setPhase("fading"), 4000);
    const doneTimer    = setTimeout(() => onDone(), 4600);
    return () => {
      clearTimeout(popcornTimer);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: '#204a52',
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

      <div
        className="flex flex-col items-center"
        style={{ position: 'relative', zIndex: 10, gap: '14px' }}
      >
        <span
          style={{
            fontFamily: "'Macabro', 'Anton', sans-serif",
            fontWeight: 400,
            fontSize: 'clamp(37px, 10.4vw, 50px)',
            color: '#fff3d3',
            letterSpacing: '0.03em',
            lineHeight: 1,
            textTransform: 'uppercase',
            display: 'block',
            filter: 'url(#sp-stamp)',
            animation: 'infer-reveal 0.7s cubic-bezier(0.22,1,0.36,1) 0.4s both',
          }}
        >
          POPCORN
        </span>

        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: '13px',
            color: '#fff3d3',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            margin: 0,
            animation: 'tagline-reveal 0.6s cubic-bezier(0.22,1,0.36,1) 0.95s both',
          }}
        >
          NEWS CAN BE FUN
        </p>

        <div
          style={{
            marginTop: '-10px',
            opacity: showPopcorn ? 1 : 0,
            transform: showPopcorn ? 'scale(1) translateY(0)' : 'scale(0.1) translateY(28px)',
            transition: showPopcorn
              ? 'opacity 0.35s ease-out, transform 0.7s cubic-bezier(0.34, 1.95, 0.64, 1)'
              : 'none',
          }}
        >
          <PopcornAnim />
        </div>
      </div>
    </div>
  );
}
