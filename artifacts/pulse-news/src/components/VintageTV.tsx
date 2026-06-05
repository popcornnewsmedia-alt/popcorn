/* ──────────────────────────────────────────────────────────────────────
   VintageTV — photoreal 1970s wood-cabinet CRT television that shows a
   single article. The screen plays CRT static idly; hovering kicks off
   the tune-in sequence and the article then stays on screen.

   The cabinet is a single PNG (public/vintage-tv.png). The animated
   screen content is overlaid over the exact pixel area of the screen
   using percentage offsets relative to the image.

   Phases on hover:
     static (1.6s) → tune flash (0.32s) → on (stays)
   ────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import type { NewsArticle } from "@workspace/api-client-react";
import { feedImageUrl } from "@/lib/image-url";

const CREAM = "#fff1cd";

/* Two SVG fractal-noise tiles at different frequencies. Switching
   between them during the static phase gives a much more authentic
   CRT-noise feel than a single tile shifting position. */
const noiseTile = (freq: number, w: number) =>
  "data:image/svg+xml;charset=utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${w}'>
       <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter>
       <rect width='100%' height='100%' filter='url(#n)'/>
     </svg>`
  );
const NOISE_A = noiseTile(0.9, 320);
const NOISE_B = noiseTile(1.4, 280);

/* Screen rectangle inside the cabinet PNG, expressed as % of the
   image. The cabinet PNG is 815×788 (cream-trimmed); the actual CRT
   screen area sits roughly in this rectangle. Tune these four
   numbers if the overlay drifts away from the bezel. */
const SCREEN = {
  left: "8.5%",
  top: "37%",
  width: "62.5%",
  height: "53%",
};

type Phase = "static" | "tune" | "on";

export function VintageTV({
  article,
  onOpen,
}: {
  article: NewsArticle | undefined;
  onOpen?: (a: NewsArticle) => void;
}) {
  const [phase, setPhase] = useState<Phase>("static");
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    if (!triggered) return;
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "static") {
      timer = setTimeout(() => setPhase("tune"), 1600);
    } else if (phase === "tune") {
      timer = setTimeout(() => setPhase("on"), 320);
    }
    // "on" — stays
    return () => clearTimeout(timer);
  }, [phase, triggered]);

  if (!article) return null;
  const img = article.imageUrl ? feedImageUrl(article.imageUrl) : null;
  const showArticle = phase === "on";
  const showStatic = phase === "static" || phase === "tune";

  const startTuneIn = () => {
    if (!triggered) setTriggered(true);
  };

  return (
    <div className="vtv-wrap" onMouseEnter={startTuneIn} onFocus={startTuneIn}>
      <div className="vtv-stage">
        {/* Cabinet photo — the entire body, antennas, dials, speaker
            grille are all in this single PNG */}
        <img
          src="/vintage-tv.png"
          alt=""
          aria-hidden
          className="vtv-cabinet"
          draggable={false}
        />

        {/* Screen overlay — clipped to the screen rectangle */}
        <div
          className="vtv-screen"
          style={{
            left: SCREEN.left,
            top: SCREEN.top,
            width: SCREEN.width,
            height: SCREEN.height,
          }}
          role={onOpen ? "button" : undefined}
          tabIndex={onOpen ? 0 : undefined}
          onClick={() => showArticle && onOpen?.(article)}
          onKeyDown={(e) => {
            if (onOpen && showArticle && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onOpen(article);
            }
          }}
        >
          {/* ── Article layer ── */}
          <div
            className={`vtv-art ${showArticle ? "is-on" : ""}`}
            aria-hidden={!showArticle}
          >
            {img && (
              <img
                src={img}
                alt={article.title}
                loading="lazy"
                className="vtv-art-img"
              />
            )}
            <div className="vtv-art-meta">
              <h3 className="vtv-art-title">{article.title}</h3>
            </div>
          </div>

          {/* ── Static layers (two tiles + horizontal band roll +
                 chromatic aberration) ── */}
          <div className={`vtv-static ${showStatic ? "is-on" : ""}`} aria-hidden>
            <div className="vtv-noise vtv-noise--a" />
            <div className="vtv-noise vtv-noise--b" />
            <div className="vtv-hsync" />
            <div className="vtv-roll" />
            <div className="vtv-chroma vtv-chroma--r" />
            <div className="vtv-chroma vtv-chroma--b" />
          </div>

          {/* ── Tune-in flash ── */}
          <div className={`vtv-flash ${phase === "tune" ? "is-on" : ""}`} aria-hidden />

          {/* ── Always-on CRT atmospherics ── */}
          <div className="vtv-scanlines" aria-hidden />
          <div className="vtv-glare" aria-hidden />
        </div>
      </div>

      <style>{`
        .vtv-wrap {
          position: relative;
          max-width: 420px;
          margin: 0 auto;
          padding: 56px 0 24px;
        }
        .vtv-stage {
          position: relative;
          width: 100%;
          aspect-ratio: 815 / 788;
        }
        .vtv-cabinet {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
          user-select: none;
          -webkit-user-drag: none;
          filter: drop-shadow(0 24px 30px rgba(40, 24, 8, 0.22));
        }

        /* ── The screen ── */
        .vtv-screen {
          position: absolute;
          overflow: hidden;
          background: #0a0a0c;
          /* Slight CRT bulge corner radius */
          border-radius: 18px / 14px;
          cursor: default;
          box-shadow: inset 0 0 18px rgba(0,0,0,0.55);
        }
        .vtv-screen:focus-visible {
          outline: 2px solid ${CREAM};
          outline-offset: 2px;
        }

        /* ── Article layer ── */
        .vtv-art {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.32s ease-out;
        }
        .vtv-art.is-on { opacity: 1; }
        .vtv-art-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          /* Subtle CRT tone: slight contrast bump + tiny green/blue */
          filter: contrast(1.06) saturate(1.08) brightness(0.95);
        }
        .vtv-art-meta {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          padding: 14px 16px 18px;
          background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 100%);
          color: #ffffff;
        }
        .vtv-art-eyebrow {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 10px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          opacity: 0.92;
          margin-bottom: 6px;
          color: #ffffff;
        }
        .vtv-art-title {
          margin: 0;
          font-family: 'Newsreader', serif;
          font-weight: 700;
          font-size: clamp(18px, 2.2vw, 26px);
          line-height: 1.18;
          color: #ffffff;
          text-shadow: 0 2px 6px rgba(0,0,0,0.55);
        }

        /* ── Static stack ── */
        .vtv-static {
          position: absolute;
          inset: 0;
          opacity: 1;
          transition: opacity 0.18s ease-out;
        }
        .vtv-static:not(.is-on) { opacity: 0; pointer-events: none; }

        .vtv-noise {
          position: absolute;
          inset: -6%;
          background-size: 220px 220px;
          will-change: background-position, opacity;
          mix-blend-mode: normal;
        }
        .vtv-noise--a {
          background-image: url("${NOISE_A}");
          opacity: 0.95;
          animation: vtv-noise-a 0.12s steps(4) infinite;
        }
        .vtv-noise--b {
          background-image: url("${NOISE_B}");
          opacity: 0.55;
          mix-blend-mode: overlay;
          animation: vtv-noise-b 0.14s steps(5) infinite;
        }
        @keyframes vtv-noise-a {
          0%   { background-position: 0 0; }
          25%  { background-position: 38% -22%; }
          50%  { background-position: -28% 34%; }
          75%  { background-position: 22% 28%; }
          100% { background-position: 0 0; }
        }
        @keyframes vtv-noise-b {
          0%   { background-position: 0 0; }
          33%  { background-position: -34% 22%; }
          66%  { background-position: 28% -30%; }
          100% { background-position: 0 0; }
        }

        /* Horizontal bands — the prominent dark/light streaks of CRT
           static. Slowly rolls vertically. */
        .vtv-hsync {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            rgba(20,20,24,0.55) 0px,
            rgba(20,20,24,0.55) 2px,
            rgba(220,220,225,0.35) 2px,
            rgba(220,220,225,0.35) 4px,
            rgba(80,80,86,0.40) 4px,
            rgba(80,80,86,0.40) 7px
          );
          mix-blend-mode: overlay;
          opacity: 0.85;
          animation: vtv-roll 2.4s linear infinite;
        }
        @keyframes vtv-roll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(14px); }
        }

        /* Occasional bright tear that sweeps vertically once every loop */
        .vtv-roll {
          position: absolute;
          left: 0; right: 0;
          height: 18%;
          top: -20%;
          background: linear-gradient(180deg,
            transparent 0%,
            rgba(255,255,255,0.10) 30%,
            rgba(255,255,255,0.32) 50%,
            rgba(255,255,255,0.10) 70%,
            transparent 100%);
          mix-blend-mode: screen;
          animation: vtv-tear 3.6s ease-in-out infinite;
        }
        @keyframes vtv-tear {
          0%, 70% { top: -20%; opacity: 0; }
          80%     { opacity: 1; }
          100%    { top: 110%; opacity: 0; }
        }

        /* Chromatic aberration — subtle red / blue horizontal smear
           characteristic of CRT static. */
        .vtv-chroma {
          position: absolute;
          inset: 0;
          mix-blend-mode: screen;
          opacity: 0.16;
          background-image: url("${NOISE_A}");
          background-size: 220px 220px;
          animation: vtv-noise-a 0.12s steps(4) infinite;
        }
        .vtv-chroma--r {
          filter: hue-rotate(0deg) saturate(2);
          transform: translateX(-1px);
          background-color: rgba(220, 40, 40, 0.18);
          background-blend-mode: multiply;
        }
        .vtv-chroma--b {
          filter: hue-rotate(180deg) saturate(2);
          transform: translateX(1px);
          background-color: rgba(40, 80, 220, 0.18);
          background-blend-mode: multiply;
        }

        /* ── Tune flash ── */
        .vtv-flash {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center,
            rgba(255,255,255,0.95) 0%,
            rgba(255,255,255,0.45) 40%,
            rgba(255,255,255,0) 75%);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.18s ease-out;
        }
        .vtv-flash.is-on { opacity: 1; }

        /* ── Always-on CRT atmospherics ── */
        .vtv-scanlines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            rgba(0,0,0,0.16) 0px,
            rgba(0,0,0,0.16) 1px,
            transparent 1px,
            transparent 3px
          );
          mix-blend-mode: multiply;
          opacity: 0.55;
        }
        .vtv-glare {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(ellipse at 25% 18%, rgba(255,255,255,0.10) 0%, transparent 40%),
            radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 108%);
        }

        @media (prefers-reduced-motion: reduce) {
          .vtv-noise,
          .vtv-hsync,
          .vtv-roll,
          .vtv-chroma { animation: none !important; }
          .vtv-art,
          .vtv-static,
          .vtv-flash { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
