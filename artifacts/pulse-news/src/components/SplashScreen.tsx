import { useEffect, useState } from "react";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<"visible" | "fading">("visible");

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase("fading"), 2400);
    const doneTimer = setTimeout(() => onDone(), 3000);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
      style={{
        background: '#ecf3ef',
        opacity: phase === "fading" ? 0 : 1,
        transition: 'opacity 0.6s ease-out',
        pointerEvents: phase === "fading" ? 'none' : 'auto',
      }}
    >
      {/* Animated blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="blob-a absolute rounded-full"
          style={{
            width: '420px', height: '420px',
            top: '-80px', left: '-100px',
            background: 'radial-gradient(circle, rgba(26,68,48,0.55) 0%, transparent 70%)',
            filter: 'blur(56px)',
          }}
        />
        <div
          className="blob-b absolute rounded-full"
          style={{
            width: '380px', height: '380px',
            bottom: '-60px', right: '-80px',
            background: 'radial-gradient(circle, rgba(44,82,62,0.48) 0%, transparent 70%)',
            filter: 'blur(52px)',
          }}
        />
        <div
          className="blob-c absolute rounded-full"
          style={{
            width: '280px', height: '280px',
            top: '40%', left: '55%',
            background: 'radial-gradient(circle, rgba(82,183,136,0.30) 0%, transparent 70%)',
            filter: 'blur(48px)',
          }}
        />
      </div>

      {/* Centre content */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Brand name */}
        <div
          style={{
            animation: 'bref-reveal 0.7s cubic-bezier(0.22,1,0.36,1) 0.5s both',
          }}
        >
          <span
            className="font-['Manrope'] font-bold tracking-tight"
            style={{ fontSize: '64px', color: '#000000', letterSpacing: '-0.04em', lineHeight: 1 }}
          >
            Bref.
          </span>
        </div>

        {/* Tagline */}
        <p
          className="font-['Neue_Montreal'] font-medium"
          style={{
            fontSize: '14px',
            color: 'rgba(0,0,0,0.40)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            animation: 'tagline-reveal 0.6s cubic-bezier(0.22,1,0.36,1) 1.0s both',
          }}
        >
          News in seconds.
        </p>

        {/* Loading dots */}
        <div
          className="flex items-end gap-1.5 mt-6"
          style={{ animation: 'tagline-reveal 0.4s ease 1.4s both' }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: '4px',
                height: '18px',
                borderRadius: '9999px',
                background: '#000000',
                animation: `dot-pulse 1.2s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
