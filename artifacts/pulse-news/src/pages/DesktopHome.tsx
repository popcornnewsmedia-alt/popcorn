import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import type { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import { ChevronLeft, ChevronRight, Instagram } from "lucide-react";
import { format, startOfDay } from "date-fns";
import type { NewsArticle } from "@workspace/api-client-react";
import { useInfiniteNewsFeed } from "@/hooks/use-news";
import { useAuth } from "@/hooks/use-auth";
import { SavesContext, useSavesRoot } from "@/hooks/use-saves";
import { feedImageUrl } from "@/lib/image-url";
import { ArticleReader } from "@/components/ArticleReader";
import { DesktopAuthModal } from "@/components/desktop/DesktopAuthModal";
import { SignUpFlow } from "@/components/SignUpFlow";
import { SignInSheet } from "@/components/SignInSheet";
import { GrainBackground } from "@/components/GrainBackground";
import { PopcornIntro } from "@/components/PopcornIntro";

/* ─────────────────────────────────────────────────────────────────────
   Popcorn — Daily Edition (Desktop Web)
   Elephant-magazine-style collage. A single CSS-columns masonry of
   article images; titles are hidden by default and revealed on hover
   as a cream cover that dissolves over the image. Sprinkled through
   the grid: cream "feature" tiles for image-less stories, one
   POPCORN comic cover for a hero article, and one Instagram tile.

   Only rendered when useIsDesktopWeb() === true (viewport ≥ 1024px AND
   not Capacitor / installed PWA). Mobile + native code paths untouched.
   ───────────────────────────────────────────────────────────────────── */

/* ── Design tokens ─────────────────────────────────────────────────── */
const PAPER  = "#ffffff";
const CREAM  = "#f1ead9";              // handoff cream (cover + feature tiles)
const INK    = "#0a0a0a";
const INK2   = "#1a1a1a";
const MUTE   = "#6e6e6e";
const RULE   = "rgba(10,10,10,0.12)";
const HAIR   = "rgba(10,10,10,0.16)";

const BLUE      = "#042c85";           // app signature blue
const BLUE_DEEP = "#042c85";           // unified — single brand blue
const BLOCK_BLUE  = "#042c85";         // poster offset-block — blue
const BLOCK_BLACK = "#101010";         // poster offset-block — black

const SANS  = '"Helvetica Neue", Helvetica, Arial, Inter, sans-serif';
const SERIF = '"Bodoni Moda", "Didot", "Times New Roman", serif';

/* Editorial typography — headlines in Kepler3, genre/labels in HelveticaNowText
   (loaded via @font-face in index.css; graceful sans-serif fallback). */
const HEADLINE = '"Kepler3", "Kepler Std", sans-serif';
const GENRE    = '"HelveticaNowText", "Helvetica Now Text", "Helvetica Neue", Arial, sans-serif';

const MAX_W = 1480;

/* Category nav order — matches the handoff section nav. */
const SECTIONS: ReadonlyArray<{ key: string | null; label: string }> = [
  { key: null,         label: "Today" },
  { key: "Film & TV",  label: "Film & TV" },
  { key: "Music",      label: "Music" },
  { key: "Internet",   label: "Internet" },
  { key: "Culture",    label: "Culture" },
  { key: "Fashion",    label: "Fashion" },
  { key: "Tech",       label: "Tech" },
  { key: "AI",         label: "AI" },
  { key: "Gaming",     label: "Gaming" },
  { key: "Sports",     label: "Sport" },
  { key: "World",      label: "World" },
  { key: "Science",    label: "Science" },
  { key: "Books",      label: "Books" },
  { key: "Industry",   label: "Industry" },
];

/* Visual tile for each section in the category drop-panel. Eight categories
   have bespoke brand artwork in /public/category-images; the rest fall back
   to their genre gradient (mirrors CATEGORY_GRADIENTS in rss-enricher.ts) so
   the picker stays complete across all 14 sections. Keyed by label. */
const CATEGORY_TILE: Record<string, { img?: string; grad?: string }> = {
  "Today":     { grad: "linear-gradient(135deg,#042c85,#0a2a5e)" },
  "Film & TV": { img: "/category-images/Film-TV.png" },
  "Music":     { img: "/category-images/Music.png" },
  "Internet":  { img: "/category-images/Internet.png" },
  "Culture":   { img: "/category-images/Culture.png" },
  "Fashion":   { img: "/category-images/Fashion.png" },
  "Tech":      { img: "/category-images/Tech.png" },
  "AI":        { img: "/category-images/AI.png" },
  "Gaming":    { img: "/category-images/Gaming.png" },
  "Sport":     { img: "/category-images/Sports.png" },
  "World":     { img: "/category-images/World.png" },
  "Science":   { img: "/category-images/Space.png" },
  "Books":     { grad: "linear-gradient(135deg,#140e04,#382210)" },
  "Industry":  { grad: "linear-gradient(135deg,#111114,#28282e)" },
};

/* ─────────────────────────────────────────────────────────────────── */
/* ── Day grouping ──────────────────────────────────────────────── */
type DayGroup = { date: Date; id: string; articles: NewsArticle[] };

function groupByDay(articles: NewsArticle[]): DayGroup[] {
  const buckets = new Map<number, DayGroup>();
  for (const a of articles) {
    const ref = a.feedDate ? new Date(`${a.feedDate}T00:00:00`) : new Date(a.publishedAt);
    const d = startOfDay(ref);
    const key = d.getTime();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { date: d, id: `day-${key}`, articles: [] };
      buckets.set(key, bucket);
    }
    bucket.articles.push(a);
  }
  return Array.from(buckets.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

/* ─────────────────────────────────────────────────────────────────── */
/* ── Tile (the heart of the page) ──────────────────────────────── */

/* The cover overlay shared by all tiles. Bodoni Moda title at top,
   small-caps category + italic "Read →" at the bottom. The "sans"
   variant flips the title to Helvetica Neue 700 uppercase — used on
   ~30% of tiles for typographic variety. */
function TileCover({
  category,
  title,
  variant = "serif",
}: {
  category?: string;
  title: string;
  variant?: "serif" | "sans";
}) {
  return (
    <div className="ptile-cover">
      <div aria-hidden className="ptile-cover-grain">
        <GrainBackground variant="popcorn-cream-fcedd4" />
      </div>
      <h3 className={variant === "sans" ? "ptile-h ptile-h-sans" : "ptile-h"}>{title}</h3>
      <div className="ptile-foot">
        <div aria-hidden className="ptile-foot-grain">
          <GrainBackground variant="popcorn-blue" />
        </div>
        <span className="ptile-cat">{category || "Today"}</span>
        <span className="ptile-read">Read</span>
      </div>
    </div>
  );
}

/* A normal masonry tile: image cropped to a constrained aspect ratio so
   tiles stay "largely similar" in size across the feed (some squarer,
   some a touch taller / wider, but never one column dominating). The
   ratio is deterministic per article.id so re-renders don't reshuffle. */
const PHOTO_RATIOS: ReadonlyArray<string> = ["1/1", "4/5", "5/4", "9/10", "10/9"];

function photoRatioFor(id: string | number): string {
  const s = String(id);
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return PHOTO_RATIOS[Math.abs(hash) % PHOTO_RATIOS.length];
}

function PhotoTile({
  article,
  onOpen,
  coverVariant = "serif",
}: {
  article: NewsArticle;
  onOpen: () => void;
  coverVariant?: "serif" | "sans";
}) {
  const src = article.imageUrl ? feedImageUrl(article.imageUrl) : null;
  if (!src) {
    return (
      <FeatureTile article={article} onOpen={onOpen} coverVariant={coverVariant} />
    );
  }
  const ratio = photoRatioFor(article.id);
  return (
    <a
      className="ptile ptile-photo"
      href="#"
      style={{ aspectRatio: ratio }}
      onClick={(e) => { e.preventDefault(); onOpen(); }}
    >
      <img
        className="ptile-img"
        src={src}
        alt=""
        loading="lazy"
        draggable={false}
      />
      <TileCover
        category={article.category}
        title={article.title}
        variant={coverVariant}
      />
    </a>
  );
}

/* Image-less story → permanently cream "feature" tile with the title
   typeset on it. Aspect ratio randomised between 3/4, 1/1, and 4/5 per
   article id so the masonry doesn't get a row of identical squares. */
function FeatureTile({
  article,
  onOpen,
  coverVariant = "serif",
}: {
  article: NewsArticle;
  onOpen: () => void;
  coverVariant?: "serif" | "sans";
}) {
  const ar = useMemo(() => {
    const ratios = ["3/4", "1/1", "4/5"];
    // Stable per-article-id so re-renders don't reshuffle.
    let hash = 0;
    const s = String(article.id);
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
    return ratios[Math.abs(hash) % ratios.length];
  }, [article.id]);

  return (
    <a
      className="ptile ptile-feat"
      href="#"
      style={{ aspectRatio: ar }}
      onClick={(e) => { e.preventDefault(); onOpen(); }}
    >
      <TileCover
        category={article.category}
        title={article.title}
        variant={coverVariant}
      />
    </a>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ── POPCORN comic-cover tile — preserved styling, sized as a tile.
     One per feed, sits naturally inside the masonry column flow.   */

const PCC_NOISE =
  "data:image/svg+xml;charset=utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='280' height='280'>
       <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter>
       <rect width='100%' height='100%' filter='url(#n)'/>
     </svg>`
  );

function PopcornComicTile({
  article,
  onOpen,
}: {
  article: NewsArticle;
  onOpen: () => void;
}) {
  const img = article.imageUrl ? feedImageUrl(article.imageUrl) : null;
  return (
    <div
      className="ptile pcc-tile"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="pcc-card">
        {img && (
          <img
            src={img}
            alt={article.title}
            className="pcc-image"
            loading="lazy"
            draggable={false}
          />
        )}
        <div className="pcc-duotone" aria-hidden />
        <div className="pcc-wash" aria-hidden />
        <div className="pcc-grain" aria-hidden />
        <div className="pcc-vignette" aria-hidden />

        <div className="pcc-mast-row">
          <span className="pcc-mast">POPCORN</span>
        </div>

        <h3 className="pcc-headline">{article.title}</h3>
      </div>

      <style>{`
        .pcc-tile { display: block; break-inside: avoid; margin-bottom: 8px;
          width: 100%;
          position: relative; cursor: pointer; overflow: hidden; }
        .pcc-card {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          background: #042c85;
          isolation: isolate;
        }
        .pcc-image {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover;
          filter: contrast(1.08) saturate(0.92) brightness(0.96);
          z-index: 0;
          animation: pcc-img-press 11s ease-in-out infinite;
          will-change: filter, transform;
        }
        @keyframes pcc-img-press {
          0%   { filter: contrast(1.06) saturate(0.95) brightness(0.98); transform: scale(1.02) translate(0,    0); }
          50%  { filter: contrast(1.10) saturate(0.92) brightness(0.96); transform: scale(1.025) translate(-0.4%, 0.3%); }
          100% { filter: contrast(1.06) saturate(0.95) brightness(0.98); transform: scale(1.02) translate(0,    0); }
        }
        .pcc-duotone {
          position: absolute; inset: 0;
          background-image:
            radial-gradient(circle 3px at 14% 22%, rgba(255,250,232,0.95), transparent 70%),
            radial-gradient(circle 2px at 28% 68%, rgba(255,250,232,0.90), transparent 70%),
            radial-gradient(circle 4px at 42% 18%, rgba(255,250,232,1),    transparent 65%),
            radial-gradient(circle 2px at 56% 84%, rgba(255,250,232,0.85), transparent 70%),
            radial-gradient(circle 3px at 68% 32%, rgba(255,250,232,0.95), transparent 70%),
            radial-gradient(circle 2px at 82% 62%, rgba(255,250,232,0.88), transparent 70%),
            radial-gradient(circle 3px at 92% 14%, rgba(255,250,232,0.92), transparent 70%),
            radial-gradient(circle 2px at 8%  78%, rgba(255,250,232,0.86), transparent 70%),
            radial-gradient(circle 4px at 50% 50%, rgba(255,250,232,1),    transparent 60%),
            radial-gradient(circle 2px at 74% 76%, rgba(255,250,232,0.88), transparent 70%);
          mix-blend-mode: screen;
          animation: pcc-twinkle 3.6s ease-in-out infinite;
          z-index: 1; pointer-events: none;
        }
        @keyframes pcc-twinkle {
          0%, 100% { opacity: 0.35; transform: scale(0.92); filter: blur(0.4px); }
          25%      { opacity: 1;    transform: scale(1.10); filter: blur(0px);   }
          50%      { opacity: 0.55; transform: scale(0.98); filter: blur(0.6px); }
          75%      { opacity: 0.95; transform: scale(1.06); filter: blur(0.2px); }
        }
        .pcc-wash {
          position: absolute; inset: 0;
          background-image:
            radial-gradient(circle 2px at 20% 44%, rgba(255,250,232,0.92), transparent 70%),
            radial-gradient(circle 4px at 36% 30%, rgba(255,250,232,1),    transparent 65%),
            radial-gradient(circle 2px at 48% 70%, rgba(255,250,232,0.86), transparent 70%),
            radial-gradient(circle 3px at 62% 12%, rgba(255,250,232,0.94), transparent 70%),
            radial-gradient(circle 2px at 76% 48%, rgba(255,250,232,0.84), transparent 70%),
            radial-gradient(circle 3px at 88% 88%, rgba(255,250,232,0.92), transparent 70%),
            radial-gradient(circle 2px at 4%  38%, rgba(255,250,232,0.80), transparent 70%),
            radial-gradient(circle 3px at 32% 92%, rgba(255,250,232,0.88), transparent 70%),
            radial-gradient(circle 2px at 60% 56%, rgba(255,250,232,0.82), transparent 70%);
          mix-blend-mode: screen;
          animation: pcc-twinkle-b 4.4s ease-in-out infinite;
          animation-delay: -1.1s;
          z-index: 2; pointer-events: none;
        }
        @keyframes pcc-twinkle-b {
          0%, 100% { opacity: 0.90; transform: scale(1.08); filter: blur(0px);   }
          30%      { opacity: 0.30; transform: scale(0.94); filter: blur(0.6px); }
          55%      { opacity: 1;    transform: scale(1.12); filter: blur(0px);   }
          80%      { opacity: 0.45; transform: scale(0.96); filter: blur(0.4px); }
        }
        .pcc-grain {
          position: absolute; inset: -4%;
          background-image: url("${PCC_NOISE}");
          background-size: 240px 240px;
          opacity: 0.22; mix-blend-mode: overlay;
          animation: pcc-grain 0.16s steps(5) infinite;
          z-index: 3; pointer-events: none;
        }
        @keyframes pcc-grain {
          0%   { background-position: 0 0; }
          25%  { background-position: -40% 30%; }
          50%  { background-position: 30% -22%; }
          75%  { background-position: -18% -34%; }
          100% { background-position: 22% 26%; }
        }
        .pcc-vignette {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at center, transparent 55%, rgba(3, 12, 38, 0.55) 100%);
          z-index: 4; pointer-events: none;
        }
        .pcc-mast-row {
          position: absolute;
          top: clamp(14px, 1.8vw, 24px);
          left: clamp(14px, 1.8vw, 24px);
          right: clamp(14px, 1.8vw, 24px);
          z-index: 6;
          display: flex; align-items: baseline; justify-content: center;
          gap: 16px; color: #fff1cd;
        }
        .pcc-mast {
          font-family: 'Macabro', 'Bodoni Moda', serif; font-weight: 900;
          font-size: clamp(22px, 2.6vw, 38px); line-height: 0.82;
          letter-spacing: -0.014em; text-transform: uppercase;
          color: #ffffff; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
        }
        .pcc-headline {
          position: absolute;
          left: clamp(14px, 2vw, 24px);
          right: clamp(14px, 2vw, 24px);
          bottom: clamp(12px, 1.5vw, 20px);
          margin: 0; z-index: 6;
          text-align: center;
          font-family: 'Bodoni Moda', 'Newsreader', serif; font-weight: 600;
          font-size: clamp(13px, 1.1vw, 18px);
          line-height: 1.18; letter-spacing: -0.016em;
          color: #ffffff;
          text-shadow: 0 2px 14px rgba(0, 0, 0, 0.6);
        }
        .pcc-tile:hover .pcc-headline {
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 6px;
          text-decoration-color: rgba(255, 255, 255, 0.55);
        }
        @media (prefers-reduced-motion: reduce) {
          .pcc-image, .pcc-duotone, .pcc-wash, .pcc-grain { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ── Instagram tile — sized as a tile in the masonry. Blue + grain.
     Sits next to the other tiles like just another card.            */

function InstagramTile() {
  return (
    <a
      className="ptile ig-tile"
      href="https://instagram.com/popcornmedia"
      target="_blank"
      rel="noreferrer"
    >
      <div className="ig-card">
        <div aria-hidden className="ig-grain">
          <GrainBackground variant="popcorn-blue" />
        </div>
        <div className="ig-icon">
          <Instagram size={18} strokeWidth={1.6} />
        </div>
        <div className="ig-body">
          <span className="ig-cat">Follow Us</span>
          <h3 className="ig-h">@popcornmedia</h3>
          <p className="ig-p">
            <em>Today's pop on Instagram</em> — film, music, fashion, internet.
          </p>
        </div>
        <div className="ig-foot">
          <span className="ig-foot-cat">Instagram</span>
          <span className="ig-foot-read">Follow →</span>
        </div>
      </div>
      <style>{`
        .ig-tile { display: block; break-inside: avoid; margin-bottom: 8px;
          width: 100%;
          position: relative; cursor: pointer; overflow: hidden;
          text-decoration: none; }
        /* Full column width like every other tile in the masonry, with a
           portrait aspect ratio (4/5 — vertical sides longer than
           horizontal) so it reads as a tall brand pill rather than a
           square. */
        .ig-card { position: relative; width: 100%;
          aspect-ratio: 4/5;
          background: #042c85; color: #fff;
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 12px 12px 10px; isolation: isolate; }
        .ig-grain { position: absolute; inset: 0; opacity: 0.55;
          mix-blend-mode: overlay; pointer-events: none; z-index: 0; }
        .ig-icon { position: relative; z-index: 1; color: #fff; }
        .ig-cat { display: block; font-family: ${SANS}; font-size: 9.5px;
          letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600;
          color: rgba(255,255,255,0.65); margin-bottom: 6px; }
        .ig-body { position: relative; z-index: 1; }
        .ig-h { margin: 0; font-family: ${SERIF}; font-style: italic;
          font-weight: 500; font-size: clamp(17px, 1.5vw, 22px);
          font-variation-settings: "opsz" 28; line-height: 1.04;
          letter-spacing: -0.008em; color: #fff; }
        .ig-p { margin: 6px 0 0 0; font-family: ${SERIF}; font-size: 12px;
          line-height: 1.4; color: rgba(255,255,255,0.78); }
        .ig-p em { font-style: italic; }
        .ig-foot { position: relative; z-index: 1;
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 12px; }
        .ig-foot-cat { font-family: ${SANS}; font-size: 9.5px;
          letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600;
          color: rgba(255,255,255,0.85); }
        .ig-foot-read { font-family: ${SERIF}; font-style: italic;
          font-weight: 400; font-size: 12px;
          font-variation-settings: "opsz" 14;
          color: rgba(255,255,255,0.92); }
        .ig-tile:hover .ig-card { filter: brightness(1.06); }
      `}</style>
    </a>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ── PopcornIOSTicket — preserved CTA, lives above the footer ───── */

function PopcornIOSTicket() {
  return (
    <div className="relative group/ios mx-auto" style={{ maxWidth: 520, position: "relative" }}>
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none translate-x-[6px] translate-y-[8px] group-hover/ios:translate-x-[12px] group-hover/ios:translate-y-[14px] transition-transform duration-300 ease-out"
        style={{
          background: BLUE_DEEP,
          clipPath:
            "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))",
          willChange: "transform",
        }}
      />
      <a
        href="#"
        className="block relative transition-transform duration-300 ease-out group-hover/ios:-translate-x-[2px] group-hover/ios:-translate-y-[3px]"
        style={{
          textDecoration: "none",
          background: BLUE,
          clipPath:
            "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))",
          padding: "11px 11px 13px 11px",
          willChange: "transform",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: 0.55, mixBlendMode: "overlay" }}>
          <GrainBackground variant="popcorn-blue" />
        </div>

        <div
          className="relative"
          style={{
            background: "#FFFFFF",
            clipPath:
              "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
            padding: "20px 26px 22px",
            boxShadow: "inset 0 0 0 0.5px rgba(15,15,16,0.10)",
          }}
        >
          <svg
            aria-hidden
            width="18"
            height="26"
            viewBox="0 0 14 20"
            className="absolute"
            style={{ top: 18, right: 22, color: BLUE }}
          >
            <rect x="1" y="1" width="12" height="18" rx="2.4" ry="2.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <line x1="5" y1="3" x2="9" y2="3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            <circle cx="7" cy="16.6" r="0.7" fill="currentColor" />
          </svg>

          <div className="relative" style={{ paddingRight: 36 }}>
            <span
              className="inline-block pb-1"
              style={{
                fontFamily: SANS,
                fontSize: 10,
                letterSpacing: "0.42em",
                color: BLUE,
                textTransform: "uppercase",
                borderBottom: `1px solid ${BLUE}`,
              }}
            >
              On iPhone
            </span>

            <h4
              className="m-0"
              style={{
                marginTop: 10,
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: "clamp(20px, 1.6vw, 26px)",
                lineHeight: 1.18,
                color: INK,
                letterSpacing: "-0.018em",
              }}
            >
              Popcorn for iOS
            </h4>

            <p
              className="m-0"
              style={{
                marginTop: 6,
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: 14,
                lineHeight: 1.45,
                color: MUTE,
                letterSpacing: "-0.005em",
              }}
            >
              The day's culture, hand-curated — in your pocket.
            </p>

            <div
              className="inline-flex items-center gap-1.5"
              style={{
                marginTop: 12,
                fontFamily: SANS,
                fontSize: 10,
                letterSpacing: "0.42em",
                color: BLUE,
                textTransform: "uppercase",
              }}
            >
              <span className="group-hover/ios:underline decoration-1 underline-offset-[4px]">
                Download
              </span>
              <span
                aria-hidden
                className="transition-transform duration-300 ease-out group-hover/ios:translate-x-1"
                style={{ transform: "translateY(-1px)" }}
              >
                →
              </span>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ── Page chrome: Masthead / SectionNav / BrandMark / DateStrip / Footer */

function Masthead({
  onSignIn,
  user,
  onSignOut,
  group,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  layoutMode,
  onSetLayout,
}: {
  onSignIn: () => void;
  user: any;
  onSignOut: () => void;
  group?: DayGroup;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  layoutMode: "classic" | "drag";
  onSetLayout: (m: "classic" | "drag") => void;
}) {
  const dateLabel = group ? format(group.date, "EEEE, do MMMM") : "—";
  const navBtnStyle = (enabled: boolean) => ({
    background: "transparent",
    border: 0,
    padding: 0,
    cursor: enabled ? ("pointer" as const) : ("default" as const),
    color: enabled ? "#fff" : "rgba(255,255,255,0.35)",
    display: "flex",
    alignItems: "center",
  });
  return (
    <header
      style={{
        background: INK,
        color: "#fff",
        position: "relative",
        isolation: "isolate",
        overflow: "hidden",
      }}
    >
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 140% at 50% 0%, rgba(255,255,255,0.08), transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          padding: "16px 32px",
        }}
      >
        {/* Left: date label + day chevrons. Typography matches Sign In. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            justifySelf: "start",
          }}
        >
          <button onClick={onPrev} disabled={!hasPrev} aria-label="Previous day" style={navBtnStyle(hasPrev)}>
            <ChevronLeft size={14} strokeWidth={1.8} />
          </button>
          <span
            style={{
              fontFamily: "'Macabro', serif",
              fontSize: 11.5,
              letterSpacing: "0.06em",
              fontWeight: 400,
              color: "#fff",
            }}
          >
            {dateLabel}
          </span>
          <button onClick={onNext} disabled={!hasNext} aria-label="Next day" style={navBtnStyle(hasNext)}>
            <ChevronRight size={14} strokeWidth={1.8} />
          </button>
        </div>

        <a
          href="#"
          aria-label="Popcorn"
          style={{
            fontFamily: "'Macabro', 'Bodoni Moda', serif",
            fontWeight: 400,
            letterSpacing: "0.02em",
            fontSize: 30,
            lineHeight: 1,
            color: "#fff",
            textDecoration: "none",
            textTransform: "uppercase",
            justifySelf: "center",
          }}
        >
          POPCORN
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 24, justifyContent: "flex-end" }}>
          {/* Layout toggle — Grid (classic) ⇄ Drag (horizontal rail). */}
          <div
            role="group"
            aria-label="Layout"
            style={{
              display: "flex", alignItems: "center",
              border: "1px solid rgba(255,255,255,0.4)", borderRadius: 999,
              overflow: "hidden",
            }}
          >
            {(["classic", "drag"] as const).map((m) => {
              const active = layoutMode === m;
              return (
                <button
                  key={m}
                  onClick={() => onSetLayout(m)}
                  aria-pressed={active}
                  style={{
                    background: active ? "#fff" : "transparent",
                    color: active ? BLUE : "rgba(255,255,255,0.85)",
                    border: 0, cursor: "pointer", padding: "5px 12px",
                    fontFamily: SANS, fontSize: 9.5, letterSpacing: "0.18em",
                    textTransform: "uppercase", fontWeight: 600,
                    transition: "background .2s ease, color .2s ease",
                  }}
                >
                  {m === "classic" ? "Grid" : "Drag"}
                </button>
              );
            })}
          </div>
          {user ? (
            <button
              onClick={onSignOut}
              style={{
                background: "transparent", border: 0, color: "#fff",
                fontFamily: "'Macabro', serif", fontSize: 11.5, letterSpacing: "0.06em",
                fontWeight: 400, cursor: "pointer",
                padding: 0, display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span>Sign out</span>
              <span aria-hidden>↗</span>
            </button>
          ) : (
            <button
              onClick={onSignIn}
              style={{
                background: "transparent", border: 0, color: "#fff",
                fontFamily: "'Macabro', serif", fontSize: 11.5, letterSpacing: "0.06em",
                fontWeight: 400, cursor: "pointer",
                padding: 0, display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span>Sign in</span>
              <span aria-hidden>↗</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function SectionNav({
  selectedCategory,
  onSelect,
  rightSlot,
}: {
  selectedCategory: string | null;
  onSelect: (c: string | null) => void;
  rightSlot?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const current = SECTIONS.find((s) => s.key === selectedCategory) ?? SECTIONS[0];

  // Esc closes the strip.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Collapse the white filter bar once the reader has scrolled a little way
  // down — keeps only the masthead pinned. The CSS transition handles the
  // smooth slide; hysteresis (collapse >64, restore <24) avoids flicker at
  // the threshold. The open category drawer is tucked away alongside it.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        setCollapsed((c) => (c ? y > 200 : y > 340));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  // A collapsed bar shouldn't leave the drawer floating on its own.
  useEffect(() => {
    if (collapsed) setOpen(false);
  }, [collapsed]);

  return (
    <nav className={`pcd-secnav ${collapsed ? "is-collapsed" : ""}`}>
      <div className="pcd-secnav-bar">
        <button
          type="button"
          className={`pcd-secnav-btn ${selectedCategory ? "has-label" : ""}`}
          aria-expanded={open}
          aria-label="Browse categories"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="pcd-secnav-btn__icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
          </span>
          {selectedCategory && <span className="pcd-secnav-btn__cur">{current.label}</span>}
          <span className={`pcd-secnav-btn__chev ${open ? "is-open" : ""}`} aria-hidden>▾</span>
        </button>
        {selectedCategory && (
          <button
            type="button"
            className="pcd-secnav-clear"
            onClick={() => { onSelect(null); setOpen(false); }}
          >
            Clear ✕
          </button>
        )}
        {rightSlot && <div className="pcd-secnav-ad">{rightSlot}</div>}
        <img
          className="pcd-secnav-logoR"
          src="/logo-website-better-contrast-nobg.png"
          alt="Popcorn"
        />
      </div>

      <div className={`pcd-catdrawer ${open ? "is-open" : ""}`}>
        <div className="pcd-catstrip">
          {SECTIONS.filter((s) => s.key !== null).map((s) => {
            const tile = CATEGORY_TILE[s.label] ?? {};
            const isActive = selectedCategory === s.key;
            return (
              <button
                key={String(s.key) + s.label}
                type="button"
                className={`pcd-chip ${isActive ? "is-active" : ""}`}
                style={tile.img ? undefined : { background: tile.grad }}
                onClick={() => { onSelect(s.key); setOpen(false); }}
              >
                {tile.img && <img src={tile.img} alt="" draggable={false} loading="lazy" />}
                <span className="pcd-chip__label">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {open && (
        <div className="pcd-catpanel-scrim" aria-hidden onClick={() => setOpen(false)} />
      )}
    </nav>
  );
}

function BrandMark() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 0,
        padding: "4px 36px 0",
        maxWidth: MAX_W,
        margin: "0 auto",
        marginBottom: -12,
      }}
    >
      <img
        src="/logo-website-contrast.png"
        alt="Popcorn"
        style={{ height: 140, width: "auto", display: "block" }}
      />
    </div>
  );
}

function DateStrip({
  group,
  count,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  group?: DayGroup;
  count: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const dateLabel = group ? format(group.date, "EEEE, MMMM d") : "—";
  return (
    <div
      className="pcd-datestrip"
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "0 36px 2px",
        maxWidth: MAX_W,
        margin: "0 auto",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous day"
          style={{
            background: "transparent", border: 0, padding: 0,
            cursor: hasPrev ? "pointer" : "default",
            color: hasPrev ? INK : "rgba(10,10,10,0.25)",
            display: "flex", alignItems: "center",
          }}
        >
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: 20,
            fontWeight: 400,
            fontVariationSettings: '"opsz" 24',
            color: INK,
          }}
        >
          {dateLabel}
        </span>
        <button
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next day"
          style={{
            background: "transparent", border: 0, padding: 0,
            cursor: hasNext ? "pointer" : "default",
            color: hasNext ? INK : "rgba(10,10,10,0.25)",
            display: "flex", alignItems: "center",
          }}
        >
          <ChevronRight size={20} strokeWidth={1.6} />
        </button>
      </div>
      <span
        style={{
          fontFamily: SANS,
          fontSize: 11,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: MUTE,
          fontWeight: 500,
        }}
      >
        {count} {count === 1 ? "story" : "stories"} · today's pop
      </span>
    </div>
  );
}

function Footer() {
  return (
    <footer
      style={{
        background: BLUE,
        color: "#fff",
        padding: "80px 36px 32px",
        position: "relative",
        isolation: "isolate",
        marginTop: 80,
        overflow: "hidden",
      }}
    >
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.55, mixBlendMode: "overlay", pointerEvents: "none", zIndex: 0 }}>
        <GrainBackground variant="popcorn-blue" />
      </div>
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(80% 100% at 50% 0%, rgba(255,255,255,0.06), transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div
        className="pcd-foot-top"
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
          gap: 64,
          maxWidth: MAX_W,
          margin: "0 auto",
        }}
      >
        <div>
          <span
            style={{
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 64,
              letterSpacing: "0.04em",
              lineHeight: 0.9,
              color: "#fff",
              display: "block",
            }}
          >
            POPCORN
          </span>
          <p
            style={{
              margin: "18px 0 0",
              maxWidth: "34ch",
              fontFamily: SANS,
              fontSize: 14,
              color: "rgba(255,255,255,0.78)",
              lineHeight: 1.55,
            }}
          >
            A daily edition of culture — film, music, fashion, internet, tech and the
            stories the algorithms missed. Curated every morning in Bangkok.
          </p>
          <img
            src="/logo-website-contrast.png"
            alt=""
            aria-hidden
            style={{
              height: 96,
              marginTop: 28,
              display: "block",
              filter: "brightness(0) invert(1)",
            }}
          />
        </div>

        <FooterColumn
          title="Sections"
          items={["Film & TV", "Music", "Internet", "Culture", "Fashion", "Tech"]}
        />

        <FooterColumn
          title="Popcorn"
          items={["About", "Editorial standards", "Contact", "Press"]}
        />

        <div>
          <h5
            style={{
              fontFamily: SANS,
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              margin: "0 0 18px",
            }}
          >
            Newsletter
          </h5>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 14,
              color: "rgba(255,255,255,0.78)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            One email, every morning. Today's pop in your inbox before coffee.
          </p>
          <form
            onSubmit={(e) => e.preventDefault()}
            style={{
              display: "flex",
              marginTop: 12,
              border: "1px solid rgba(255,255,255,0.4)",
              background: "transparent",
            }}
          >
            <input
              type="email"
              placeholder="you@email.com"
              style={{
                flex: 1,
                background: "transparent",
                border: 0,
                padding: "10px 12px",
                fontSize: 13,
                outline: "none",
                color: "#fff",
                fontFamily: SANS,
              }}
            />
            <button
              type="submit"
              style={{
                background: "#fff",
                color: BLUE,
                border: 0,
                padding: "10px 16px",
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: SANS,
              }}
            >
              Join
            </button>
          </form>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: MAX_W,
          margin: "56px auto 0",
          paddingTop: 22,
          borderTop: "1px solid rgba(255,255,255,0.22)",
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          fontSize: 10.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.65)",
          fontWeight: 500,
          fontFamily: SANS,
          flexWrap: "wrap",
        }}
      >
        <span>© Popcorn Media {new Date().getFullYear()}</span>
        <span>Bangkok · London · New York</span>
        <span>
          <a href="#" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>Privacy</a>
          {" · "}
          <a href="#" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>Terms</a>
          {" · "}
          <a href="https://instagram.com/popcornmedia" target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>Instagram</a>
        </span>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <h5
        style={{
          fontFamily: SANS,
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "rgba(255,255,255,0.6)",
          margin: "0 0 18px",
        }}
      >
        {title}
      </h5>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it) => (
          <li key={it}>
            <a href="#" style={{ fontFamily: SANS, fontSize: 14, color: "#fff", textDecoration: "none" }}>
              {it}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ── Page-level CSS (collage + tile hover + responsive) ────────── */

const PAGE_CSS = `
  /* Collage container — CSS columns masonry */
  .collage {
    max-width: 1067px;
    margin: 0 auto;
    padding: 0 36px 80px;
    column-count: 4;
    column-gap: 8px;
  }
  @media (max-width: 1480px) { .collage { column-count: 4; max-width: 85%; } }
  @media (max-width: 1280px) { .collage { column-count: 3; } }
  @media (max-width: 980px)  { .collage { column-count: 2; } }
  @media (max-width: 680px)  { .collage { column-count: 2; column-gap: 6px; } }
  @media (max-width: 1080px) {
    .collage { padding-left: 24px; padding-right: 24px; }
    .pcd-secnav-inner { padding-left: 24px; padding-right: 24px; }
    .pcd-datestrip { padding-left: 24px; padding-right: 24px; }
    .pcd-foot-top { grid-template-columns: 1fr 1fr; gap: 40px; }
  }
  @media (max-width: 640px) {
    .collage { padding-left: 18px; padding-right: 18px; }
    .pcd-secnav-inner { overflow-x: auto; flex-wrap: nowrap; white-space: nowrap; justify-content: flex-start; padding-left: 18px; padding-right: 18px; }
    .pcd-datestrip { flex-direction: column; align-items: flex-start; padding-left: 18px; padding-right: 18px; }
    .pcd-foot-top { grid-template-columns: 1fr; gap: 32px; }
  }

  /* Normal tile */
  .ptile {
    position: relative;
    break-inside: avoid;
    width: 100%;
    margin: 0 0 8px;
    display: block;
    cursor: pointer;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
  }
  .ptile-img {
    width: 100%;
    height: auto;
    display: block;
    transition: opacity .4s ease, transform .6s ease;
  }
  /* Photo tile — aspect ratio comes from inline style on the <a>.
     Image is cropped (object-fit: cover) so every tile is constrained
     to one of a small set of near-square ratios, keeping the masonry
     "largely similar" without flattening it. */
  .ptile-photo { overflow: hidden; }
  .ptile-photo .ptile-img {
    width: 100%; height: 100%; object-fit: cover;
  }
  .ptile-cover {
    position: absolute;
    inset: 0;
    background: ${CREAM};
    color: ${INK};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 22px 22px 22px;
    opacity: 0;
    transition: opacity .35s ease;
    pointer-events: none;
    isolation: isolate;
    overflow: hidden;
  }
  .ptile-cover-grain {
    position: absolute; inset: 0;
    opacity: 0.6;
    pointer-events: none;
    z-index: 0;
  }
  .ptile-h {
    position: relative; z-index: 1;
    margin: 0;
    font-family: ${HEADLINE};
    font-weight: 500;
    font-variation-settings: "opsz" 36;
    letter-spacing: -0.008em;
    line-height: 1.04;
    font-size: clamp(20px, 1.6vw, 26px);
    text-wrap: balance;
    color: ${INK};
  }
  .ptile-h-sans {
    font-family: ${SANS};
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: -0.005em;
    line-height: 1.04;
  }
  .ptile-foot {
    position: relative; z-index: 2;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    background: ${BLUE};
    margin: 0;
    padding: 22px 18px 22px;
    isolation: isolate;
    overflow: hidden;
  }
  .ptile-foot-grain {
    position: absolute; inset: 0;
    opacity: 0.55; mix-blend-mode: overlay;
    pointer-events: none; z-index: 0;
  }
  .ptile-cat {
    position: relative; z-index: 1;
    font-family: ${GENRE};
    font-size: 10.5px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 600;
    color: #fff;
  }
  .ptile-read {
    position: relative; z-index: 1;
    font-family: ${SERIF};
    font-style: italic;
    font-weight: 400;
    font-size: 14px;
    font-variation-settings: "opsz" 16;
    color: #fff;
  }
  .ptile-read::after { content: " →"; font-style: normal; }

  /* Hover: image fades out, cover fades in */
  .ptile:hover .ptile-img  { opacity: 0; }
  .ptile:hover .ptile-cover{ opacity: 1; }

  /* Permanently-cream feature tile (no image) */
  .ptile-feat .ptile-cover { opacity: 1; }
  .ptile-feat:hover { filter: brightness(0.96); }

  /* Comic + IG tiles don't use the hover-reveal mechanic — they're
     always visible since they ARE the cover. */
  .pcc-tile:hover .ptile-img,
  .pcc-tile:hover .ptile-cover,
  .ig-tile:hover  .ptile-img,
  .ig-tile:hover  .ptile-cover { opacity: initial; }
`;

/* ─────────────────────────────────────────────────────────────────── */
/* ── New editorial layout CSS — 12-col grid + lead + sections ─── */

const NOISE_DATA_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

const EDITORIAL_CSS = `
  /* 12-col grid main feed */
  .feed {
    max-width: 1240px;
    margin: 0 auto;
    padding: 16px 36px 96px;
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    column-gap: 30px;
    row-gap: 44px;
  }

  /* Section header */
  .sec-head {
    grid-column: 1 / -1;
    display: flex; align-items: center; gap: 18px;
    padding: 8px 0 0; margin-top: -16px;
  }
  .sec-head:first-child { margin-top: 0; }
  .sec-head h2 {
    font-family: ${SANS}; font-size: 11px;
    letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600;
    color: ${INK}; margin: 0; white-space: nowrap;
  }
  .sec-head .bar { flex: 1; border-top: 1px solid ${INK}; height: 0; margin-top: 2px; }

  /* Card system */
  .card { display: flex; flex-direction: column; gap: 14px;
    align-items: center; text-align: center;
    cursor: pointer; position: relative; text-decoration: none; color: inherit; }
  .card .img { overflow: hidden; background: #eee; position: relative; }
  .card .img img { width: 100%; height: 100%; object-fit: cover; display: block;
    transition: transform .7s cubic-bezier(.22,.61,.36,1), filter .5s ease; }
  .card:hover .img img { transform: scale(1.03); }

  /* VIEW STORY pill on every card */
  .card .img::after {
    content: "View story \\2197";
    position: absolute; bottom: 12px; right: 14px;
    font-family: ${SANS}; font-size: 10px; font-weight: 600;
    letter-spacing: 0.2em; text-transform: uppercase; color: #fff;
    padding: 7px 12px; background: ${BLUE};
    transform: translateY(8px); opacity: 0;
    transition: transform .35s cubic-bezier(.22,.61,.36,1), opacity .35s ease;
    z-index: 3; pointer-events: none;
  }
  .card:hover .img::after { transform: translateY(0); opacity: 1; }

  /* Meta row */
  .card .meta { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .card .meta .cat {
    font-family: ${GENRE}; font-size: 11px;
    letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600;
    color: ${MUTE};
  }
  .card .meta .bar { display: none; }
  .card .meta .arr { display: none; }

  /* Spans */
  .sp-3 { grid-column: span 3; }
  .sp-4 { grid-column: span 4; }
  .sp-6 { grid-column: span 6; }

  /* Aspect ratios */
  .ar-4-5 .img { aspect-ratio: 4/5; }
  .ar-1-1 .img { aspect-ratio: 1/1; }
  .ar-3-2 .img { aspect-ratio: 3/2; }
  .ar-3-4 .img { aspect-ratio: 3/4; }

  /* Headline */
  .card .title {
    font-family: ${HEADLINE}; font-weight: 500;
    font-variation-settings: "opsz" 36;
    letter-spacing: -0.008em; line-height: 1.04;
    font-size: clamp(20px, 1.6vw, 26px);
    color: ${INK}; margin: 0; text-wrap: balance;
    max-width: 24ch;
  }
  .card .title em { font-style: normal; font-weight: inherit; }

  /* Editors' Picks — centered editorial card */
  .pick-card {
    display: flex; flex-direction: column; align-items: center;
    text-align: center; text-decoration: none; color: inherit; cursor: pointer;
  }
  .pick-card .pick-img {
    position: relative; width: 100%; aspect-ratio: 4/5;
    overflow: hidden; background: #eee; margin-bottom: 18px;
  }
  .pick-card .pick-img img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    filter: grayscale(0.32) contrast(1.04);
    transform: scale(1);
    transition: transform .7s cubic-bezier(.22,.61,.36,1), filter .7s ease;
  }
  .pick-card:hover .pick-img img { transform: scale(1.04); filter: grayscale(0) contrast(1); }
  .pick-card .pick-img__ph { position: absolute; inset: 0; background: ${CREAM}; }
  .pick-card .pick-cat {
    font-family: ${GENRE}; font-size: 11px; font-weight: 600;
    letter-spacing: 0.22em; text-transform: uppercase; color: ${MUTE};
    margin-bottom: 9px;
  }
  .pick-card .pick-title {
    font-family: ${HEADLINE}; font-weight: 500;
    font-variation-settings: "opsz" 28;
    letter-spacing: -0.006em; line-height: 1.08;
    font-size: clamp(18px, 1.4vw, 23px);
    color: ${INK}; margin: 0; max-width: 22ch; text-wrap: balance;
  }
  .pick-card .pick-title em { font-style: normal; font-weight: inherit; }

  /* Per-section hover anims */
  .anim-pick .img::before {
    content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
    background: ${BLUE}; transform-origin: left; transform: scaleX(0);
    transition: transform .55s cubic-bezier(.22,.61,.36,1);
    z-index: 3; pointer-events: none;
  }
  .anim-pick:hover .img::before { transform: scaleX(1); }
  .anim-pick:hover .img img { transform: scale(1.04); }

  .anim-screen .img .bar-top,
  .anim-screen .img .bar-bot {
    position: absolute; left: 0; right: 0; height: 0;
    background: ${INK}; z-index: 3; pointer-events: none;
    transition: height .45s cubic-bezier(.22,.61,.36,1);
  }
  .anim-screen .img .bar-top { top: 0; }
  .anim-screen .img .bar-bot { bottom: 0; }
  .anim-screen:hover .img .bar-top,
  .anim-screen:hover .img .bar-bot { height: 7%; }
  .anim-screen:hover .img img { transform: scale(1.04); filter: contrast(1.04); }
  /* Screen & Sound — slightly smaller images than the rest of the feed. */
  .anim-screen .img,
  .anim-screen .title { max-width: 70%; margin-left: auto; margin-right: auto; }

  .anim-signal .img::before {
    content: ""; position: absolute; inset: 0;
    background-image: repeating-linear-gradient(0deg,
      transparent 0px, transparent 3px,
      rgba(4,44,133,0.12) 3px, rgba(4,44,133,0.12) 4px);
    z-index: 2; pointer-events: none;
    opacity: 0; transition: opacity .35s ease;
  }
  .anim-signal:hover .img::before { opacity: 1; }
  .anim-signal:hover .img img { transform: scale(1.02); filter: hue-rotate(-8deg) contrast(1.04); }

  .anim-sport:hover .img img {
    animation: sport-snap .55s cubic-bezier(.22,.61,.36,1) 1 forwards;
  }
  @keyframes sport-snap {
    0%   { transform: scale(1)    translateX(0);  filter: blur(0); }
    25%  { transform: scale(1.05) translateX(-3px); filter: blur(1.5px); }
    55%  { transform: scale(1.03) translateX(2px);  filter: blur(0); }
    100% { transform: scale(1.03) translateX(0);  filter: blur(0); }
  }

  /* No-image variant — cream tile */
  .card.feat .img {
    display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 24px;
    background: ${CREAM}; color: ${INK}; position: relative;
  }
  .card.feat .img .feat-title {
    font-family: ${HEADLINE}; font-weight: 500;
    font-variation-settings: "opsz" 36;
    letter-spacing: -0.008em; line-height: 1.04;
    font-size: clamp(20px, 1.6vw, 26px);
    margin: 0; text-wrap: balance;
  }
  .card.feat .img .feat-title em { font-style: normal; font-weight: inherit; }
  .card.feat .title { display: none; }

  /* Lead story — 8/4 split */
  .lead {
    grid-column: 1 / -1;
    display: grid; grid-template-columns: 8fr 4fr; gap: 32px;
    align-items: center; padding: 0; cursor: pointer;
    text-decoration: none; color: inherit;
  }
  .lead .img-wrap {
    aspect-ratio: 16/9; overflow: hidden;
    background: #eee; position: relative;
  }
  .lead .img-wrap img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    filter: grayscale(0.35) contrast(1.05);
    transform: scale(1);
    transition: transform .7s cubic-bezier(.22,.61,.36,1), filter .7s ease;
  }
  .lead:hover .img-wrap img {
    transform: scale(1.03);
    filter: grayscale(0) contrast(1);
  }
  .lead .img-wrap::after {
    content: "View story \\2197";
    position: absolute; bottom: 14px; right: 16px;
    font-family: ${SANS}; font-size: 10px; font-weight: 600;
    letter-spacing: 0.2em; text-transform: uppercase; color: #fff;
    padding: 8px 13px; background: ${BLUE};
    transform: translateY(8px); opacity: 0;
    transition: transform .4s cubic-bezier(.22,.61,.36,1), opacity .4s ease;
    z-index: 2;
  }
  .lead:hover .img-wrap::after { transform: translateY(0); opacity: 1; }
  .lead .txt { display: flex; flex-direction: column; gap: 22px; padding-right: 8px; }
  .lead .txt .meta { display: flex; align-items: center; gap: 10px; }
  .lead .txt .cat {
    font-family: ${GENRE}; font-size: 11px;
    letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600;
    color: ${MUTE};
  }
  .lead .txt .bar { flex: 1; border-top: 2px solid ${CREAM}; height: 0; margin-top: 2px; }
  .lead .txt .title {
    font-family: ${HEADLINE}; font-weight: 500;
    font-variation-settings: "opsz" 36;
    letter-spacing: -0.008em; line-height: 1.04;
    font-size: clamp(26px, 2.4vw, 40px);
    margin: 0; text-wrap: balance; color: ${INK};
  }
  .lead .txt .title em { font-style: normal; font-weight: inherit; }
  .lead .txt .dek {
    font-family: ${SANS}; font-size: 15.5px; line-height: 1.55;
    color: ${INK2}; max-width: 42ch; margin: 0;
  }
  @media (max-width: 1080px) {
    .lead { grid-template-columns: 1fr; gap: 20px; }
  }

  /* Magazine cover card */
  .cover-wrap { perspective: 1400px; grid-column: span 4; }
  @media (max-width: 1080px) { .cover-wrap { grid-column: span 6; } }
  @media (max-width: 640px)  { .cover-wrap { grid-column: span 6; } }
  .cover-card {
    position: relative; cursor: pointer; overflow: hidden;
    background: #222; aspect-ratio: 3/4; display: block;
    max-width: 86%; margin: 0 auto;
    transform-style: preserve-3d;
    transition: transform .6s cubic-bezier(.22,.61,.36,1),
                box-shadow .6s ease, filter .6s ease;
    text-decoration: none; color: inherit;
  }
  .cover-card:hover {
    transform: translateY(-8px) rotateY(-5deg) rotateX(2deg);
    box-shadow: 0 32px 60px -22px rgba(4,44,133,0.55),
                0 12px 24px -10px rgba(0,0,0,0.25);
  }
  .cover-card img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    transition: transform .8s cubic-bezier(.22,.61,.36,1), filter .55s ease;
  }
  .cover-card:hover img { transform: scale(1.04); filter: brightness(0.97) saturate(1.05); }
  .cover-card::after {
    content: ""; position: absolute; inset: 0; z-index: 4;
    background: linear-gradient(108deg,
      transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%);
    background-size: 250% 250%;
    background-position: -150% 50%;
    pointer-events: none;
    transition: background-position 1s cubic-bezier(.22,.61,.36,1);
  }
  .cover-card:hover::after { background-position: 250% 50%; }
  .cover-card::before {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg,
      rgba(0,0,0,0.55) 0%, transparent 28%,
      transparent 58%, rgba(0,0,0,0.75) 100%);
    pointer-events: none; z-index: 1;
  }
  .cover-card .cover-top {
    position: absolute; top: 0; left: 0; right: 0;
    z-index: 2; padding: 18px 16px 16px; color: #fff;
    display: flex; flex-direction: column; gap: 0;
    align-items: stretch; text-align: center;
  }
  .cover-card .cover-top .wm {
    font-family: "Macabro", "Bodoni Moda", "Didot", serif; font-weight: 400;
    font-size: clamp(28px, 3.4vw, 48px); letter-spacing: 0.02em;
    line-height: 0.9;
    display: flex; justify-content: space-between; align-items: baseline; width: 100%;
  }
  .cover-card .cover-top .wm > span { display: inline-block; flex: 0 0 auto; }
  .cover-card .cover-bot {
    position: absolute; bottom: 0; left: 0; right: 0;
    z-index: 2; padding: 20px 16px; color: #fff;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    text-align: center;
    transform: translateY(0);
    transition: transform .5s cubic-bezier(.22,.61,.36,1);
  }
  .cover-card:hover .cover-bot { transform: translateY(-6px); }
  .cover-card .cover-bot .cat {
    font-family: ${GENRE}; font-size: 9.5px;
    letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600;
    color: #fff; opacity: 0.85;
  }
  .cover-card .cover-bot .cover-title {
    font-family: "Neue Haas Grotesk Display Pro", "Neue Haas Grotesk",
      "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-weight: 600;
    letter-spacing: -0.012em; line-height: 1.08;
    font-size: clamp(15px, 1.2vw, 19px);
    margin: 0; text-wrap: balance; color: #fff;
  }
  .cover-card .cover-bot .cover-title em { font-style: normal; font-weight: inherit; }

  /* IG tile placement in 12-col grid */
  .ig-grid-slot { grid-column: span 3; }
  .ig-grid-slot .ig-tile { margin-bottom: 0; }

  /* Dynamic app-download ad band — full-width inside the grid */
  .app-promo {
    grid-column: 1 / -1;
    display: grid; grid-template-columns: 1.15fr 1fr;
    min-height: 300px; overflow: hidden;
    border: 1px solid ${RULE};
  }
  .app-promo__flick {
    position: relative; overflow: hidden; background: #111;
  }
  .app-promo__flick img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; opacity: 0;
    filter: grayscale(0.2) contrast(1.06);
  }
  .app-promo__flick img.is-on { opacity: 1; }
  .app-promo__flick-grain {
    position: absolute; inset: 0; opacity: 0.4;
    mix-blend-mode: overlay; pointer-events: none; z-index: 2;
  }
  .app-promo__cta {
    position: relative; isolation: isolate;
    background: ${BLUE}; color: #fff;
    display: flex; flex-direction: column; justify-content: center;
    gap: 14px; padding: 40px 44px;
  }
  .app-promo__cta-grain {
    position: absolute; inset: 0; opacity: 0.5;
    mix-blend-mode: overlay; pointer-events: none; z-index: 0;
  }
  .app-promo__cta > *:not(.app-promo__cta-grain) { position: relative; z-index: 1; }
  .app-promo__kicker {
    font-family: ${SANS}; font-size: 10.5px; font-weight: 600;
    letter-spacing: 0.24em; text-transform: uppercase;
    color: rgba(255,255,255,0.7);
  }
  .app-promo__title {
    font-family: ${HEADLINE}; font-weight: 500;
    font-variation-settings: "opsz" 40;
    letter-spacing: -0.01em; line-height: 1.02;
    font-size: clamp(28px, 2.6vw, 40px);
    margin: 0; color: #fff; text-wrap: balance;
  }
  .app-promo__title em { font-style: italic; font-weight: inherit; }
  .app-promo__sub {
    font-family: ${SANS}; font-size: 14.5px; line-height: 1.5;
    color: rgba(255,255,255,0.82); margin: 0; max-width: 34ch;
  }
  .app-promo__btn {
    align-self: flex-start; margin-top: 8px;
    font-family: ${SANS}; font-size: 11px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: ${BLUE}; background: #fff;
    padding: 13px 22px; text-decoration: none;
    transition: transform .3s cubic-bezier(.22,.61,.36,1), opacity .3s ease;
  }
  .app-promo__btn:hover { transform: translateY(-2px); opacity: 0.92; }
  @media (max-width: 1080px) {
    .app-promo { grid-template-columns: 1fr; }
    .app-promo__flick { min-height: 220px; }
  }

  /* ── Instagram follow pill — centred band near the foot of the page ── */
  .ig-bottom {
    max-width: 168px; margin: 8px auto 0; padding: 0 36px;
  }
  @media (max-width: 640px) {
    .ig-bottom { padding: 0 18px; }
  }
  /* ── Horizontal app-download banner at the top of the feed ──
     Scrolls with the page in normal flow (no sticky). */
  .promo-top {
    grid-column: 1 / -1;
    position: relative;
    height: 128px; overflow: hidden;
    background: ${INK}; border: 1px solid ${RULE};
    border-left: none; border-right: none;
    margin-left: calc(50% - 50vw);
    margin-right: calc(50% - 50vw);
  }
  .promo-top__flick {
    position: absolute; inset: 0;
    opacity: 1; transition: opacity .9s ease;
  }
  /* Crossfade: the montage gently dissolves as the lockup resolves. */
  .promo-top.is-resolved .promo-top__flick { opacity: 0; }
  .promo-top__flick img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; opacity: 0; filter: grayscale(0.2) contrast(1.06);
  }
  .promo-top__flick img.is-on { opacity: 1; }
  .promo-top__grain {
    position: absolute; inset: 0; opacity: 0.4;
    mix-blend-mode: overlay; pointer-events: none; z-index: 2;
  }
  /* Resolved Download CTA — crossfades in over the montage once the
     flicker stops. Covers the whole banner. */
  .promo-top__cta {
    position: absolute; inset: 0;
    background: ${INK}; color: #fff;
    display: flex; align-items: center; justify-content: center;
    gap: 36px; padding: 0 32px;
    opacity: 0; pointer-events: none;
    transition: opacity .9s ease;
  }
  .promo-top.is-resolved .promo-top__cta { opacity: 1; pointer-events: auto; }
  .promo-top__wordmark {
    font-family: "Macabro", "Bodoni Moda", "Didot", serif; font-weight: 400;
    font-size: clamp(34px, 3.4vw, 52px); letter-spacing: 0.04em;
    text-transform: uppercase; color: #fff; line-height: 1;
    transform: translateY(8px); opacity: 0;
    transition: transform .9s cubic-bezier(.22,.61,.36,1), opacity .9s ease;
  }
  .promo-top.is-resolved .promo-top__wordmark {
    transform: translateY(0); opacity: 1;
  }
  .promo-top__btn {
    flex: 0 0 auto; text-align: center;
    font-family: ${SANS}; font-size: 11px; font-weight: 700;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: ${INK}; background: #fff; padding: 14px 24px; text-decoration: none;
    transition: transform .3s cubic-bezier(.22,.61,.36,1), opacity .3s ease;
  }
  .promo-top__btn:hover { transform: translateY(-2px); opacity: 0.92; }
  @media (max-width: 640px) {
    .promo-top { height: 100px; }
    .promo-top__cta { gap: 18px; padding: 0 18px; }
    .promo-top__wordmark { letter-spacing: 0.1em; }
  }

  /* ── Horizontal app-download strip (sticky to viewport bottom) ──
     Trails the bottom of the screen as you scroll, then releases above
     the footer once its natural slot reaches the bottom. */
  .promo-strip-zone {
    position: relative; max-width: ${MAX_W}px;
    margin: 0 auto; padding: 0 8px 24px;
  }
  .promo-strip {
    position: sticky; bottom: 16px;
    height: 132px; overflow: hidden;
    background: ${INK}; border: 1px solid ${RULE};
  }
  .promo-strip__flick { position: absolute; inset: 0; }
  .promo-strip__flick img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; opacity: 0; filter: grayscale(0.2) contrast(1.06);
  }
  .promo-strip__flick img.is-on { opacity: 1; }
  .promo-strip__cta {
    position: absolute; inset: 0; background: ${INK}; color: #fff;
    display: flex; align-items: center; justify-content: center; gap: 30px;
    padding: 0 32px;
    opacity: 0; pointer-events: none; transition: opacity .55s ease;
  }
  .promo-strip__cta.is-resolved { opacity: 1; pointer-events: auto; }
  .promo-strip__logo { height: 80px; width: auto; display: block; }
  .promo-strip__tag {
    font-family: ${HEADLINE}; font-weight: 500;
    font-size: clamp(18px, 1.6vw, 25px); letter-spacing: -0.006em;
    color: #fff;
  }
  .promo-strip__btn {
    flex: 0 0 auto; text-align: center;
    font-family: ${SANS}; font-size: 11px; font-weight: 700;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: ${INK}; background: #fff; padding: 14px 24px; text-decoration: none;
    transition: transform .3s cubic-bezier(.22,.61,.36,1), opacity .3s ease;
  }
  .promo-strip__btn:hover { transform: translateY(-2px); opacity: 0.92; }
  @media (max-width: 640px) {
    .promo-strip { height: 110px; }
    .promo-strip__cta { gap: 16px; padding: 0 18px; }
    .promo-strip__tag { display: none; }
    .promo-strip__logo { height: 60px; }
  }

  /* Sticky top bar — masthead + category nav scroll with the page, then
     pin to the top together as one unit. */
  .pcd-stickytop { position: sticky; top: 0; z-index: 50; }

  /* ── Category filter: button → collapsible horizontal image strip ── */
  .pcd-secnav {
    position: relative; z-index: 40;
    background: ${PAPER};
  }
  /* The white filter bar slides closed smoothly as the page scrolls. */
  .pcd-secnav-bar {
    position: relative; z-index: 42;
    display: flex; align-items: center; justify-content: flex-start; gap: 14px;
    padding: 10px 36px; max-width: ${MAX_W}px; margin: 0 auto;
    max-height: 168px; overflow: hidden;
    transition: max-height .72s cubic-bezier(.22,.61,.36,1),
                padding-top .72s cubic-bezier(.22,.61,.36,1),
                padding-bottom .72s cubic-bezier(.22,.61,.36,1),
                opacity .5s ease;
  }
  /* The app ad is absolutely positioned, so it can't push the bar taller on
     its own. When it's present (drag mode), give the bar a matching min-height
     so the taller ad isn't clipped by overflow:hidden. */
  .pcd-secnav-bar:has(.pcd-secnav-ad) { min-height: 84px; }
  /* Brand logo parked at the left edge of the filter bar. */
  .pcd-secnav-logo { height: 92px; width: 92px; display: block; flex-shrink: 0; object-fit: cover; object-position: center; }
  /* Brand logo pinned to the left edge; its auto right-margin pushes the filter button to the right.
     Negative vertical margins let it stay large without expanding the bar (keeps the bottom rule high).
     align-self:center keeps it vertically centered against the filter button. */
  .pcd-secnav-logoR { order: -1; height: 90px; width: auto; display: block; flex-shrink: 0; align-self: center; margin: -32px auto -32px 36px; transform: translateY(3px); }
  .pcd-secnav.is-collapsed .pcd-secnav-bar {
    max-height: 0; min-height: 0; padding-top: 0; padding-bottom: 0;
    opacity: 0; pointer-events: none;
  }
  .pcd-secnav-btn {
    display: inline-flex; align-items: center; gap: 10px;
    font-family: ${GENRE}; font-size: 12px; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase; color: ${INK};
    background: none; border: 1px solid ${INK}; border-radius: 999px;
    padding: 9px; cursor: pointer;
    /* margin-right nudges the button's center under "Sign in" in the topnav above. */
    margin-right: 8px;
    transition: background .22s ease, color .22s ease;
  }
  .pcd-secnav-btn.has-label { padding: 9px 16px; }
  .pcd-secnav-btn__cur { line-height: 1; }
  .pcd-secnav-btn:hover { background: ${INK}; color: ${PAPER}; }
  .pcd-secnav-btn__icon { display: inline-flex; align-items: center; justify-content: center; }
  .pcd-secnav-btn__icon svg { display: block; }
  .pcd-secnav-btn__chev { font-size: 10px; transition: transform .3s ease; }
  .pcd-secnav-btn__chev.is-open { transform: rotate(180deg); }
  .pcd-secnav-clear {
    font-family: ${SANS}; font-size: 11px; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase; color: ${MUTE};
    background: none; border: none; cursor: pointer; padding: 6px 4px;
    transition: color .2s ease;
  }
  .pcd-secnav-clear:hover { color: ${INK}; }

  /* Collapsible drawer holding the horizontal scroll strip. */
  .pcd-catdrawer {
    position: relative; z-index: 41;
    max-height: 0; overflow: hidden;
    transition: max-height .42s cubic-bezier(.22,.61,.36,1);
  }
  .pcd-catdrawer.is-open {
    max-height: 220px;
    border-top: 1px solid ${RULE};
    box-shadow: 0 20px 44px rgba(0,0,0,0.10);
  }
  .pcd-catstrip {
    display: flex; align-items: center; gap: 12px;
    padding: 16px 36px; max-width: ${MAX_W}px; margin: 0 auto;
    overflow-x: auto; overflow-y: hidden;
    scroll-behavior: smooth; -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .pcd-catstrip::-webkit-scrollbar { display: none; }
  .pcd-chip {
    position: relative; flex: 0 0 auto; width: 186px; height: 104px;
    overflow: hidden; cursor: pointer; border: none; padding: 0; display: block;
    background: #111;
    transition: transform .3s cubic-bezier(.22,.61,.36,1);
  }
  .pcd-chip:hover { transform: translateY(-3px); }
  .pcd-chip img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; transition: transform .5s ease;
  }
  .pcd-chip:hover img { transform: scale(1.06); }
  .pcd-chip::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0) 64%);
  }
  .pcd-chip__label {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 2;
    font-family: ${SANS}; font-size: 12px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase; color: #fff;
    text-align: left; padding: 11px 13px; line-height: 1.1;
  }
  .pcd-chip.is-active { outline: 2px solid ${BLUE}; outline-offset: -2px; }
  .pcd-catpanel-scrim { position: fixed; inset: 0; z-index: 39; background: transparent; }
  @media (max-width: 640px) {
    .pcd-catstrip { padding-left: 18px; padding-right: 18px; }
  }

  /* Responsive */
  @media (max-width: 1080px) {
    .feed { row-gap: 48px; column-gap: 18px; padding-left: 24px; padding-right: 24px; }
    .sp-3 { grid-column: span 4; }
    .sp-4 { grid-column: span 6; }
    .sp-6 { grid-column: span 12; }
    .ig-grid-slot { grid-column: span 6; }
  }
  @media (max-width: 640px) {
    .feed { grid-template-columns: repeat(6, 1fr); row-gap: 36px;
      padding-left: 18px; padding-right: 18px; }
    .sp-3 { grid-column: span 3; }
    .sp-4, .sp-6 { grid-column: span 6; }
    .ig-grid-slot { grid-column: span 6; }
  }
`;

/* ── DRAG_CSS — scoped styles for the experimental horizontal rail ──
   Ported from Popcorn - Drag.html. Every class is prefixed `drag-` to avoid
   collisions with EDITORIAL_CSS (.slide/.frame/.cap/.cover/.marker/.idx/...).
   The mockup's --blue/--ink/--mute/--paper map to our existing tokens; fonts
   use Archivo (--drag-sans) + Bricolage Grotesque (--drag-display). */
const DRAG_CSS = `
  /* In drag mode the page owns the viewport — no vertical scroll; the rail
     scrolls horizontally instead. Topnav stays pinned at the top. */
  .pcd-page.is-drag { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  .pcd-page.is-drag .pcd-stickytop { flex: 0 0 auto; position: static; border-bottom: 1px solid ${RULE}; }
  .pcd-page.is-drag .drag-shell { flex: 1 1 auto; min-height: 0; }

  .drag-shell {
    --drag-sans: "Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif;
    --drag-display: "Bricolage Grotesque", "Archivo", "Helvetica Neue", sans-serif;
    position: relative;
    display: flex; flex-direction: column; height: 100%;
    font-family: var(--drag-sans); color: ${INK}; background: ${PAPER};
  }

  /* ── STAGE — the draggable horizontal field ── */
  .drag-stage {
    position: relative; flex: 1 1 auto; min-height: 0;
    overflow-x: auto; overflow-y: hidden; cursor: grab;
    scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: auto;
  }
  .drag-stage::-webkit-scrollbar { display: none; }
  .drag-stage.is-drag { cursor: grabbing; }
  .drag-stage.is-drag * { pointer-events: none; }

  .drag-rail {
    display: flex; align-items: center; height: 100%;
    gap: clamp(40px, 4vw, 72px);
    /* bottom clearance lifts the centered slides clear of the floating
       control deck so captions never tuck under it */
    padding: 0 max(36px, 2.5vw) 92px; width: max-content;
  }

  /* ── INTRO panel ── */
  .drag-intro {
    flex: 0 0 auto; align-self: center; height: 72%; display: flex; flex-direction: column;
    justify-content: center; gap: 20px;
    width: min(32vw, 420px);
    background: #042c85; color: #fff;
    padding: clamp(20px, 2.6vh, 38px) clamp(24px, 2.2vw, 40px);
    position: relative; isolation: isolate; overflow: hidden;
  }
  .drag-intro__grain { position: absolute; inset: 0; opacity: 0.55; mix-blend-mode: overlay; pointer-events: none; z-index: 0; }
  .drag-intro > :not(.drag-intro__grain) { position: relative; z-index: 1; }
  .drag-intro__edition {
    display: flex; align-items: center; gap: 14px;
    font-size: 10.5px; letter-spacing: 0.3em; text-transform: uppercase;
    font-weight: 600; color: rgba(255,255,255,0.72);
  }
  .drag-intro__edition::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.28); }
  .drag-intro__tag {
    font-weight: 500; font-size: clamp(18px, 1.7vw, 24px);
    line-height: 1.25; letter-spacing: -0.01em; color: #fff;
    margin: 0; max-width: 26ch; text-wrap: balance;
  }
  .drag-intro__tag em { font-style: normal; font-weight: 700; color: #fff; }
  .drag-intro__hint {
    display: flex; align-items: center; gap: 12px; margin-top: 6px;
    font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
    font-weight: 700; color: #fff;
  }
  .drag-intro__hint .track {
    position: relative; width: 74px; height: 1px; background: rgba(255,255,255,0.3); overflow: hidden;
  }
  .drag-intro__hint .track::after {
    content: ""; position: absolute; top: 0; left: -40%;
    width: 40%; height: 100%; background: #fff;
    animation: draghint 1.9s cubic-bezier(.6,0,.3,1) infinite;
  }
  @keyframes draghint { 0% { left: -40%; } 100% { left: 100%; } }

  /* ── SLIDE — composed rhythm: image on top, category + headline below.
     Variation is intentional, not random: a tuned measure varies image
     HEIGHT (tight band), ASPECT (shape interest) and a gentle vertical
     FLOAT (translateY) so the rail reads as a syncopated editorial ribbon.
     Captions stay constant (centered, below) so the eye keeps an anchor. ── */
  /* Every slide is a 3-row grid: a slim caption band on top, the image, then
     flexible slack below. Images hang from a shared top line, but each slide
     carries a gentle per-slide vertical offset (--drag-off) so the rail reads
     as a soft editorial stagger — generally aligned, never flush. Heights vary
     by quality. The category and headline straddle the image on OPPOSITE sides:
     when the category sits in the top band the headline sits below, and vice
     versa — alternating slide to slide. */
  /* Flex column (not grid): the image is the only flexible element, so when a
     headline needs three lines the IMAGE yields height and the captions are
     never pushed past the rail edges. Captions sit on opposite sides of the
     photo via flex order, alternating slide to slide. */
  .drag-slide {
    flex: 0 0 auto; height: 100%; box-sizing: border-box;
    display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
    padding: 2.2vh 0;
  }
  /* Only the IMAGE carries the float offset, so it staggers gently. transform
     doesn't affect flow, so the stagger can never push a caption off-edge. */
  /* The frame keeps its gentle vertical float (--drag-off) AND a small resting
     tilt (--rot); both compose in one transform. On hover the tilt straightens
     while the float is preserved. */
  .drag-frame {
    order: 2; flex: 0 1 auto; min-height: 0; margin: 22px 0;
    position: relative; overflow: hidden; background: #ededed; display: block;
    transform: translateY(var(--drag-off, 0px)) rotate(var(--rot, 0deg));
    box-shadow: 0 26px 50px -30px rgba(20,18,16,0.55);
    transition: transform .5s cubic-bezier(.22,.61,.36,1), box-shadow .5s ease;
  }
  .drag-slide:hover .drag-frame { transform: translateY(var(--drag-off, 0px)) rotate(0deg); }
  /* Captions track the FRAME width (width:0 + min-width:100% means they never
     expand the slide past its image), so every slide hugs its photo and the
     gaps between articles read evenly regardless of image aspect/size. */
  .drag-cat, .drag-title { width: 0; min-width: 100%; flex: 0 0 auto; }
  .drag-cat.is-top, .drag-title.is-top       { order: 1; }
  .drag-cat.is-bottom, .drag-title.is-bottom { order: 3; }
  .drag-frame img {
    width: 100%; height: 100%; object-fit: cover;
    transition: transform .8s cubic-bezier(.22,.61,.36,1), filter .5s ease;
  }
  .drag-slide:hover .drag-frame img { transform: scale(1.04); }

  /* poster-style offset colour-blocks — a hard, blur-less box-shadow that sits
     down-right of the photo; tightens toward the photo on hover. No tilt. The
     extra right margin keeps the block from eating into the gap to the next
     article, so spacing stays even. */
  .drag-slide.pop, .drag-slide.pop2, .drag-slide.pop3 { margin-right: 18px; }
  .drag-slide.pop  .drag-frame { box-shadow: 18px 18px 0 ${CREAM}; }
  .drag-slide.pop2 .drag-frame { box-shadow: 18px 18px 0 ${BLOCK_BLUE}; }
  .drag-slide.pop3 .drag-frame { box-shadow: 18px 18px 0 ${BLOCK_BLACK}; }
  .drag-slide.pop:hover  .drag-frame { box-shadow: 10px 10px 0 ${CREAM}; }
  .drag-slide.pop2:hover .drag-frame { box-shadow: 10px 10px 0 ${BLOCK_BLUE}; }
  .drag-slide.pop3:hover .drag-frame { box-shadow: 10px 10px 0 ${BLOCK_BLACK}; }

  /* height band — driven by image QUALITY (qualityClass), never collapsing
     to a weak thumbnail. Sharper/higher-res photos sit notably taller. */
  .drag-slide.d-tall  .drag-frame { height: 57vh; }
  .drag-slide.d-mid   .drag-frame { height: 44vh; }
  .drag-slide.d-short .drag-frame { height: 33vh; }
  /* shape — landscape-dominant: a wide 3/2 and a gentler 4/3 carry the rail,
     with only an occasional square, so frames read as horizontal rectangles
     on average rather than vertical slivers */
  .drag-slide.ar-xw .drag-frame { aspect-ratio: 16/9; }
  .drag-slide.ar-w  .drag-frame { aspect-ratio: 3/2; }
  .drag-slide.ar-l  .drag-frame { aspect-ratio: 4/3; }
  .drag-slide.ar-sq .drag-frame { aspect-ratio: 1/1; }
  .drag-slide.ar-t  .drag-frame { aspect-ratio: 4/5; }

  /* text feature frame when an article has no image */
  .drag-frame.is-feat {
    background: ${CREAM}; display: flex; align-items: center; justify-content: center;
    padding: 28px; box-shadow: none; border: 1px solid ${RULE};
  }
  .drag-feat-title {
    font-family: var(--drag-display); font-weight: 700; text-transform: uppercase;
    text-align: center; line-height: 1.04; letter-spacing: -0.01em;
    font-size: clamp(20px, 1.6vw, 28px); color: ${INK}; margin: 0; text-wrap: balance;
  }

  .drag-frame::after {
    content: "View story ↗"; position: absolute; bottom: 13px; right: 14px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
    color: #fff; padding: 7px 12px; background: ${BLUE};
    transform: translateY(8px); opacity: 0;
    transition: transform .35s cubic-bezier(.22,.61,.36,1), opacity .35s ease;
    z-index: 3; pointer-events: none;
  }
  .drag-frame.is-feat::after, .drag-cover .drag-frame::after, .drag-lead .drag-frame::after { content: none; }
  .drag-slide:hover .drag-frame::after { transform: translateY(0); opacity: 1; }

  .drag-cat {
    font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: ${BLUE}; display: flex; align-items: center; justify-content: flex-start; gap: 9px;
    margin-bottom: 10px;
  }
  .drag-cat::before { content: ""; width: 22px; height: 2px; background: ${BLUE}; flex: 0 0 auto; }
  .drag-title {
    font-family: "Bricolage Grotesque", sans-serif;
    font-weight: 600; letter-spacing: -0.005em; text-align: left;
    line-height: 1.05; margin: 0; color: ${INK}; text-wrap: balance;
    font-size: clamp(21px, 1.7vw, 27px);
  }

  /* ── LEAD slide ── */
  .drag-lead { position: relative; }
  .drag-lead .drag-frame { height: 95%; aspect-ratio: 16/11; }
  .drag-lead .drag-frame::before {
    content: ""; position: absolute; inset: 0; z-index: 2;
    background: linear-gradient(0deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 42%, transparent 70%);
    pointer-events: none;
  }
  .drag-lead-cap {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 3;
    padding: clamp(26px, 2.6vw, 46px); color: #fff;
    display: flex; flex-direction: column; gap: 14px; pointer-events: none;
  }
  .drag-lead-cap .tag {
    display: inline-flex; align-items: center; gap: 9px;
    font-size: 10.5px; letter-spacing: 0.24em; text-transform: uppercase;
    font-weight: 700; color: #cdd9f0;
  }
  .drag-lead-cap .tag::before { content: ""; width: 26px; height: 2px; background: #cdd9f0; }
  .drag-lead-cap h2 {
    font-family: var(--drag-display); font-weight: 700; letter-spacing: -0.01em;
    text-transform: uppercase; line-height: 1.0; font-size: clamp(28px, 2.9vw, 46px);
    margin: 0; max-width: 20ch; text-wrap: balance;
  }
  .drag-lead-cap p { margin: 0; max-width: 48ch; font-size: 15.5px; line-height: 1.5; color: rgba(255,255,255,0.78); }

  /* ── COVER slide (magazine) ── */
  .drag-cover { position: relative; }
  .drag-cover .drag-frame { height: 87%; aspect-ratio: 3/4; background: #222; }
  .drag-cover .drag-frame::before {
    content: ""; position: absolute; inset: 0; z-index: 1;
    background: linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 58%, rgba(0,0,0,0.78) 100%);
    pointer-events: none;
  }
  .drag-cv-top { position: absolute; top: 0; left: 0; right: 0; z-index: 2; padding: 15px 14px; }
  .drag-cv-top .wm {
    font-weight: 900; font-size: clamp(30px, 3vw, 46px); letter-spacing: -0.01em;
    line-height: 0.9; color: #fff; display: flex; justify-content: space-between;
  }
  .drag-cv-bot { position: absolute; bottom: 0; left: 0; right: 0; z-index: 2; padding: 20px 18px; color: #fff; display: flex; flex-direction: column; gap: 8px; }
  .drag-cv-bot .cat { font-size: 9.5px; letter-spacing: 0.24em; text-transform: uppercase; font-weight: 700; opacity: 0.85; }
  .drag-cv-bot .title {
    font-family: var(--drag-display); font-weight: 600; letter-spacing: -0.005em;
    text-transform: uppercase; line-height: 1.0; font-size: clamp(16px, 1.2vw, 21px); margin: 0; text-wrap: balance;
  }

  /* ── Kept panels: app ad + IG pill ── */
  /* App-download ad lives inside the category-filter bar (shares its divider
     line), centered in the bar. */
  .pcd-secnav-ad { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; }
  .pcd-secnav-ad .promo-top { position: relative; top: auto; grid-column: auto; height: 64px; width: 740px; max-width: 60vw; margin: 0; }
  .pcd-secnav-ad .promo-top__cta { gap: 22px; }
  .pcd-secnav-ad .promo-top__wordmark { font-size: clamp(16px, 1.4vw, 22px); white-space: nowrap; text-transform: none; letter-spacing: 0.01em; }
  .pcd-secnav-ad .promo-top__btn { padding: 9px 16px; font-size: 10px; }
  .drag-ig { flex: 0 0 auto; width: 300px; display: flex; flex-direction: column; justify-content: center; }
  .drag-ig .ig-bottom, .drag-ig .ptile { margin: 0; }

  /* ── END panel ── */
  .drag-end {
    flex: 0 0 auto; height: 100%; display: flex; flex-direction: column;
    justify-content: center; gap: 18px; width: min(38vw, 460px); padding-left: clamp(10px, 2vw, 40px);
  }
  .drag-end h3 { font-family: var(--drag-display); font-weight: 800; letter-spacing: -0.02em; line-height: 1.0; font-size: clamp(28px, 2.6vw, 42px); margin: 0; max-width: 14ch; }
  .drag-end p { margin: 0; color: ${MUTE}; max-width: 34ch; font-size: 14.5px; line-height: 1.55; }
  .drag-end form { display: flex; border: 1px solid ${INK}; max-width: 340px; }
  .drag-end input { flex: 1; border: 0; padding: 11px 13px; font-size: 13px; outline: none; font-family: var(--drag-sans); }
  .drag-end button[type="submit"] { background: ${INK}; color: #fff; border: 0; padding: 11px 18px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; cursor: pointer; }
  .drag-end .back {
    font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700;
    color: ${BLUE}; cursor: pointer; display: inline-flex; gap: 8px; align-items: center;
    background: none; border: 0; padding: 0; font-family: var(--drag-sans);
  }

  /* ── CONTROLS — frosted shelf ──
     Full-width footer: a translucent paper base rising from the bottom with a
     real backdrop blur on top, both masked so the frost dissolves smoothly
     into the paper at the top edge — no hard seam. The pager sits on the
     shelf: ghost chevrons, a hairline seek line with a ringed dot, a tabular
     index. ── */
  .drag-controls {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 30;
    display: flex; align-items: center; gap: clamp(20px, 2.4vw, 34px);
    padding: 32px max(40px, 3vw) 26px;
    /* neutral paper base */
    background: linear-gradient(to top,
      rgba(255,255,255,0.92) 0%,
      rgba(255,255,255,0.82) 50%,
      rgba(255,255,255,0) 100%);
    /* frosted blur on top */
    -webkit-backdrop-filter: blur(16px) saturate(135%);
    backdrop-filter: blur(16px) saturate(135%);
    /* fade the whole material (paper + frost) out toward the top */
    -webkit-mask-image: linear-gradient(to top, #000 0%, #000 52%, transparent 100%);
    mask-image: linear-gradient(to top, #000 0%, #000 52%, transparent 100%);
    pointer-events: none;
  }
  /* only the controls themselves are interactive — the faded top of the shelf
     lets a drag started near the bottom of the rail pass straight through */
  .drag-controls > * { pointer-events: auto; }
  .drag-arrow {
    width: 38px; height: 38px; border-radius: 50%;
    border: 0; background: transparent; color: oklch(0.3 0.03 258);
    cursor: pointer; flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
    transition: background .18s ease, color .18s ease, transform .18s ease;
  }
  .drag-arrow:hover  { background: oklch(0.32 0.16 264 / 0.1); color: oklch(0.32 0.16 264); }
  .drag-arrow:active { transform: scale(0.94); }
  .drag-arrow:focus-visible { outline: 2px solid oklch(0.32 0.16 264 / 0.5); outline-offset: 2px; }
  .drag-progress {
    flex: 1 1 auto; height: 22px; position: relative; cursor: pointer;
    display: flex; align-items: center;
  }
  .drag-progress::before {
    content: ""; position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%);
    height: 2px; border-radius: 2px; background: oklch(0.5 0.03 258 / 0.2);
  }
  .drag-progress__bar {
    position: absolute; top: 50%; left: 0; transform: translateY(-50%);
    height: 2px; border-radius: 2px; width: 0%; background: oklch(0.32 0.16 264);
    transition: width .35s cubic-bezier(.22,.61,.36,1);
  }
  .drag-progress__bar::after {
    content: ""; position: absolute; right: -5px; top: 50%; width: 10px; height: 10px;
    border-radius: 50%; background: oklch(0.32 0.16 264);
    box-shadow: 0 0 0 2.5px rgba(255,255,255,0.9);
    transform: translateY(-50%);
    transition: transform .2s cubic-bezier(.22,.61,.36,1);
  }
  .drag-progress:hover .drag-progress__bar::after { transform: translateY(-50%) scale(1.25); }
  .drag-count {
    flex: 0 0 auto; font-family: var(--drag-sans);
    font-size: 11px; letter-spacing: 0.16em; font-weight: 600;
    color: oklch(0.55 0.02 258); min-width: 56px; text-align: right;
    font-variant-numeric: tabular-nums; padding-right: 2px;
  }
  .drag-count em { font-style: normal; font-weight: 700; color: oklch(0.2 0.04 258); }

  @media (max-width: 760px) {
    .drag-rail { padding: 0 32px 96px; gap: 24px; }
    .drag-intro { width: 78vw; }
    .drag-lead .drag-frame { aspect-ratio: 4/5; }
    .drag-controls { padding: 28px 22px 20px; gap: 16px; }
  }
`;

/* ─────────────────────────────────────────────────────────────────── */
/* ── Collage renderer — interleaves photo / feature / comic / IG ── */

type CollageItem =
  | { kind: "photo";   article: NewsArticle; coverVariant: "serif" | "sans" }
  | { kind: "feature"; article: NewsArticle; coverVariant: "serif" | "sans" }
  | { kind: "ig" };

function buildCollage(articles: NewsArticle[]): CollageItem[] {
  if (articles.length === 0) return [];

  // All articles render as standard photo / feature tiles (no special
  // POPCORN comic treatment). IG is appended at the very end so it lands
  // in a side column at the bottom of the collage.
  const items: CollageItem[] = articles.map((a) =>
    a.imageUrl
      ? { kind: "photo",   article: a, coverVariant: "serif" }
      : { kind: "feature", article: a, coverVariant: "serif" }
  );

  items.push({ kind: "ig" });
  return items;
}

/* ─────────────────────────────────────────────────────────────────── */
/* ── New editorial section components ─────────────────────────── */

function SectionHead({ label }: { label: string }) {
  return (
    <div className="sec-head">
      <h2>{label}</h2>
      <span className="bar" />
    </div>
  );
}

function LeadCard({ article, onOpen }: { article: NewsArticle; onOpen: () => void }) {
  const src = article.imageUrl ? feedImageUrl(article.imageUrl) : null;
  return (
    <a
      className="lead"
      href="#"
      onClick={(e) => { e.preventDefault(); onOpen(); }}
    >
      <div className="img-wrap">
        {src && <img src={src} alt="" loading="eager" draggable={false} />}
      </div>
      <div className="txt">
        <div className="meta">
          <span className="cat">{article.category || "Today"}</span>
          <span className="bar" />
        </div>
        <h2 className="title">{article.title}</h2>
        {article.summary && (
          <p className="dek">{article.summary}</p>
        )}
      </div>
    </a>
  );
}

function EditorialCard({
  article,
  onOpen,
  span,
  ratio,
  anim,
}: {
  article: NewsArticle;
  onOpen: () => void;
  span: "sp-3" | "sp-4" | "sp-6";
  ratio: "ar-4-5" | "ar-1-1" | "ar-3-2" | "ar-3-4";
  anim?: "anim-pick" | "anim-screen" | "anim-signal" | "anim-sport";
}) {
  const src = article.imageUrl ? feedImageUrl(article.imageUrl) : null;
  const cls = ["card", span, ratio, anim].filter(Boolean).join(" ");
  if (!src) {
    return (
      <a
        className={cls + " feat"}
        href="#"
        onClick={(e) => { e.preventDefault(); onOpen(); }}
      >
        <div className="img">
          <h3 className="feat-title">{article.title}</h3>
        </div>
        <div className="meta">
          <span className="cat">{article.category || "Today"}</span>
          <span className="bar" />
          <span className="arr">↗</span>
        </div>
        <h3 className="title">{article.title}</h3>
      </a>
    );
  }
  return (
    <a
      className={cls}
      href="#"
      onClick={(e) => { e.preventDefault(); onOpen(); }}
    >
      <div className="img">
        {anim === "anim-screen" && <>
          <span className="bar-top" />
          <span className="bar-bot" />
        </>}
        <img src={src} alt="" loading="lazy" draggable={false} />
      </div>
      <div className="meta">
        <span className="cat">{article.category || "Today"}</span>
        <span className="bar" />
        <span className="arr">↗</span>
      </div>
      <h3 className="title">{article.title}</h3>
    </a>
  );
}

/* Editors' Picks — centered editorial card: image on top, category centered
   in light gray, headline centered in black. */
function PickCard({ article, onOpen }: { article: NewsArticle; onOpen: () => void }) {
  const src = article.imageUrl ? feedImageUrl(article.imageUrl) : null;
  return (
    <a
      className="pick-card sp-3 anim-pick"
      href="#"
      onClick={(e) => { e.preventDefault(); onOpen(); }}
    >
      <div className="pick-img">
        {src
          ? <img src={src} alt="" loading="lazy" draggable={false} />
          : <span className="pick-img__ph" aria-hidden />}
      </div>
      <span className="pick-cat">{article.category || "Today"}</span>
      <h3 className="pick-title">{article.title}</h3>
    </a>
  );
}

function CoverCard({ article, onOpen }: { article: NewsArticle; onOpen: () => void }) {
  const src = article.imageUrl ? feedImageUrl(article.imageUrl) : null;
  return (
    <div className="cover-wrap">
      <a
        className="cover-card"
        href="#"
        onClick={(e) => { e.preventDefault(); onOpen(); }}
      >
        {src && <img src={src} alt="" loading="lazy" draggable={false} />}
        <div className="cover-top">
          <div className="wm">
            {"POPCORN".split("").map((c, i) => <span key={i}>{c}</span>)}
          </div>
        </div>
        <div className="cover-bot">
          <h3 className="cover-title">{article.title}</h3>
        </div>
      </a>
    </div>
  );
}

/* The same category-tile montage the intro splash flickers through. */
const PROMO_FRAMES: ReadonlyArray<string> = [
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

/* Dynamic in-feed ad — flickers rapidly through the intro montage images
   and resolves into a Download-the-app CTA on the right. Full-width band
   inside the 12-col grid. */
function AppPromoBanner() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setI((p) => (p + 1) % PROMO_FRAMES.length),
      110,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="app-promo">
      <div className="app-promo__flick">
        {PROMO_FRAMES.map((src, n) => (
          <img
            key={n}
            src={src}
            alt=""
            className={n === i ? "is-on" : ""}
            draggable={false}
          />
        ))}
        <div className="app-promo__flick-grain" aria-hidden>
          <GrainBackground variant="popcorn-blue" />
        </div>
      </div>
      <div className="app-promo__cta">
        <div aria-hidden className="app-promo__cta-grain">
          <GrainBackground variant="popcorn-blue" />
        </div>
        <span className="app-promo__kicker">Popcorn for iOS</span>
        <h3 className="app-promo__title">
          The whole pop, <em>in your pocket.</em>
        </h3>
        <p className="app-promo__sub">
          Today's stories, every morning — flick through it just like this.
        </p>
        <a className="app-promo__btn" href="#">Download the app ↗</a>
      </div>
    </section>
  );
}

/* Horizontal app-download strip pinned to the bottom of the viewport.
   Flickers the montage, resolves to a logo + download CTA, and trails the
   bottom of the screen while scrolling — releasing once the footer rises. */
function AppPromoStrip() {
  const [i, setI] = useState(0);
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setI((p) => (p + 1) % PROMO_FRAMES.length), 110);
    const stop = window.setTimeout(() => { window.clearInterval(id); setResolved(true); }, 3300);
    return () => { window.clearInterval(id); window.clearTimeout(stop); };
  }, []);
  return (
    <div className="promo-strip-zone">
      <section className="promo-strip" aria-label="Download the Popcorn app">
        <div className="promo-strip__flick">
          {PROMO_FRAMES.map((src, n) => (
            <img key={n} src={src} alt="" className={n === i ? "is-on" : ""} draggable={false} />
          ))}
        </div>
        <div className={`promo-strip__cta ${resolved ? "is-resolved" : ""}`}>
          <img className="promo-strip__logo" src="/logo-website-contrast.png" alt="Popcorn" draggable={false} />
          <span className="promo-strip__tag">The whole pop, in your pocket.</span>
          <a className="promo-strip__btn" href="#">Download the app ↗</a>
        </div>
      </section>
    </div>
  );
}

/* Horizontal top variant of the app ad — a full-width banner that flickers
   through the intro montage frames, then resolves into a POPCORN wordmark +
   Download CTA. Sits at the top of the feed and sticks below the nav as you
   scroll (scrolls with the page, then pins). */
function AppPromoTop() {
  const [i, setI] = useState(0);
  const [resolved, setResolved] = useState(false);
  useEffect(() => {
    let flick: number | undefined;
    let stop: number | undefined;
    let restart: number | undefined;

    // One full cycle: flicker through the frames for ~10s, crossfade to the
    // resolved POPCORN lockup, hold it briefly, then start over.
    const runCycle = () => {
      setResolved(false);
      setI(0);
      flick = window.setInterval(
        () => setI((p) => (p + 1) % PROMO_FRAMES.length),
        300,
      );
      stop = window.setTimeout(() => {
        window.clearInterval(flick);
        setResolved(true);
        // Hold the resolved lockup briefly, then replay the montage.
        restart = window.setTimeout(runCycle, 12000);
      }, 10000);
    };

    runCycle();
    return () => {
      window.clearInterval(flick);
      window.clearTimeout(stop);
      window.clearTimeout(restart);
    };
  }, []);

  return (
    <section
      className={`promo-top ${resolved ? "is-resolved" : ""}`}
      aria-label="Download the Popcorn app"
    >
      <div className="promo-top__flick">
        {PROMO_FRAMES.map((src, n) => (
          <img
            key={n}
            src={src}
            alt=""
            className={n === i ? "is-on" : ""}
            draggable={false}
          />
        ))}
        <div className="promo-top__grain" aria-hidden>
          <GrainBackground variant="popcorn-blue" />
        </div>
      </div>
      <div className="promo-top__cta">
        <span className="promo-top__wordmark">The Pop in your pocket.</span>
        <a className="promo-top__btn" href="#">Download the app ↗</a>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ── DragFeed — experimental horizontal "Drag edition" rail ────── */
/* The day's stories on a horizontally-draggable rail of variably-sized photo
   slides (lead overlay, captioned slides, magazine covers), framed by an intro
   panel, the kept app ad + IG pill, and an end/newsletter panel, with a bottom
   controls bar (arrows + progress + counter). Ported from Popcorn - Drag.html;
   reuses the classic feed's section slicing for editorial rhythm. */

const num2 = (n: number) => String(n).padStart(2, "0");

/* Shape measure — landscape-dominant (wide 3/2 + a gentle 4/3, only the
   occasional square) so frames read as horizontal rectangles on average.
   The image HEIGHT/size is driven per-article by image quality (see
   qualityClass); the headline above/below stagger is driven by slide parity
   (see regularSlide). Variation is intentional, not random. */
const DRAG_RHYTHM = [
  "ar-w",
  "ar-l",
  "ar-xw",
  "ar-l",
  "ar-sq",
  "ar-w",
  "ar-t",
  "ar-w",
  "ar-l",
];

// per-slide photo treatment: a resting tilt (straightens on hover) for most
// frames, with the occasional poster-style offset colour-block (no tilt).
const DRAG_TREATMENTS: Array<{ rot?: number; pop?: "pop" | "pop2" | "pop3" }> = [
  { rot: -2.2 },
  { rot: 1.8 },
  { pop: "pop" },
  { rot: -1.4 },
  { pop: "pop3" },
  { rot: 2.3 },
  { pop: "pop2" },
  { rot: -1.8 },
  { rot: 1.5 },
];

/* Higher-resolution images get a taller frame, lower-res get a shorter one,
   so quality reads as scale on the rail. imageWidth/imageHeight can be
   missing or unreliable, so unknowns settle in the middle band. */
const qualityClass = (a: NewsArticle): string => {
  const px = (a.imageWidth ?? 0) * (a.imageHeight ?? 0);
  if (!px) return "d-mid";
  if (px >= 1_800_000) return "d-tall";   // ~1600×1125 and up
  if (px >= 500_000) return "d-mid";      // ~1024×500 and up (e.g. PSG 1024×576)
  return "d-short";                        // genuinely small originals
};

function DragFeed({
  articles,
  onOpen,
  group,
}: {
  articles: NewsArticle[];
  onOpen: (a: NewsArticle) => void;
  group?: DayGroup;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const dateLabel = group ? format(group.date, "EEEE, MMMM d") : "Today";
  const total = articles.length;

  // Reset to the start of the rail when the day / category changes.
  useEffect(() => {
    if (stageRef.current) stageRef.current.scrollLeft = 0;
  }, [articles]);

  // Port the mockup's vanilla interaction JS: wheel → horizontal pan, pointer
  // drag with click-suppression, arrow paging, keyboard, and a scroll handler
  // that drives the progress bar + nearest-slide counter.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const bar = barRef.current;
    const countNow = countRef.current;

    const maxScroll = () => stage.scrollWidth - stage.clientWidth;
    const page = (dir: number) =>
      stage.scrollBy({ left: dir * stage.clientWidth * 0.8, behavior: "smooth" });

    const update = () => {
      const max = maxScroll();
      const pct = max > 0 ? stage.scrollLeft / max : 0;
      if (bar) bar.style.width = (pct * 100).toFixed(2) + "%";
      const mid = stage.scrollLeft + stage.clientWidth / 2;
      const sl = Array.from(stage.querySelectorAll<HTMLElement>(".drag-slide"));
      let nearest = 0, best = Infinity;
      sl.forEach((s, i) => {
        const c = s.offsetLeft + s.offsetWidth / 2;
        const d = Math.abs(c - mid);
        if (d < best) { best = d; nearest = i; }
      });
      if (countNow) {
        const numAttr = sl[nearest]?.getAttribute("data-num");
        countNow.textContent = numAttr ?? num2(nearest + 1);
      }
    };

    const onScroll = () => update();
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        stage.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };

    let down = false, dragging = false, startX = 0, startScroll = 0, moved = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down = true; dragging = false; moved = 0;
      startX = e.clientX; startScroll = stage.scrollLeft;
      // NB: do NOT setPointerCapture here — capturing on a plain click
      // retargets the subsequent `click` event to the stage, so the slide's
      // <a onClick> never fires and the reader never opens. We only capture
      // once an actual horizontal drag begins (see onPointerMove).
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (Math.abs(dx) > 4 && !dragging) {
        dragging = true;
        stage.classList.add("is-drag");
        try { stage.setPointerCapture(e.pointerId); } catch { /* noop */ }
      }
      if (dragging) stage.scrollLeft = startScroll - dx;
    };
    const endDrag = (e: PointerEvent) => {
      if (!down) return;
      down = false; dragging = false;
      stage.classList.remove("is-drag");
      try { stage.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    };
    // Swallow the click that ends a drag so it doesn't open the reader.
    const onClickCapture = (e: MouseEvent) => {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") page(1);
      else if (e.key === "ArrowLeft") page(-1);
      else if (e.key === "Home") stage.scrollTo({ left: 0, behavior: "smooth" });
      else if (e.key === "End") stage.scrollTo({ left: maxScroll(), behavior: "smooth" });
    };

    stage.addEventListener("scroll", onScroll, { passive: true });
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    stage.addEventListener("click", onClickCapture, true);
    window.addEventListener("keydown", onKey);
    update();

    return () => {
      stage.removeEventListener("scroll", onScroll);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", endDrag);
      stage.removeEventListener("pointercancel", endDrag);
      stage.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [articles]);

  const page = (dir: number) =>
    stageRef.current?.scrollBy({ left: dir * stageRef.current.clientWidth * 0.8, behavior: "smooth" });
  const seek = (e: ReactMouseEvent<HTMLDivElement>) => {
    const stage = stageRef.current, prog = progressRef.current;
    if (!stage || !prog) return;
    const r = prog.getBoundingClientRect();
    const pct = (e.clientX - r.left) / r.width;
    stage.scrollTo({ left: pct * (stage.scrollWidth - stage.clientWidth), behavior: "smooth" });
  };
  const backToStart = () => stageRef.current?.scrollTo({ left: 0, behavior: "smooth" });

  // ── Build the rail from the same section slicing as the classic feed ──
  let cur = 0;
  const take = (n: number) => { const s = articles.slice(cur, cur + n); cur += s.length; return s; };
  const lead = take(1);
  const picks = take(4);
  const screen = take(3);
  const signal = take(2);
  const news = take(3);
  const sport = take(2);
  const also = articles.slice(cur);

  let seq = 0;        // global 1-based slide number

  // Every article renders as the same uniform slide: same-size image on top,
  // category below, headline below — a fully aligned rail.
  const regularSlide = (a: NewsArticle, keyPrefix: string) => {
    seq += 1; const n = seq;
    const beat = DRAG_RHYTHM[(n - 1) % DRAG_RHYTHM.length];
    const src = a.imageUrl ? feedImageUrl(a.imageUrl) : null;
    const size = src ? qualityClass(a) : "d-mid";
    // category + headline sit together on the SAME side of the image, the pair
    // alternating side slide to slide: even slides above the photo, odd below.
    const pairTop = n % 2 === 0;
    const catPos = pairTop ? "is-top" : "is-bottom";
    const titlePos = catPos;
    // honour detected focal point so cropped frames keep the subject (face) in view
    const ox = a.imageFocalX != null ? `${Math.round(a.imageFocalX * 100)}%` : "50%";
    const oy = a.imageFocalY != null ? `${Math.round(a.imageFocalY * 100)}%` : "50%";
    // gentle per-slide vertical IMAGE float so frames stagger softly (captions
    // stay anchored); kept small so the image never collides with its captions
    const DRAG_OFFSETS = [-20, 14, -6, 22, -16, 4, -24, 12, -10, 18];
    const off = DRAG_OFFSETS[(n - 1) % DRAG_OFFSETS.length];
    // per-slide image treatment: most frames carry a small resting tilt (which
    // straightens on hover); a couple per cycle drop the tilt for a hard, poster
    // offset colour-block (cream "pop" / blue "pop2") instead.
    const treat = DRAG_TREATMENTS[(n - 1) % DRAG_TREATMENTS.length];
    const popCls = treat.pop ? ` ${treat.pop}` : "";
    const rot = treat.pop ? 0 : treat.rot ?? 0;
    return (
      <article
        key={`${keyPrefix}-${a.id}`}
        className={`drag-slide ${size} ${beat}${popCls}`}
        data-num={num2(n)}
        style={{ ["--drag-off" as string]: `${off}px`, ["--rot" as string]: `${rot}deg` }}
      >
        <span className={`drag-cat ${catPos}`}>{a.category || "Today"}</span>
        <a className={`drag-frame${src ? "" : " is-feat"}`} href="#" onClick={(e) => { e.preventDefault(); onOpen(a); }}>
          {src
            ? <img src={src} alt="" loading="lazy" draggable={false} style={{ objectPosition: `${ox} ${oy}` }} />
            : <h3 className="drag-feat-title">{a.title}</h3>}
        </a>
        <h3 className={`drag-title ${titlePos}`}>{a.title}</h3>
      </article>
    );
  };

  const rail: ReactNode[] = [];
  rail.push(
    <section key="intro" className="drag-intro">
      <div className="drag-intro__grain" aria-hidden><GrainBackground variant="popcorn-blue" /></div>
      <div className="drag-intro__edition"><span>{dateLabel} · Weekday Edition</span></div>
      <p className="drag-intro__tag">The day’s culture — <em>popped fresh, before lunch.</em></p>
      <div className="drag-intro__hint"><span>Drag to explore</span><span className="track" /><span>→</span></div>
    </section>,
  );
  // All story slides in editorial order.
  const storySlides: ReactNode[] = [];
  if (lead.length) { storySlides.push(regularSlide(lead[0], "d-lead")); }
  picks.forEach((a) => storySlides.push(regularSlide(a, "d-pick")));
  screen.forEach((a) => storySlides.push(regularSlide(a, "d-scr")));
  signal.forEach((a) => storySlides.push(regularSlide(a, "d-sig")));
  news.forEach((a) => storySlides.push(regularSlide(a, "d-news")));
  sport.forEach((a) => storySlides.push(regularSlide(a, "d-spt")));
  also.forEach((a) => storySlides.push(regularSlide(a, "d-also")));

  // Drop the IG ad at a spot in the middle band of the rail. Seeded by the day
  // so placement is stable for a given feed but varies day to day (reads as
  // random without reshuffling on every render). The app ad lives in the top
  // banner above the masthead, not in the rail.
  const igNode = <div key="ig" className="drag-ig"><InstagramTile /></div>;
  const n = storySlides.length;
  if (n >= 2) {
    const seed = group ? group.date.getDate() + group.date.getMonth() * 31 : n;
    const frac = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const lo = Math.max(1, Math.floor(n * 0.3));
    const hi = Math.max(lo + 1, Math.floor(n * 0.7));
    const span = Math.max(1, hi - lo);
    const igPos = lo + Math.floor(frac(seed + 7.77) * span);
    storySlides.splice(Math.min(igPos, storySlides.length), 0, igNode);
  } else {
    storySlides.push(igNode);
  }
  rail.push(...storySlides);
  rail.push(
    <section key="end" className="drag-end">
      <h3>That’s today’s pop.</h3>
      <p>Back tomorrow before lunch. Get the whole thing in your inbox by 11am.</p>
      <form onSubmit={(e) => e.preventDefault()}>
        <input type="email" placeholder="email" />
        <button type="submit">Join</button>
      </form>
      <button className="back" onClick={backToStart}>← Back to the top</button>
    </section>,
  );

  return (
    <div className="drag-shell">
      <div className="drag-stage" ref={stageRef} aria-label="Drag feed">
        <div className="drag-rail">{rail}</div>
      </div>
      <div className="drag-controls">
        <button className="drag-arrow" aria-label="Previous" onClick={() => page(-1)}>
          <ChevronLeft size={17} strokeWidth={2} />
        </button>
        <button className="drag-arrow" aria-label="Next" onClick={() => page(1)}>
          <ChevronRight size={17} strokeWidth={2} />
        </button>
        <div className="drag-progress" ref={progressRef} onClick={seek}>
          <div className="drag-progress__bar" ref={barRef} />
        </div>
        <div className="drag-count"><em ref={countRef}>01</em> / {num2(total)}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ── Page ──────────────────────────────────────────────────────── */

export function DesktopHome() {
  const { user, signOut } = useAuth();
  const saves = useSavesRoot(user);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteNewsFeed();

  // Desktop scrolls naturally; release the mobile overflow lock for the
  // lifetime of this page and restore on unmount so resizing back to
  // mobile width doesn't strand the body in `overflow: visible`.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const targets: Array<HTMLElement | null> = [html, body, root];
    const prev = targets.map((el) =>
      el ? { overflow: el.style.overflow, height: el.style.height } : null,
    );
    targets.forEach((el) => {
      if (!el) return;
      el.style.overflow = "visible";
      el.style.height = "auto";
    });
    return () => {
      targets.forEach((el, i) => {
        const p = prev[i];
        if (!el || !p) return;
        el.style.overflow = p.overflow;
        el.style.height = p.height;
      });
    };
  }, []);

  // Auto-pop the auth modal once per session for signed-out visitors.
  const [authOpen, setAuthOpen] = useState(false);
  useEffect(() => {
    if (user) return;
    if (sessionStorage.getItem("popcorn_desktop_auth_dismissed")) return;
    const t = setTimeout(() => setAuthOpen(true), 1200);
    return () => clearTimeout(t);
  }, [user]);

  const [signUpOpen, setSignUpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const closeAuth = useCallback(() => {
    sessionStorage.setItem("popcorn_desktop_auth_dismissed", "1");
    setAuthOpen(false);
  }, []);

  const [readingArticle, setReadingArticle] = useState<NewsArticle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dayCursor, setDayCursor] = useState(0); // 0 = today, 1 = yesterday, ...

  // Layout switch — the experimental horizontal "Drag edition" rail vs. the
  // classic vertical magazine grid. Visible toggle in the masthead; choice
  // persisted so both can be compared live across reloads.
  const [layoutMode, setLayoutMode] = useState<"classic" | "drag">(() => {
    try {
      const saved = localStorage.getItem("popcorn-web-layout");
      return saved === "classic" ? "classic" : "drag";
    } catch {
      return "drag";
    }
  });
  useEffect(() => {
    try { localStorage.setItem("popcorn-web-layout", layoutMode); } catch { /* ignore */ }
  }, [layoutMode]);

  const allArticles = useMemo<NewsArticle[]>(() => {
    return data?.pages.flatMap((p: any) => p.articles ?? []) ?? [];
  }, [data]);

  const filteredArticles = useMemo(() => {
    if (!selectedCategory) return allArticles;
    return allArticles.filter((a) => a.category === selectedCategory);
  }, [allArticles, selectedCategory]);

  const days = useMemo(() => groupByDay(filteredArticles), [filteredArticles]);
  const activeDay = days[dayCursor];

  // Auto-load older pages as the user paginates backwards in time.
  useEffect(() => {
    if (isLoading) return;
    if (dayCursor >= days.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [dayCursor, days.length, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  // Category change → snap to today so the topic view starts at the top.
  useEffect(() => {
    setDayCursor(0);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [selectedCategory]);

  const openArticle = useCallback((a: NewsArticle) => {
    setReadingArticle(a);
  }, []);

  const hasPrev = dayCursor < days.length - 1 || hasNextPage;
  const hasNext = dayCursor > 0;

  const onPrev = useCallback(() => {
    setDayCursor((c) => Math.min(c + 1, Math.max(0, days.length - 1)));
  }, [days.length]);
  const onNext = useCallback(() => {
    setDayCursor((c) => Math.max(0, c - 1));
  }, []);

  const articles = activeDay?.articles ?? [];
  const collage = useMemo(() => buildCollage(articles), [articles]);

  return (
    <SavesContext.Provider value={saves}>
      <style>{PAGE_CSS + EDITORIAL_CSS + DRAG_CSS}</style>

      <PopcornIntro />

      <div
        className={`pcd-page${layoutMode === "drag" ? " is-drag" : ""}`}
        style={{ background: PAPER, color: INK, fontFamily: SANS, fontSize: 15, lineHeight: 1.45 }}
      >
        <div className="pcd-stickytop">
          <Masthead
            user={user}
            onSignIn={() => setSignInOpen(true)}
            onSignOut={signOut}
            group={activeDay}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={onPrev}
            onNext={onNext}
            layoutMode={layoutMode}
            onSetLayout={setLayoutMode}
          />
          <SectionNav
            selectedCategory={selectedCategory}
            onSelect={setSelectedCategory}
            rightSlot={layoutMode === "drag" ? <AppPromoTop /> : undefined}
          />
        </div>

        {layoutMode === "drag" ? (
          <DragFeed articles={articles} onOpen={openArticle} group={activeDay} />
        ) : (
        <>
        {isLoading && articles.length === 0 ? (
          <div
            style={{
              maxWidth: MAX_W,
              margin: "0 auto",
              padding: "120px 36px",
              textAlign: "center",
              color: MUTE,
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: 18,
            }}
          >
            Loading today's pop…
          </div>
        ) : (
          (() => {
            /* Adaptive section slicing — only render sections that have at
               least one article. Counter walks the articles array; the IG
               tile is appended into Also Today regardless. */
            let cur = 0;
            const take = (n: number) => {
              const slice = articles.slice(cur, cur + n);
              cur += slice.length;
              return slice;
            };
            const lead     = take(1);
            const picks    = take(4);
            const screen   = take(3);
            const signal   = take(2);
            const news     = take(3);
            const sport    = take(2);
            const also     = articles.slice(cur);

            /* Also Today — mix of sp-3 ar-1-1, sp-4 ar-4-5, sp-3 ar-3-4
               cycling through the leftover items. IG tile goes in slot 0
               of Also Today (replaces what would have been the first card)
               so it always lands in the grid. */
            type AlsoCfg = { span: "sp-3"|"sp-4"; ratio: "ar-1-1"|"ar-4-5"|"ar-3-4" };
            const ALSO_CYCLE: AlsoCfg[] = [
              { span: "sp-3", ratio: "ar-1-1" },
              { span: "sp-3", ratio: "ar-1-1" },
              { span: "sp-3", ratio: "ar-1-1" },
              { span: "sp-4", ratio: "ar-4-5" },
              { span: "sp-4", ratio: "ar-4-5" },
              { span: "sp-3", ratio: "ar-3-4" },
              { span: "sp-3", ratio: "ar-3-4" },
            ];

            return (
              <main className="feed">
                <AppPromoTop />

                {lead.length > 0 && (
                  <>
                    <SectionHead label="Lead Story" />
                    <LeadCard article={lead[0]} onOpen={() => openArticle(lead[0])} />
                  </>
                )}

                {picks.length > 0 && (
                  <>
                    <SectionHead label="Editors' Picks" />
                    {picks.map((a) => (
                      <PickCard
                        key={`pick-${a.id}`}
                        article={a}
                        onOpen={() => openArticle(a)}
                      />
                    ))}
                  </>
                )}

                {screen.length > 0 && (
                  <>
                    <SectionHead label="Screen & Sound" />
                    {screen.map((a) => (
                      <EditorialCard
                        key={`scr-${a.id}`}
                        article={a}
                        onOpen={() => openArticle(a)}
                        span="sp-4"
                        ratio="ar-4-5"
                        anim="anim-screen"
                      />
                    ))}
                  </>
                )}

                {signal.length > 0 && (
                  <>
                    <SectionHead label="Signal" />
                    {signal.map((a) => (
                      <EditorialCard
                        key={`sig-${a.id}`}
                        article={a}
                        onOpen={() => openArticle(a)}
                        span="sp-6"
                        ratio="ar-3-2"
                        anim="anim-signal"
                      />
                    ))}
                  </>
                )}

                {news.length > 0 && (
                  <>
                    <SectionHead label="Newsstand" />
                    {news.map((a) => (
                      <CoverCard key={`cov-${a.id}`} article={a} onOpen={() => openArticle(a)} />
                    ))}
                  </>
                )}

                {sport.length > 0 && (
                  <>
                    <SectionHead label="Sport" />
                    {sport.map((a) => (
                      <EditorialCard
                        key={`spt-${a.id}`}
                        article={a}
                        onOpen={() => openArticle(a)}
                        span="sp-6"
                        ratio="ar-3-2"
                        anim="anim-sport"
                      />
                    ))}
                  </>
                )}

                {(also.length > 0 || articles.length > 0) && (
                  <>
                    <SectionHead label="Also Today" />
                    {also.map((a, i) => {
                      const cfg = ALSO_CYCLE[i % ALSO_CYCLE.length];
                      return (
                        <EditorialCard
                          key={`also-${a.id}`}
                          article={a}
                          onOpen={() => openArticle(a)}
                          span={cfg.span}
                          ratio={cfg.ratio}
                        />
                      );
                    })}
                  </>
                )}
              </main>
            );
          })()
        )}

        {articles.length > 0 && (
          <div className="ig-bottom" aria-label="Follow Popcorn on Instagram">
            <InstagramTile />
          </div>
        )}

        {articles.length > 0 && (
          <div style={{ padding: "20px 36px 60px", display: "flex", justifyContent: "center" }}>
            <PopcornIOSTicket />
          </div>
        )}

        {articles.length > 0 && <AppPromoStrip />}

        <Footer />
        </>
        )}
      </div>

      {readingArticle && (
        <ArticleReader
          article={readingArticle}
          onClose={() => setReadingArticle(null)}
          relatedArticles={allArticles
            .filter((a) => a.id !== readingArticle!.id)
            .slice(0, 3)}
          onSelectArticle={(a) => setReadingArticle(a)}
        />
      )}

      {authOpen && !user && (
        <DesktopAuthModal
          onClose={closeAuth}
          onSignInWithEmail={() => {
            closeAuth();
            setSignInOpen(true);
          }}
          onCreateAccount={() => {
            closeAuth();
            setSignUpOpen(true);
          }}
        />
      )}

      {signUpOpen && (
        <SignUpFlow
          isOpen={signUpOpen}
          onClose={() => setSignUpOpen(false)}
          onComplete={() => setSignUpOpen(false)}
          onSignInInstead={() => { setSignUpOpen(false); setSignInOpen(true); }}
        />
      )}
      {signInOpen && (
        <SignInSheet
          isOpen={signInOpen}
          onClose={() => setSignInOpen(false)}
          onSignUpInstead={() => { setSignInOpen(false); setSignUpOpen(true); }}
        />
      )}
    </SavesContext.Provider>
  );
}
