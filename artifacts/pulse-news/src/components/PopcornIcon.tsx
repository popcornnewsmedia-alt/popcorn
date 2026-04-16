// Static popcorn SVG used as the in-app "notifications" icon on the profile
// screen. Mirrors the silhouette of the SplashScreen popcorn (bucket + 3
// puffs, no kernels, no animation). A small terracotta dot with a halo appears
// in the upper-right when `hasDot` is true.
//
// Rendering note: the dot uses a halo ring (stroke) matching the profile
// background so the dot reads as a distinct badge even when the icon sits
// directly on a busy backdrop.

interface PopcornIconProps {
  size?: number;
  hasDot?: boolean;
  color?: string;    // popcorn body/puff fill
  dotColor?: string; // notification dot fill
  haloColor?: string; // halo ring around the dot
  className?: string;
}

export function PopcornIcon({
  size = 28,
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
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Bucket — rim + trapezoidal body */}
      <rect x="28" y="58" width="44" height="7" rx="2.5" fill={color} />
      <path
        d="M30 65 L35 94 L65 94 L70 65Z"
        fill="transparent"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Left puff */}
      <g>
        <circle cx="35" cy="50" r="6"   fill={color} />
        <circle cx="29" cy="46" r="4.5" fill={color} />
        <circle cx="35" cy="42" r="5"   fill={color} />
        <circle cx="41" cy="46" r="4.5" fill={color} />
      </g>

      {/* Centre puff */}
      <g>
        <circle cx="50" cy="46" r="7" fill={color} />
        <circle cx="43" cy="41" r="5" fill={color} />
        <circle cx="50" cy="36" r="6" fill={color} />
        <circle cx="57" cy="41" r="5" fill={color} />
        <circle cx="44" cy="49" r="4" fill={color} />
        <circle cx="56" cy="49" r="4" fill={color} />
      </g>

      {/* Right puff */}
      <g>
        <circle cx="65" cy="50" r="6"   fill={color} />
        <circle cx="59" cy="46" r="4.5" fill={color} />
        <circle cx="65" cy="42" r="5"   fill={color} />
        <circle cx="71" cy="46" r="4.5" fill={color} />
      </g>

      {/* Notification dot — halo + fill, upper-right */}
      {hasDot && (
        <>
          <circle cx="78" cy="28" r="12" fill={haloColor} />
          <circle cx="78" cy="28" r="9"  fill={dotColor} />
        </>
      )}
    </svg>
  );
}
