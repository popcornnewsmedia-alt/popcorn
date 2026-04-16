// Animated popcorn icon used as the in-app "notifications" badge on the
// profile screen. The SVG content mirrors the splash-screen `PopcornAnim`
// (bucket rumble, puff squash-and-stretch, heat glow, six flying kernels)
// so the icon feels alive and on-brand — the popcorn is literally popping.
//
// When `hasDot` is true, a terracotta badge overhangs the upper-right. The
// dot is static; the pop motion comes entirely from the popcorn itself,
// which reads as the notification indicator (popcorn = notification).
//
// Rendering notes:
//   • `overflow: visible` lets the kernels + badge extend past the viewBox.
//   • Animations are keyed off `.pn-*` CSS classes scoped via an inline
//     <style> so the component is self-contained and doesn't collide with
//     the splash's `.pca/.pcb/.pcc/.bucket-grp/.kN/.heat-glow` classes.

interface PopcornIconProps {
  size?: number;
  hasDot?: boolean;
  color?: string;    // popcorn body/puff fill
  dotColor?: string; // notification dot fill
  haloColor?: string; // halo ring around the dot
  className?: string;
}

export function PopcornIcon({
  size = 36,
  hasDot = false,
  color = "#fff1cd",
  dotColor = "#e14b3a",
  haloColor = "#053980",
  className,
}: PopcornIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      // overflow:visible lets kernels + badge extend past the viewBox.
      style={{ display: "block", flexShrink: 0, overflow: "visible" }}
    >
      <style>{`
        /* Squash-and-stretch puff bounce — three variants, staggered, so
           the left/centre/right puffs pop at different beats. */
        @keyframes pn-a {
          0%,100% { transform: translateY(0) scaleY(1) scaleX(1); }
          20%      { transform: translateY(2px) scaleY(0.88) scaleX(1.1); }
          50%      { transform: translateY(-11px) scaleY(1.12) scaleX(0.91); }
          75%      { transform: translateY(-8px) scaleY(1.06) scaleX(0.96); }
        }
        @keyframes pn-b {
          0%,100% { transform: translateY(0) scaleY(1) scaleX(1); }
          20%      { transform: translateY(2px) scaleY(0.85) scaleX(1.12); }
          50%      { transform: translateY(-15px) scaleY(1.14) scaleX(0.89); }
          75%      { transform: translateY(-10px) scaleY(1.07) scaleX(0.95); }
        }
        @keyframes pn-c {
          0%,100% { transform: translateY(0) scaleY(1) scaleX(1); }
          20%      { transform: translateY(2px) scaleY(0.9) scaleX(1.08); }
          50%      { transform: translateY(-10px) scaleY(1.1) scaleX(0.92); }
          75%      { transform: translateY(-7px) scaleY(1.05) scaleX(0.97); }
        }
        .pn-pca { animation: pn-a 1.35s cubic-bezier(0.34,1.5,0.64,1) infinite;        transform-box: fill-box; transform-origin: center 90%; }
        .pn-pcb { animation: pn-b 1.35s cubic-bezier(0.34,1.5,0.64,1) infinite 0.22s; transform-box: fill-box; transform-origin: center 90%; }
        .pn-pcc { animation: pn-c 1.35s cubic-bezier(0.34,1.5,0.64,1) infinite 0.44s; transform-box: fill-box; transform-origin: center 90%; }

        /* Bucket rumble */
        @keyframes pn-rumble {
          0%,100% { transform: none; }
          20%  { transform: translateX(-1.4px) rotate(-0.4deg); }
          50%  { transform: translateX(1.4px)  rotate(0.4deg); }
          80%  { transform: translateX(-0.7px); }
        }
        .pn-bucket { animation: pn-rumble 0.38s ease-in-out infinite; transform-box: fill-box; transform-origin: center 50%; }

        /* Heat glow pulse */
        @keyframes pn-heat {
          0%,100% { opacity: 0.11; }
          50%      { opacity: 0.26; }
        }
        .pn-heat { animation: pn-heat 1.0s ease-in-out infinite; }

        /* Flying kernels — six unique arcing trajectories, same as splash */
        @keyframes pn-fly-1 {
          0%   { transform: translate(0,0)     rotate(0deg)    scale(0);    opacity:0; }
          7%   { transform: translate(-3px,-6px)  rotate(40deg)   scale(1.1);  opacity:1; }
          55%  { transform: translate(-25px,-37px) rotate(215deg)  scale(1);    opacity:1; }
          80%  { transform: translate(-28px,-24px) rotate(305deg)  scale(0.65); opacity:0.5; }
          100% { transform: translate(-30px,-13px) rotate(360deg)  scale(0.15); opacity:0; }
        }
        @keyframes pn-fly-2 {
          0%   { transform: translate(0,0)     rotate(0deg)    scale(0);    opacity:0; }
          7%   { transform: translate(3px,-6px)   rotate(-40deg)  scale(1.1);  opacity:1; }
          55%  { transform: translate(23px,-40px)  rotate(-200deg) scale(1);    opacity:1; }
          80%  { transform: translate(26px,-27px)  rotate(-290deg) scale(0.65); opacity:0.5; }
          100% { transform: translate(27px,-15px)  rotate(-355deg) scale(0.15); opacity:0; }
        }
        @keyframes pn-fly-3 {
          0%   { transform: translate(0,0)    rotate(0deg)   scale(0);    opacity:0; }
          7%   { transform: translate(-1px,-8px) rotate(70deg)  scale(1.1);  opacity:1; }
          55%  { transform: translate(-7px,-46px) rotate(235deg) scale(1);    opacity:1; }
          80%  { transform: translate(-8px,-34px) rotate(325deg) scale(0.55); opacity:0.4; }
          100% { transform: translate(-9px,-23px) rotate(395deg) scale(0.1);  opacity:0; }
        }
        @keyframes pn-fly-4 {
          0%   { transform: translate(0,0)    rotate(0deg)   scale(0);    opacity:0; }
          7%   { transform: translate(6px,-4px)  rotate(-70deg) scale(1.1);  opacity:1; }
          55%  { transform: translate(31px,-27px) rotate(-215deg) scale(1);    opacity:1; }
          80%  { transform: translate(34px,-16px) rotate(-308deg) scale(0.55); opacity:0.4; }
          100% { transform: translate(35px,-7px)  rotate(-375deg) scale(0.1);  opacity:0; }
        }
        @keyframes pn-fly-5 {
          0%   { transform: translate(0,0)    rotate(0deg)  scale(0);    opacity:0; }
          7%   { transform: translate(-6px,-3px) rotate(110deg) scale(1.1);  opacity:1; }
          55%  { transform: translate(-34px,-21px) rotate(265deg) scale(1);    opacity:1; }
          80%  { transform: translate(-36px,-11px) rotate(355deg) scale(0.55); opacity:0.35; }
          100% { transform: translate(-37px,-3px)  rotate(415deg) scale(0.1);  opacity:0; }
        }
        @keyframes pn-fly-6 {
          0%   { transform: translate(0,0)    rotate(0deg)   scale(0);    opacity:0; }
          7%   { transform: translate(1px,-9px)  rotate(-90deg) scale(1.1);  opacity:1; }
          55%  { transform: translate(10px,-48px) rotate(-220deg) scale(1);    opacity:1; }
          80%  { transform: translate(11px,-36px) rotate(-315deg) scale(0.5);  opacity:0.3; }
          100% { transform: translate(12px,-26px) rotate(-385deg) scale(0.1);  opacity:0; }
        }
        .pn-k1 { animation: pn-fly-1 2.00s ease-in-out infinite;       transform-box: fill-box; transform-origin: center; }
        .pn-k2 { animation: pn-fly-2 1.85s ease-in-out infinite 0.33s; transform-box: fill-box; transform-origin: center; }
        .pn-k3 { animation: pn-fly-3 1.70s ease-in-out infinite 0.66s; transform-box: fill-box; transform-origin: center; }
        .pn-k4 { animation: pn-fly-4 1.90s ease-in-out infinite 0.98s; transform-box: fill-box; transform-origin: center; }
        .pn-k5 { animation: pn-fly-5 2.10s ease-in-out infinite 1.32s; transform-box: fill-box; transform-origin: center; }
        .pn-k6 { animation: pn-fly-6 1.65s ease-in-out infinite 0.16s; transform-box: fill-box; transform-origin: center; }
      `}</style>

      {/* Heat glow — ellipse at bucket mouth */}
      <ellipse className="pn-heat" cx="50" cy="61" rx="19" ry="10" fill={color} />

      {/* Bucket — rumbles subtly */}
      <g className="pn-bucket">
        <rect x="28" y="58" width="44" height="7" rx="2.5" fill={color} />
        <path d="M30 65 L35 94 L65 94 L70 65Z" fill="transparent" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      </g>

      {/* Flying kernels — all originate from bucket mouth ~(50,60) */}
      <g className="pn-k1">
        <circle cx="50" cy="60" r="3.6" fill={color} />
        <circle cx="47" cy="58" r="2.6" fill={color} />
        <circle cx="53" cy="58" r="2.3" fill={color} />
      </g>
      <g className="pn-k2">
        <circle cx="50" cy="60" r="3.1" fill={color} />
        <circle cx="48" cy="57.5" r="2.1" fill={color} />
        <circle cx="53" cy="58.5" r="2.3" fill={color} />
      </g>
      <g className="pn-k3">
        <circle cx="50" cy="60" r="3.3" fill={color} />
        <circle cx="47.5" cy="58" r="2.4" fill={color} />
        <circle cx="52.5" cy="57.5" r="2.1" fill={color} />
      </g>
      <g className="pn-k4">
        <circle cx="50" cy="60" r="2.9" fill={color} />
        <circle cx="52.5" cy="58.5" r="2.2" fill={color} />
        <circle cx="48"   cy="58"   r="1.9" fill={color} />
      </g>
      <g className="pn-k5">
        <circle cx="50"   cy="60"   r="3.1" fill={color} />
        <circle cx="47"   cy="58.5" r="2.3" fill={color} />
        <circle cx="52.5" cy="57.5" r="1.9" fill={color} />
      </g>
      <g className="pn-k6">
        <circle cx="50"   cy="60"   r="2.7" fill={color} />
        <circle cx="48"   cy="57.5" r="2.1" fill={color} />
        <circle cx="52.5" cy="58.5" r="1.9" fill={color} />
      </g>

      {/* Left puff */}
      <g className="pn-pca">
        <circle cx="35" cy="50" r="6"   fill={color} />
        <circle cx="29" cy="46" r="4.5" fill={color} />
        <circle cx="35" cy="42" r="5"   fill={color} />
        <circle cx="41" cy="46" r="4.5" fill={color} />
      </g>

      {/* Centre puff */}
      <g className="pn-pcb">
        <circle cx="50" cy="46" r="7"   fill={color} />
        <circle cx="43" cy="41" r="5"   fill={color} />
        <circle cx="50" cy="36" r="6"   fill={color} />
        <circle cx="57" cy="41" r="5"   fill={color} />
        <circle cx="44" cy="49" r="4"   fill={color} />
        <circle cx="56" cy="49" r="4"   fill={color} />
      </g>

      {/* Right puff */}
      <g className="pn-pcc">
        <circle cx="65" cy="50" r="6"   fill={color} />
        <circle cx="59" cy="46" r="4.5" fill={color} />
        <circle cx="65" cy="42" r="5"   fill={color} />
        <circle cx="71" cy="46" r="4.5" fill={color} />
      </g>

      {/* Notification badge — static, hangs past the right edge. Drawn
          last so it paints above the flying kernels. */}
      {hasDot && (
        <g>
          <circle cx="88" cy="14" r="10" fill={haloColor} />
          <circle cx="88" cy="14" r="7"  fill={dotColor} />
        </g>
      )}
    </svg>
  );
}
