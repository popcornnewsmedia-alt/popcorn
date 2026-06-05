/* ─────────────────────────────────────────────────────────────────────
   PopcornIntro — Volv-style cinematic title sequence

   Phase choreography (all single-shot, runs once per session):
     0.0s ── full-bleed black box covers the viewport
             ↳ background-image cycles through 8 category images at
               ~250ms (steps(1), no crossfade — hard cuts like a news
               projector).
             ↳ "POPCORN" set in 14vw Macabro display, white, sits over
               the flickering imagery.
     0.0–5.0s ── full-to-box: the viewport-sized box smoothly contracts
             to a 340 × 360 rounded rectangle (radius 0 → 44px).
     5.0–6.0s ── split: the box translates down ~96px while POPCORN
             rises ~140px, both on the same hard cubic-bezier (Volv's
             0.83/0/0.17/1) so they feel mechanically coupled.
     5.6–6.6s ── reveal: cream "POPCORN" cross-fades out, the
             Popcorn wordmark logo cross-fades in dead-centre with a
             tiny scale-up (0.94 → 1).
     6.8–7.4s ── the entire overlay washes out, the page below
             becomes interactive. Component unmounts on transitionend.

   Plays once per browser session (sessionStorage flag), respects
   prefers-reduced-motion, and renders nothing on the server.
   ───────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";

const BG = "#ffffff";        // white canvas — matches desktop paper
const INK_BLUE = "#042c85";  // brand blue, used for the Macabro POPCORN wordmark

/* The 8 category brand-tiles we keep in /public/category-images. They
   are 1024px-ish square PNGs with strong, distinct colour signatures
   — exactly the kind of high-contrast deck a hard-cut montage needs. */
const FRAMES = [
  "/category-images/Film-TV.png",
  "/category-images/Music.png",
  "/category-images/AI.png",
  "/category-images/Internet.png",
  "/category-images/Sports.png",
  "/category-images/Culture.png",
  "/category-images/World.png",
  "/category-images/Fashion.png",
  "/category-images/Tech.png",
  "/category-images/Gaming.png",
  "/category-images/Space.png",
];

const SESSION_KEY = "popcorn_intro_played_v1";

export function PopcornIntro({ onDone }: { onDone?: () => void }) {
  /* SSR-safe initial mount: only render after the first client render.
     `shouldShow` is initialised from a function so the sessionStorage
     read happens exactly once and skips the animation on subsequent
     navigations within the same session. */
  const [shouldShow, setShouldShow] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    // Reduced-motion users get the page immediately — no intro at all.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return !reduce;
  });

  /* Two-stage exit: `fadingOut` flips at the end of the choreography,
     `removed` flips after the fade transition completes and removes
     the overlay from the DOM (so pointer events return to the page). */
  const [fadingOut, setFadingOut] = useState(false);
  const [removed, setRemoved] = useState(false);
  const completedRef = useRef(false);

  /* Preload the montage images so the first cycle doesn't stutter.
     We use an in-memory Image() instead of <link rel=preload> so the
     overlay is truly self-contained and doesn't pollute <head>. */
  useEffect(() => {
    if (!shouldShow) return;
    FRAMES.forEach((src) => {
      const i = new Image();
      i.src = src;
    });
  }, [shouldShow]);

  /* Master timeline: shrink 0–5s, split 5–6s, logo lands ~6.6s, then
     the logo holds on screen for a full beat (~1.6s) before the
     overlay washes out — gives the brand a moment to register. */
  useEffect(() => {
    if (!shouldShow) return;
    const fadeAt = window.setTimeout(() => setFadingOut(true), 8200);
    const doneAt = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      sessionStorage.setItem(SESSION_KEY, "1");
      setRemoved(true);
      onDone?.();
    }, 8800);
    return () => {
      clearTimeout(fadeAt);
      clearTimeout(doneAt);
    };
  }, [shouldShow, onDone]);

  /* Allow Esc / click to skip — feels gracious to power users. */
  useEffect(() => {
    if (!shouldShow || removed) return;
    const skip = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      sessionStorage.setItem(SESSION_KEY, "1");
      setFadingOut(true);
      window.setTimeout(() => {
        setRemoved(true);
        onDone?.();
      }, 380);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shouldShow, removed, onDone]);

  if (!shouldShow || removed) return null;

  return (
    <div
      className={`pi-root ${fadingOut ? "is-fading" : ""}`}
      aria-hidden="true"
      onClick={() => {
        if (completedRef.current) return;
        completedRef.current = true;
        sessionStorage.setItem(SESSION_KEY, "1");
        setFadingOut(true);
        window.setTimeout(() => {
          setRemoved(true);
          onDone?.();
        }, 380);
      }}
    >
      {/* The flashing / shrinking box — the centre-piece. */}
      <div className="pi-box">
        <div className="pi-flash" />
        {/* Subtle vignette + scanline-ish grain inside the box keeps
            the montage feeling editorial rather than slideshow-cheap. */}
        <div className="pi-vignette" />
      </div>

      {/* The cream POPCORN wordmark — set in the same big serif we use
          across the desktop site, sits dead-centre during the shrink
          and floats upward at 5s. */}
      <div className="pi-title">POPCORN</div>

      {/* The final-state logo — invisible until ~5.6s, then it
          cross-fades into the centre of the resolved layout. */}
      <img
        className="pi-logo"
        src="/popcorn-logo.png"
        alt=""
        draggable={false}
      />

      <style>{`
        .pi-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: ${BG};
          overflow: hidden;
          cursor: pointer;
          /* The exit wash. Transition is gentle (0.6s ease-out) so
             the page underneath emerges rather than snaps. */
          transition: opacity 0.6s ease-out, visibility 0.6s ease-out;
        }
        .pi-root.is-fading {
          opacity: 0;
          pointer-events: none;
        }

        /* ── Flashing / shrinking box ── */
        .pi-box {
          position: absolute;
          top: 50%; left: 50%;
          width: 100vw; height: 100vh;
          background: #000;
          border-radius: 0px;
          transform: translate(-50%, -50%);
          overflow: hidden;
          will-change: width, height, border-radius, transform;
          animation:
            pi-shrink 5s cubic-bezier(0.66, 0, 0.16, 1) forwards,
            pi-move-down 1s cubic-bezier(0.83, 0, 0.17, 1) 5s forwards;
          /* A faint inner shadow appears as the box gets small so it
             reads as a physical card, not just a div. */
          box-shadow: 0 0 0 0 rgba(0,0,0,0);
        }

        /* The image cycler. Lives inside the box so it's clipped by
           the rounded corners as they form. background-attachment
           defaults to scroll which is what we want — as the parent
           shrinks, the image continues to cover the available space.
           steps(1) is the magic: no crossfade, just hard cuts. */
        .pi-flash {
          position: absolute;
          inset: 0;
          background-color: #000;
          background-position: center;
          background-repeat: no-repeat;
          background-size: cover;
          animation: pi-flash 2.75s steps(1) infinite;
          /* Sit slightly desaturated and just barely darker than the
             source — gives the whole sequence a tonal cohesion across
             six visually different category tiles. */
          filter: saturate(0.92) brightness(0.92) contrast(1.06);
        }

        .pi-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%),
            repeating-linear-gradient(
              0deg,
              rgba(0,0,0,0.06) 0px,
              rgba(0,0,0,0.06) 1px,
              transparent 1px,
              transparent 3px
            );
          mix-blend-mode: multiply;
          opacity: 0.65;
        }

        /* ── POPCORN headline ── */
        .pi-title {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          /* Macabro is Popcorn's house display face — condensed,
             all-caps, mast-head energy. Fallback to Anton (same
             condensed silhouette) then a generic sans. */
          font-family: 'Macabro', 'Anton', 'Impact', sans-serif;
          font-weight: 400;
          text-transform: uppercase;
          /* Big & responsive — Macabro is condensed so we can push
             the size noticeably larger than the serif version. */
          font-size: clamp(72px, 14vw, 220px);
          letter-spacing: 0.005em;
          line-height: 0.9;
          color: #ffffff;
          /* Soft dark halo keeps the white wordmark legible against
             the brightest frames in the montage (Internet / Film&TV). */
          text-shadow: 0 2px 22px rgba(0,0,0,0.45);
          will-change: transform, opacity;
          /* Three chained animations:
             (1) pi-title-shrink runs alongside the box's shrink so the
                 wordmark scales down at the same rate as the imagery,
                 ending tiny inside the small card.
             (2) pi-move-up lifts the (now-small) wordmark above the
                 settled card — same easing as the box's move-down.
             (3) pi-title-fade dissolves it just before the logo lands. */
          animation:
            pi-title-shrink 5s cubic-bezier(0.66, 0, 0.16, 1) forwards,
            pi-move-up 1s cubic-bezier(0.83, 0, 0.17, 1) 5s forwards,
            pi-title-fade 0.6s ease-out 5.6s forwards;
          user-select: none;
        }

        /* ── Final logo reveal ── */
        .pi-logo {
          position: absolute;
          top: 50%; left: 50%;
          width: clamp(120px, 14vw, 200px);
          height: auto;
          transform: translate(-50%, -50%) scale(0.94);
          opacity: 0;
          pointer-events: none;
          will-change: opacity, transform;
          /* Held until POPCORN starts to fade, then a clean 0.8s
             ease-out cross-fade with a hair of scale to feel like the
             logo "lands". */
          animation: pi-logo-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) 5.8s forwards;
          /* Crisp on hi-dpi without smearing. */
          image-rendering: -webkit-optimize-contrast;
        }

        /* ── Keyframes ── */
        @keyframes pi-shrink {
          from { width: 100vw; height: 100vh; border-radius: 0px; }
          to   { width: 340px;  height: 360px; border-radius: 44px; }
        }
        @keyframes pi-move-down {
          to { transform: translate(-50%, calc(-50% + 96px)); }
        }
        /* Scales the wordmark from 1.0 down to 0.22 over the 5s
           shrink. Keeps the transform compatible with the centring
           translate so the text stays dead-centre. */
        @keyframes pi-title-shrink {
          from { transform: translate(-50%, -50%) scale(1); }
          to   { transform: translate(-50%, -50%) scale(0.22); }
        }
        /* Lift the now-small wordmark above the settled card.
           Preserves the 0.22 scale so it doesn't snap back to full size. */
        @keyframes pi-move-up {
          from { transform: translate(-50%, -50%) scale(0.22); }
          to   { transform: translate(-50%, calc(-50% - 140px)) scale(0.22); }
        }
        @keyframes pi-title-fade {
          to { opacity: 0; }
        }
        @keyframes pi-logo-in {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.94); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1);    }
        }

        /* Hard cuts through all ${FRAMES.length} category tiles — each
           image holds ~250ms, the cycle runs ~2 full passes during the
           5s shrink. */
        @keyframes pi-flash {
          0%   { background-image: url("${FRAMES[0]}"); }
          9%   { background-image: url("${FRAMES[1]}"); }
          18%  { background-image: url("${FRAMES[2]}"); }
          27%  { background-image: url("${FRAMES[3]}"); }
          36%  { background-image: url("${FRAMES[4]}"); }
          45%  { background-image: url("${FRAMES[5]}"); }
          55%  { background-image: url("${FRAMES[6]}"); }
          64%  { background-image: url("${FRAMES[7]}"); }
          73%  { background-image: url("${FRAMES[8]}"); }
          82%  { background-image: url("${FRAMES[9]}"); }
          91%  { background-image: url("${FRAMES[10]}"); }
        }

        /* Once the box has resolved, dim the flashing imagery a touch
           so the logo reads as the sole focal point. This lives on the
           box itself so the inner image inherits the effect. */
        .pi-box::after {
          content: "";
          position: absolute;
          inset: 0;
          background: ${BG};
          opacity: 0;
          pointer-events: none;
          animation: pi-box-dim 0.8s ease-out 5.8s forwards;
        }
        @keyframes pi-box-dim {
          /* Fully opaque so the cycling imagery is completely hidden
             behind the white wash by the time the logo lands — no
             residual flicker bleeds through. */
          to { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .pi-root { display: none; }
        }
      `}</style>
    </div>
  );
}
