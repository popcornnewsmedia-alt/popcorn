import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode, MouseEvent as ReactMouseEvent, FormEvent as ReactFormEvent } from "react";
import { ChevronLeft, ChevronRight, Instagram, Heart, MessageCircle, Bookmark, Send, X, LogOut, ChevronDown, Settings, Pencil, Eye, EyeOff, ArrowRight, Check, Bell, Trash2 } from "lucide-react";
import { format, startOfDay } from "date-fns";
import type { NewsArticle } from "@workspace/api-client-react";
import { useInfiniteNewsFeed } from "@/hooks/use-news";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import type { User as SupaUser } from "@supabase/supabase-js";
import { SavesContext, useSavesRoot, useSavedArticles } from "@/hooks/use-saves";
import { LikesContext, useLikesRoot, useLikedArticles } from "@/hooks/use-likes";
import { useCommentCount } from "@/hooks/use-comment-count";
import { useNotifications } from "@/hooks/use-notifications";
import { avatarColor } from "@/lib/avatar";
import type { DBNotification } from "@/lib/comments-types";
import { CommentSheet } from "@/components/CommentSheet";
import { ABOUT, PRIVACY, TERMS, type LegalKind, type LegalDoc } from "@/components/LegalSheet";
import { feedImageUrl } from "@/lib/image-url";
import { apiBase } from "@/lib/api-base";
import { ArticleReader } from "@/components/ArticleReader";
import { DesktopAuthGate } from "@/components/desktop/DesktopAuthGate";
import { DesktopAuthFooter } from "@/components/desktop/DesktopAuthFooter";
import { NewsletterTab } from "@/components/desktop/NewsletterTab";
import { SignUpFlow } from "@/components/SignUpFlow";
import { SignInSheet } from "@/components/SignInSheet";
import { GrainBackground } from "@/components/GrainBackground";
import { PopcornIntro } from "@/components/PopcornIntro";
import { GridFeed } from "./DesktopGridFeed";
import { CATEGORY_COLORS } from "./feed-internals";

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
const MACABRO = "'Macabro', 'Anton', sans-serif";

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
      href="https://instagram.com/news.popcorn"
      target="_blank"
      rel="noreferrer"
    >
      <div className="ig-card">
        <div aria-hidden className="ig-grain">
          <GrainBackground variant="popcorn-blue" />
        </div>
        <div className="ig-top">
          <Instagram size={16} strokeWidth={1.6} />
          <span className="ig-cat">Follow Us</span>
        </div>
        <div className="ig-mid">
          <span className="ig-logo">
            <img src="/logo-latest.png" alt="Popcorn" loading="lazy" />
          </span>
          <h3 className="ig-h">@news.popcorn</h3>
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
          padding: 14px 14px 12px; isolation: isolate; }
        .ig-grain { position: absolute; inset: 0; opacity: 0.55;
          mix-blend-mode: overlay; pointer-events: none; z-index: 0; }
        .ig-top { position: relative; z-index: 1; color: #fff;
          display: flex; align-items: center; gap: 8px; }
        .ig-cat { font-family: ${SANS}; font-size: 9.5px;
          letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600;
          color: rgba(255,255,255,0.72); }
        .ig-mid { position: relative; z-index: 1; flex: 1;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 14px; }
        .ig-logo { display: flex; align-items: center; justify-content: center;
          width: 62%; aspect-ratio: 1/1; background: #fff1cd;
          border-radius: 18px; overflow: hidden;
          box-shadow: 0 8px 22px rgba(0,0,0,0.20); }
        .ig-logo img { width: 100%; height: 100%; object-fit: contain;
          padding: 7%; box-sizing: border-box; display: block; }
        .ig-h { margin: 0; font-family: ${SERIF}; font-style: italic;
          font-weight: 500; font-size: clamp(16px, 1.4vw, 20px);
          font-variation-settings: "opsz" 28; line-height: 1.04;
          letter-spacing: -0.008em; color: #fff; text-align: center; }
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
  userName,
  userHandle,
  userAvatar,
  userTopics,
  savedCount,
  likedCount,
  onOpenLibrary,
  onOpenLegal,
  onOpenSettings,
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
  userName: string | null;
  userHandle: string | null;
  userAvatar: string | null;
  userTopics: string[];
  savedCount: number;
  likedCount: number;
  onOpenLibrary: (tab: "likes" | "saved") => void;
  onOpenLegal: (kind: LegalKind) => void;
  onOpenSettings: () => void;
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
            <ProfileMenu
              userName={userName}
              userHandle={userHandle}
              userAvatar={userAvatar}
              userTopics={userTopics}
              savedCount={savedCount}
              likedCount={likedCount}
              onOpenLibrary={onOpenLibrary}
              onOpenLegal={onOpenLegal}
              onOpenSettings={onOpenSettings}
              onSignOut={onSignOut}
            />
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

/* ── Signed-in account surface ─────────────────────────────────────────
   The masthead "Sign out" link is replaced (when authed) by an avatar that
   opens a blue+cream dropdown — the website's account surface deliberately
   borrows the app's identity (signature blue, cream ink, Macabro display)
   so it reads as "your Popcorn" rather than the white editorial grid. It
   mirrors the app's profile options (Topics · About · Legal · Version ·
   Sign out) and adds a Library entry (Liked / Saved) — the desktop home for
   the saved/liked lists the bottom-nav owns in the app. ── */
const PROFILE_CSS = `
  .pcd-pm { position: relative; }
  .pcd-pm-trigger {
    position: relative;
    display: flex; align-items: center; gap: 9px;
    background: transparent; border: 0; cursor: pointer; padding: 0;
    color: #fff;
  }
  /* Unread reply badge — red dot pinned to the avatar's top-right, ringed in
     the masthead blue so it reads as a notification on the popcorn avatar. */
  .pcd-pm-dot {
    position: absolute; top: -2px; left: 23px;
    width: 11px; height: 11px; border-radius: 50%;
    background: #f43f5e; border: 2px solid ${BLUE};
    box-shadow: 0 0 0 1px rgba(0,0,0,0.18);
    pointer-events: none;
  }
  .pcd-pm-av {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; overflow: hidden;
    background: rgba(255,241,205,0.10);
    border: 1.5px solid rgba(255,241,205,0.55);
    box-shadow: 0 0 0 3px rgba(255,241,205,0.06);
    transition: border-color .18s ease, box-shadow .18s ease;
  }
  .pcd-pm-trigger:hover .pcd-pm-av { border-color: #fff1cd; box-shadow: 0 0 0 3px rgba(255,241,205,0.12); }
  .pcd-pm-av img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pcd-pm-av span { font-family: 'Macabro','Anton',sans-serif; font-size: 14px; color: #fff1cd; line-height: 1; }
  .pcd-pm-name { font-family: 'Macabro', serif; font-size: 11.5px; letter-spacing: 0.06em; color: #fff; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pcd-pm-chev { transition: transform .2s ease; opacity: 0.85; }
  .pcd-pm-trigger[aria-expanded="true"] .pcd-pm-chev { transform: rotate(180deg); }

  .pcd-pm-panel {
    position: fixed; z-index: 120;
    width: 312px; border-radius: 18px; overflow: hidden;
    background: ${BLUE}; color: #fff1cd; isolation: isolate;
    border: 1px solid rgba(255,241,205,0.14);
    box-shadow: 0 22px 60px rgba(4,12,40,0.45), 0 2px 0 rgba(255,255,255,0.06) inset;
    transform-origin: top right;
    animation: pcd-pm-in .2s cubic-bezier(0.22,1,0.36,1);
  }
  @keyframes pcd-pm-in { from { opacity: 0; transform: translateY(-6px) scale(0.97); } to { opacity: 1; transform: none; } }
  .pcd-pm-grain { position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: 0.6; mix-blend-mode: overlay; }
  .pcd-pm-body { position: relative; z-index: 1; padding: 18px; }
  .pcd-pm-head { display: flex; align-items: center; gap: 13px; }
  .pcd-pm-headav {
    width: 50px; height: 50px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,241,205,0.10); border: 1.5px solid rgba(255,241,205,0.28);
    box-shadow: 0 0 0 4px rgba(255,241,205,0.05);
  }
  .pcd-pm-headav img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pcd-pm-headav span { font-family: 'Macabro','Anton',sans-serif; font-size: 21px; color: #fff1cd; line-height: 1; }
  .pcd-pm-headname { font-family: 'Macabro','Anton',sans-serif; font-size: 18px; letter-spacing: 0.02em; color: #fff1cd; line-height: 1.1; margin: 0; }
  .pcd-pm-headhandle { font-family: 'Inter', sans-serif; font-size: 12.5px; color: rgba(255,241,205,0.55); margin: 3px 0 0; }
  .pcd-pm-rule { height: 1px; background: rgba(255,241,205,0.12); margin: 16px 0; }
  .pcd-pm-eyebrow { font-family: 'Macabro','Anton',sans-serif; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,241,205,0.42); margin: 0 0 9px; }
  /* Reply notifications list inside the dropdown */
  .pcd-pm-notifs { display: flex; flex-direction: column; gap: 6px; }
  .pcd-pm-notif {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 9px 11px; border-radius: 12px;
    background: rgba(255,241,205,0.05); border: 1px solid rgba(255,241,205,0.10);
  }
  .pcd-pm-notif.is-unread { background: rgba(255,241,205,0.12); border-color: rgba(255,241,205,0.24); }
  .pcd-pm-notif__av {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 11px; color: #fff;
  }
  .pcd-pm-notif__txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .pcd-pm-notif__head { font-family: 'Inter', sans-serif; font-size: 12px; color: rgba(255,241,205,0.62); }
  .pcd-pm-notif__head strong { color: #fff1cd; font-weight: 600; }
  .pcd-pm-notif__preview {
    font-family: 'Inter', sans-serif; font-size: 12.5px; color: #fff1cd;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pcd-pm-libtile {
    width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; cursor: pointer;
    padding: 12px 14px; border-radius: 13px;
    background: rgba(255,241,205,0.07); border: 1px solid rgba(255,241,205,0.14);
    color: #fff1cd; transition: background .16s ease, transform .16s ease, border-color .16s ease;
  }
  .pcd-pm-libtile:hover { background: rgba(255,241,205,0.13); border-color: rgba(255,241,205,0.28); transform: translateY(-1px); }
  .pcd-pm-libtile__ic { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; flex-shrink: 0; border-radius: 10px; background: rgba(255,241,205,0.10); border: 1px solid rgba(255,241,205,0.16); color: #fff1cd; }
  .pcd-pm-libtile__txt { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
  .pcd-pm-libtile__label { font-family: 'Macabro','Anton',sans-serif; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
  .pcd-pm-libtile__count { font-family: 'Inter', sans-serif; font-size: 12px; color: rgba(255,241,205,0.55); }
  .pcd-pm-topics { display: flex; flex-wrap: wrap; gap: 7px; }
  .pcd-pm-topic { font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 500; color: #fff1cd; background: rgba(255,241,205,0.08); border: 1px solid rgba(255,241,205,0.12); border-radius: 20px; padding: 5px 11px; }
  .pcd-pm-link {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    background: transparent; border: 0; cursor: pointer; padding: 11px 2px;
    font-family: 'Inter', sans-serif; font-weight: 500; font-size: 13.5px; color: #fff1cd;
    transition: opacity .16s ease;
  }
  .pcd-pm-link:hover { opacity: 0.7; }
  .pcd-pm-link__lead { display: inline-flex; align-items: center; gap: 9px; }
  .pcd-pm-link__lead svg { color: rgba(255,241,205,0.55); }
  .pcd-pm-notifcount {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
    background: #e14b3a; color: #fff1cd;
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 10.5px; line-height: 1;
  }
  .pcd-pm-signout {
    display: flex; align-items: center; gap: 8px; background: transparent; border: 0;
    cursor: pointer; padding: 0; margin-top: 4px;
    font-family: 'Inter', sans-serif; font-size: 12.5px; color: rgba(255,241,205,0.42);
    transition: color .16s ease;
  }
  .pcd-pm-signout:hover { color: #fff1cd; }

  /* ── Delete-account farewell (shown inside the settings modal) ── */
  .pcd-del__farewell { position: relative; z-index: 1; padding: 44px 30px 48px; text-align: center; }
  .pcd-del__farewell h3 { font-family: 'Macabro','Anton',sans-serif; font-size: 24px; color: #fff1cd; margin: 0 0 10px; letter-spacing: 0.02em; }
  .pcd-del__farewell p { font-family: 'Manrope', sans-serif; font-size: 14px; color: rgba(255,241,205,0.6); margin: 0; }

  /* ── Account settings modal ── */
  .pcd-set-overlay {
    position: fixed; inset: 0; z-index: 130; display: flex; align-items: center; justify-content: center;
    padding: 4vh 24px; background: rgba(4,12,40,0.6); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    animation: pcd-lib-fade .2s ease;
  }
  .pcd-set {
    position: relative; width: min(440px, 100%); max-height: 92vh; display: flex; flex-direction: column;
    border-radius: 22px; overflow: hidden; isolation: isolate;
    background: ${BLUE}; color: #fff1cd; border: 1px solid rgba(255,241,205,0.14);
    box-shadow: 0 30px 90px rgba(4,12,40,0.5);
    animation: pcd-lib-pop .26s cubic-bezier(0.22,1,0.36,1);
  }
  .pcd-set__grain { position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: 0.55; mix-blend-mode: overlay; }
  .pcd-set__head { position: relative; z-index: 1; padding: 24px 26px 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .pcd-set__eyebrow { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,241,205,0.38); margin: 0 0 9px; }
  .pcd-set__title { font-family: 'Macabro','Anton',sans-serif; font-size: 26px; letter-spacing: 0.02em; text-transform: uppercase; color: #fff1cd; line-height: 0.96; margin: 0; }
  .pcd-set__sub { font-family: 'Inter', sans-serif; font-size: 12.5px; color: rgba(255,241,205,0.5); margin: 9px 0 0; }
  .pcd-set__sub b { color: #fff1cd; font-weight: 500; }
  .pcd-set__close {
    width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; cursor: pointer;
    display: flex; align-items: center; justify-content: center; color: #fff1cd;
    background: rgba(255,241,205,0.08); border: 1px solid rgba(255,241,205,0.16);
    transition: background .16s ease, transform .16s ease;
  }
  .pcd-set__close:hover { background: rgba(255,241,205,0.16); transform: rotate(90deg); }
  .pcd-set__body { position: relative; z-index: 1; padding: 4px 26px 26px; overflow-y: auto; }

  /* ── Notifications popup ── */
  .pcd-ntf-overlay {
    position: fixed; inset: 0; z-index: 130; display: flex; align-items: center; justify-content: center;
    padding: 4vh 24px; background: rgba(4,12,40,0.6); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    animation: pcd-lib-fade .2s ease;
  }
  .pcd-ntf {
    position: relative; width: min(400px, 100%); max-height: 78vh; display: flex; flex-direction: column;
    border-radius: 22px; overflow: hidden; isolation: isolate;
    background: ${BLUE}; color: #fff1cd; border: 1px solid rgba(255,241,205,0.14);
    box-shadow: 0 30px 90px rgba(4,12,40,0.5);
    animation: pcd-lib-pop .26s cubic-bezier(0.22,1,0.36,1);
  }
  .pcd-ntf__grain { position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: 0.55; mix-blend-mode: overlay; }
  .pcd-ntf__head { position: relative; z-index: 1; padding: 22px 22px 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-shrink: 0; }
  .pcd-ntf__eyebrow { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,241,205,0.38); margin: 0 0 8px; }
  .pcd-ntf__title { font-family: 'Macabro','Anton',sans-serif; font-size: 17px; letter-spacing: 0.02em; text-transform: uppercase; color: #fff1cd; line-height: 0.96; margin: 0; }
  .pcd-ntf__clear {
    font-family: 'Inter', sans-serif; font-weight: 600; font-size: 11px; letter-spacing: 0.03em;
    color: rgba(255,241,205,0.55); background: transparent; border: 0; cursor: pointer; padding: 4px 2px;
    transition: color .16s ease; white-space: nowrap;
  }
  .pcd-ntf__clear:hover { color: #fff1cd; }
  .pcd-ntf__close {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; cursor: pointer;
    display: flex; align-items: center; justify-content: center; color: #fff1cd;
    background: rgba(255,241,205,0.08); border: 1px solid rgba(255,241,205,0.16);
    transition: background .16s ease, transform .16s ease;
  }
  .pcd-ntf__close:hover { background: rgba(255,241,205,0.16); transform: rotate(90deg); }
  .pcd-ntf__body { position: relative; z-index: 1; padding: 2px 14px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  .pcd-ntf__empty { text-align: center; padding: 36px 24px 40px; }
  .pcd-ntf__empty-h { font-family: 'Macabro','Anton',sans-serif; font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; color: #fff1cd; margin: 0 0 8px; }
  .pcd-ntf__empty-p { font-family: 'Lora', serif; font-size: 13px; line-height: 1.6; color: rgba(255,241,205,0.7); margin: 0; }
  .pcd-ntf-row {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 11px 12px; border-radius: 13px;
    background: rgba(255,241,205,0.05); border: 1px solid rgba(255,241,205,0.10);
  }
  .pcd-ntf-row.is-unread { background: rgba(255,241,205,0.12); border-color: rgba(255,241,205,0.24); }
  .pcd-ntf-row__av {
    width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 11px; color: #fff;
  }
  .pcd-ntf-row__txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .pcd-ntf-row__head { font-family: 'Inter', sans-serif; font-size: 12px; color: rgba(255,241,205,0.62); }
  .pcd-ntf-row__head strong { color: #fff1cd; font-weight: 600; }
  .pcd-ntf-row__preview { font-family: 'Inter', sans-serif; font-size: 12.5px; color: #fff1cd; line-height: 1.45; word-break: break-word; }
  .pcd-ntf-row__del {
    flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: 0; color: rgba(255,241,205,0.4);
    transition: background .16s ease, color .16s ease;
  }
  .pcd-ntf-row__del:hover { background: rgba(225,75,58,0.18); color: #ff7a6b; }
  .pcd-set__seclabel { font-family: 'Macabro','Anton',sans-serif; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,241,205,0.45); margin: 18px 0 11px; padding-left: 2px; }
  .pcd-set__seclabel.is-danger { color: rgba(255,179,171,0.78); }
  .pcd-set-row {
    width: 100%; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    border-radius: 14px; padding: 12px 14px; margin-bottom: 9px;
    background: rgba(255,241,205,0.05); border: 1px solid rgba(255,241,205,0.10);
    transition: background .16s ease, border-color .16s ease;
  }
  .pcd-set-row:hover { background: rgba(255,241,205,0.09); border-color: rgba(255,241,205,0.20); }
  .pcd-set-row.is-open { border-color: rgba(255,241,205,0.24); }
  .pcd-set-row__label { font-family: 'Macabro','Anton',sans-serif; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,241,205,0.60); margin: 0 0 4px; }
  .pcd-set-row__value { font-family: 'Inter', sans-serif; font-size: 14px; color: #fff1cd; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pcd-set-row__ic { flex-shrink: 0; color: rgba(255,241,205,0.5); transition: transform .18s ease; }
  .pcd-set-row.is-open .pcd-set-row__chev { transform: rotate(90deg); }
  .pcd-set-panel {
    border-radius: 14px; padding: 15px 15px 16px; margin: -2px 0 9px;
    background: rgba(255,241,205,0.03); border: 1px solid rgba(255,241,205,0.10);
    animation: pcd-set-reveal .24s cubic-bezier(0.32,0.72,0,1);
  }
  @keyframes pcd-set-reveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .pcd-set-panel__label { display: block; font-family: 'Macabro','Anton',sans-serif; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,241,205,0.70); margin: 0 0 7px; }
  .pcd-set-panel__label:not(:first-child) { margin-top: 14px; }
  .pcd-set-input {
    width: 100%; box-sizing: border-box; padding: 11px 14px; border-radius: 11px;
    background: rgba(255,241,205,0.07); border: 1px solid rgba(255,241,205,0.13); color: #fff1cd;
    font-family: 'Inter', sans-serif; font-size: 14.5px; outline: none; transition: border-color .16s ease;
  }
  .pcd-set-input:focus { border-color: rgba(255,241,205,0.40); }
  .pcd-set-input::placeholder { color: rgba(255,241,205,0.3); }
  .pcd-set-input.is-ok { border-color: rgba(130,220,160,0.40); }
  .pcd-set-input.is-bad { border-color: rgba(255,150,130,0.40); }
  .pcd-set-pwwrap { position: relative; }
  .pcd-set-pweye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: 0; cursor: pointer; padding: 5px; color: rgba(255,241,205,0.5); display: flex; }
  .pcd-set-pweye:hover { color: #fff1cd; }
  .pcd-set-msg { font-family: 'Inter', sans-serif; font-size: 12px; margin: 8px 0 0; }
  .pcd-set-msg.is-err { color: rgba(255,150,130,0.92); }
  .pcd-set-msg.is-ok { color: rgba(130,220,160,0.92); }
  .pcd-set-acts { display: flex; align-items: center; gap: 10px; margin-top: 13px; }
  .pcd-set-btn-ghost {
    padding: 9px 16px; border-radius: 11px; cursor: pointer; background: transparent;
    border: 1px solid rgba(255,241,205,0.16); color: rgba(255,241,205,0.72);
    font-family: 'Macabro','Anton',sans-serif; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
    transition: opacity .16s ease;
  }
  .pcd-set-btn-ghost:hover { opacity: 0.7; }
  .pcd-set-btn-go {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
    padding: 11px 16px; border-radius: 11px; cursor: pointer; border: 0;
    background: #fff1cd; color: ${BLUE};
    font-family: 'Macabro','Anton',sans-serif; font-size: 12px; letter-spacing: 0.10em; text-transform: uppercase;
    transition: transform .12s ease, opacity .16s ease;
  }
  .pcd-set-btn-go:hover:not(:disabled) { transform: translateY(-1px); }
  .pcd-set-btn-go:disabled { background: rgba(255,241,205,0.12); color: rgba(255,241,205,0.32); cursor: not-allowed; }
  .pcd-set-danger {
    width: 100%; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    border-radius: 14px; padding: 14px;
    background: rgba(189,69,60,0.08); border: 1px solid rgba(189,69,60,0.22);
    transition: background .16s ease;
  }
  .pcd-set-danger:hover { background: rgba(189,69,60,0.15); }
  .pcd-set-danger__label { font-family: 'Macabro','Anton',sans-serif; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #ffb3ab; margin: 0 0 4px; }
  .pcd-set-danger__p { font-family: 'Inter', sans-serif; font-size: 12.5px; color: rgba(255,241,205,0.55); line-height: 1.45; margin: 0; }
  .pcd-set-delpanel {
    border-radius: 14px; padding: 16px; margin-bottom: 9px;
    background: rgba(189,69,60,0.10); border: 1px solid rgba(189,69,60,0.35);
    animation: pcd-set-reveal .26s cubic-bezier(0.32,0.72,0,1);
  }
  .pcd-set-delpanel__h { font-family: 'Macabro','Anton',sans-serif; font-size: 12px; letter-spacing: 0.10em; text-transform: uppercase; color: #ffd8d2; margin: 0 0 10px; }
  .pcd-set-delpanel__p { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.55; color: rgba(255,241,205,0.78); margin: 0 0 14px; }
  .pcd-set-delpanel__p code { font-family: 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 0.04em; color: #fff1cd; background: rgba(255,241,205,0.08); padding: 1px 6px; border-radius: 4px; }
  .pcd-set-delinput {
    width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 11px; text-align: center;
    background: rgba(0,0,0,0.24); border: 1px solid rgba(255,241,205,0.14); color: #fff1cd;
    font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 15px; letter-spacing: 0.10em; outline: none;
    transition: border-color .16s ease;
  }
  .pcd-set-delinput.is-ready { border-color: rgba(255,179,171,0.50); }
  .pcd-set-delbtn {
    flex: 1; padding: 12px 16px; border-radius: 11px; cursor: pointer; border: 0;
    font-family: 'Macabro','Anton',sans-serif; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
    background: rgba(189,69,60,0.22); color: rgba(255,241,205,0.40);
    transition: transform .12s ease;
  }
  .pcd-set-delbtn.is-ready { background: #bd453c; color: #fff1cd; box-shadow: 0 4px 18px rgba(189,69,60,0.35); }
  .pcd-set-delbtn.is-ready:hover { transform: translateY(-1px); }
  .pcd-set-delbtn:disabled { cursor: not-allowed; }

  /* ── Library overlay ── */
  .pcd-lib-overlay {
    position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center;
    padding: 4vh 20px; background: rgba(4,12,40,0.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    animation: pcd-lib-fade .22s ease;
  }
  @keyframes pcd-lib-fade { from { opacity: 0; } to { opacity: 1; } }
  .pcd-lib {
    position: relative; width: min(540px, 100%); max-height: 92vh; display: flex; flex-direction: column;
    border-radius: 22px; overflow: hidden; isolation: isolate;
    background: ${BLUE}; color: #fff1cd; border: 1px solid rgba(255,241,205,0.14);
    box-shadow: 0 30px 90px rgba(4,12,40,0.5);
    animation: pcd-lib-pop .26s cubic-bezier(0.22,1,0.36,1);
  }
  @keyframes pcd-lib-pop { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }
  .pcd-lib__grain { position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: 0.55; mix-blend-mode: overlay; }
  .pcd-lib__head { position: relative; z-index: 1; padding: 24px 28px 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .pcd-lib__title { font-family: 'Macabro','Anton',sans-serif; font-size: 26px; letter-spacing: 0.02em; color: #fff1cd; line-height: 1; margin: 0; }
  .pcd-lib__sub { font-family: 'Inter', sans-serif; font-size: 13px; color: rgba(255,241,205,0.55); margin: 6px 0 0; }
  .pcd-lib__close {
    width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; cursor: pointer;
    display: flex; align-items: center; justify-content: center; color: #fff1cd;
    background: rgba(255,241,205,0.08); border: 1px solid rgba(255,241,205,0.16);
    transition: background .16s ease, transform .16s ease;
  }
  .pcd-lib__close:hover { background: rgba(255,241,205,0.16); transform: rotate(90deg); }
  .pcd-lib__tabs { position: relative; z-index: 1; margin: 0 28px; display: flex; background: rgba(255,241,205,0.07); border: 1px solid rgba(255,241,205,0.12); border-radius: 999px; padding: 3px; width: max-content; }
  .pcd-lib__slider { position: absolute; top: 3px; bottom: 3px; width: calc(50% - 3px); border-radius: 999px; background: #fff1cd; box-shadow: 0 2px 10px rgba(0,0,0,0.18); transition: transform .32s cubic-bezier(0.34,1.4,0.5,1); }
  .pcd-lib__tab { position: relative; z-index: 1; display: flex; align-items: center; gap: 7px; cursor: pointer; background: transparent; border: 0; padding: 9px 26px; font-family: 'Macabro','Anton',sans-serif; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; transition: color .2s ease; }
  .pcd-lib__list { position: relative; z-index: 1; flex: 1; min-height: 0; margin-top: 18px; padding: 4px 28px 28px; overflow-y: auto; display: grid; grid-template-columns: 1fr; grid-auto-rows: max-content; gap: 12px; }
  .pcd-lib__list.is-empty { display: block; }
  .pcd-lib-card {
    position: relative;
    display: flex; gap: 0; text-align: left; cursor: pointer; overflow: hidden;
    border-radius: 14px; background: rgba(255,241,205,0.07); border: 1px solid rgba(255,241,205,0.10);
    transition: background .16s ease, transform .16s ease, border-color .16s ease;
  }
  .pcd-lib-card:hover { background: rgba(255,241,205,0.13); border-color: rgba(255,241,205,0.24); transform: translateY(-2px); }
  .pcd-lib-card__remove {
    position: absolute; top: 8px; right: 8px; z-index: 2;
    width: 27px; height: 27px; border-radius: 50%; cursor: pointer;
    display: flex; align-items: center; justify-content: center; color: #fff1cd;
    background: rgba(4,12,40,0.62); border: 1px solid rgba(255,241,205,0.20);
    opacity: 0; transform: scale(0.9); transition: opacity .15s ease, background .15s ease, border-color .15s ease, transform .15s ease;
  }
  .pcd-lib-card:hover .pcd-lib-card__remove, .pcd-lib-card:focus-within .pcd-lib-card__remove { opacity: 1; transform: scale(1); }
  .pcd-lib-card__remove:hover { background: #bd453c; border-color: #bd453c; }
  .pcd-lib-card__img { width: 116px; flex-shrink: 0; align-self: stretch; position: relative; overflow: hidden; background: rgba(0,0,0,0.2); }
  .pcd-lib-card__img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .pcd-lib-card__body { flex: 1; min-width: 0; padding: 13px 15px; display: flex; flex-direction: column; gap: 9px; }
  .pcd-lib-card__meta { display: flex; align-items: center; gap: 7px; }
  .pcd-lib-card__cat { display: inline-flex; align-items: center; gap: 5px; font-family: 'Macabro','Anton',sans-serif; font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,241,205,0.85); background: rgba(255,241,205,0.10); border: 1px solid rgba(255,241,205,0.16); border-radius: 999px; padding: 3px 8px; }
  .pcd-lib-card__src { font-family: 'Macabro','Anton',sans-serif; font-size: 8.5px; letter-spacing: 0.08em; color: rgba(255,241,205,0.5); }
  .pcd-lib-card__title { font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 14.5px; line-height: 1.3; color: #fff1cd; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .pcd-lib__empty { text-align: center; padding: 56px 24px 64px; }
  .pcd-lib__empty-ic { width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 18px; display: flex; align-items: center; justify-content: center; background: rgba(255,241,205,0.10); border: 1px solid rgba(255,241,205,0.20); }
  .pcd-lib__empty-h { font-family: 'Macabro','Anton',sans-serif; font-size: 19px; letter-spacing: 0.02em; color: #fff1cd; margin: 0 0 8px; }
  .pcd-lib__empty-p { font-family: 'Manrope', sans-serif; font-size: 14px; color: rgba(255,241,205,0.5); max-width: 320px; margin: 0 auto; line-height: 1.5; }
  @media (max-width: 720px) {
    .pcd-lib__list { grid-template-columns: 1fr; }
  }
`;

// Compact relative time for the notifications list ("now", "3m", "2h", "5d").
function relTimeShort(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function ProfileMenu({
  userName,
  userHandle,
  userAvatar,
  userTopics,
  savedCount,
  likedCount,
  onOpenLibrary,
  onOpenLegal,
  onOpenSettings,
  onSignOut,
}: {
  userName: string | null;
  userHandle: string | null;
  userAvatar: string | null;
  userTopics: string[];
  savedCount: number;
  likedCount: number;
  onOpenLibrary: (tab: "likes" | "saved") => void;
  onOpenLegal: (kind: LegalKind) => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reply notifications — the web equivalent of the app's red dot over the
  // profile popcorn. Backed by the same Supabase `notifications` table +
  // realtime, so a reply lights the dot here exactly like on mobile.
  const { user } = useAuth();
  const { items: notifs, unreadCount, markAllRead, deleteOne, deleteAll } = useNotifications(user);

  // The notifications now live in their own popup (opened from the dropdown).
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  // Opening the notifications popup surfaces the list, so clear the unread
  // badge shortly after — long enough to register the highlight, then it
  // settles to "seen" (mirrors tapping the app's notifications sheet).
  useEffect(() => {
    if (!notifModalOpen || unreadCount === 0) return;
    const t = setTimeout(() => { void markAllRead(); }, 800);
    return () => clearTimeout(t);
  }, [notifModalOpen, unreadCount, markAllRead]);

  const initialSource = userName ?? userHandle?.replace(/^@/, "") ?? "?";
  const initial = (initialSource[0] ?? "?").toUpperCase();

  // Anchor the portalled panel to the trigger (the masthead clips overflow,
  // so the dropdown is rendered to <body> with fixed coords). Recompute on
  // open + on scroll/resize so it tracks the sticky masthead.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ top: r.bottom + 12, right: Math.max(12, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Close on outside-click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const goLibrary = (tab: "likes" | "saved") => { setOpen(false); onOpenLibrary(tab); };

  return (
    <div className="pcd-pm" ref={wrapRef}>
      <button
        type="button"
        className="pcd-pm-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pcd-pm-av">
          {userAvatar ? <img src={userAvatar} alt={userName ?? "Profile"} /> : <span>{initial}</span>}
        </span>
        {unreadCount > 0 && <span className="pcd-pm-dot" aria-label={`${unreadCount} new notification${unreadCount > 1 ? "s" : ""}`} />}
        {userName && <span className="pcd-pm-name">{userName}</span>}
        <ChevronDown className="pcd-pm-chev" size={14} strokeWidth={2} />
      </button>

      {open && createPortal(
        <div className="pcd-pm-panel" role="menu" ref={panelRef} style={{ top: pos.top, right: pos.right }}>
          <div className="pcd-pm-grain" aria-hidden><GrainBackground variant="popcorn-blue" /></div>
          <div className="pcd-pm-body">
            <div className="pcd-pm-head">
              <span className="pcd-pm-headav">
                {userAvatar ? <img src={userAvatar} alt={userName ?? "Profile"} /> : <span>{initial}</span>}
              </span>
              <div style={{ minWidth: 0 }}>
                {userName && <h2 className="pcd-pm-headname">{userName}</h2>}
                {userHandle && <p className="pcd-pm-headhandle">{userHandle}</p>}
              </div>
            </div>

            <div className="pcd-pm-rule" />

            <button
              type="button"
              className="pcd-pm-link"
              onClick={() => { setOpen(false); setNotifModalOpen(true); }}
            >
              <span className="pcd-pm-link__lead"><Bell size={15} strokeWidth={2} />Notifications</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {unreadCount > 0 && <span className="pcd-pm-notifcount">{unreadCount}</span>}
                <ChevronRight size={15} strokeWidth={2} style={{ color: "rgba(255,241,205,0.5)" }} />
              </span>
            </button>

            <div className="pcd-pm-rule" />

            <p className="pcd-pm-eyebrow">Library</p>
            <button type="button" className="pcd-pm-libtile" onClick={() => goLibrary("saved")}>
              <span className="pcd-pm-libtile__ic">
                <Bookmark size={16} strokeWidth={2} />
              </span>
              <span className="pcd-pm-libtile__txt">
                <span className="pcd-pm-libtile__label">Library</span>
                <span className="pcd-pm-libtile__count">
                  {savedCount} saved · {likedCount} liked
                </span>
              </span>
              <ChevronRight size={16} strokeWidth={2} style={{ color: "rgba(255,241,205,0.5)", flexShrink: 0 }} />
            </button>

            {userTopics.length > 0 && (
              <>
                <div className="pcd-pm-rule" />
                <p className="pcd-pm-eyebrow">Your Topics</p>
                <div className="pcd-pm-topics">
                  {userTopics.map((t) => <span key={t} className="pcd-pm-topic">{t}</span>)}
                </div>
              </>
            )}

            <div className="pcd-pm-rule" />
            <button type="button" className="pcd-pm-link" onClick={() => { setOpen(false); onOpenSettings(); }}>
              <span className="pcd-pm-link__lead"><Settings size={15} strokeWidth={2} />Account settings</span>
              <ChevronRight size={15} strokeWidth={2} style={{ color: "rgba(255,241,205,0.5)" }} />
            </button>
            <button type="button" className="pcd-pm-link" onClick={() => { setOpen(false); onOpenLegal("about"); }}>
              <span className="pcd-pm-link__lead">About Popcorn</span>
              <ChevronRight size={15} strokeWidth={2} style={{ color: "rgba(255,241,205,0.5)" }} />
            </button>

            <div className="pcd-pm-rule" />
            <button type="button" className="pcd-pm-signout" onClick={() => { setOpen(false); onSignOut(); }}>
              <LogOut size={14} strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>,
        document.body,
      )}

      {notifModalOpen && (
        <NotificationsModal
          items={notifs}
          onClose={() => setNotifModalOpen(false)}
          onDelete={deleteOne}
          onClearAll={deleteAll}
        />
      )}
    </div>
  );
}

/** NotificationsModal — small centered popup listing the user's reply
 *  notifications. Scrollable, with per-row delete (hover X) and a Clear all
 *  action. Mirrors the app's NotificationsSheet on the web surface. */
function NotificationsModal({
  items, onClose, onDelete, onClearAll,
}: {
  items: DBNotification[];
  onClose: () => void;
  onDelete: (id: number) => void;
  onClearAll: () => void;
}) {
  // Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="pcd-ntf-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pcd-ntf" role="dialog" aria-modal="true" aria-label="Notifications">
        <div className="pcd-ntf__grain" aria-hidden><GrainBackground variant="popcorn-blue" /></div>

        <div className="pcd-ntf__head">
          <div style={{ minWidth: 0 }}>
            <p className="pcd-ntf__eyebrow">Popcorn · Activity</p>
            <h2 className="pcd-ntf__title">Notifications</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {items.length > 0 && (
              <button type="button" className="pcd-ntf__clear" onClick={onClearAll}>Clear all</button>
            )}
            <button type="button" className="pcd-ntf__close" aria-label="Close" onClick={onClose}>
              <X size={17} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="pcd-ntf__body">
          {items.length === 0 ? (
            <div className="pcd-ntf__empty">
              <p className="pcd-ntf__empty-h">Quiet for now</p>
              <p className="pcd-ntf__empty-p">When someone replies to one of your comments, you'll hear about it here.</p>
            </div>
          ) : (
            items.map((n) => (
              <div key={n.id} className={`pcd-ntf-row${n.read_at ? "" : " is-unread"}`}>
                <span className="pcd-ntf-row__av" style={{ background: avatarColor(n.actor_name) }}>
                  {n.actor_name.replace(/^@/, "").slice(0, 2).toUpperCase()}
                </span>
                <span className="pcd-ntf-row__txt">
                  <span className="pcd-ntf-row__head"><strong>{n.actor_name}</strong> replied · {relTimeShort(n.created_at)}</span>
                  <span className="pcd-ntf-row__preview">{n.preview}</span>
                </span>
                <button
                  type="button"
                  className="pcd-ntf-row__del"
                  aria-label="Delete notification"
                  onClick={() => onDelete(n.id)}
                >
                  <Trash2 size={15} strokeWidth={2} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LibraryOverlay({
  initialTab,
  savedArticles,
  likedArticles,
  onReadMore,
  onClose,
}: {
  initialTab: "likes" | "saved";
  savedArticles: NewsArticle[];
  likedArticles: NewsArticle[];
  onReadMore: (a: NewsArticle) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"likes" | "saved">(initialTab);
  const list = tab === "likes" ? likedArticles : savedArticles;
  const saves = useSavedArticles();
  const likes = useLikedArticles();

  const removeArticle = (a: NewsArticle) => {
    if (tab === "saved") void saves.toggleSave(a.id);
    else void likes.toggleLike(a.id, likes.likeCountFor(a));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const empty = tab === "likes"
    ? { Icon: Heart, title: "No likes yet", body: "Tap the heart on any story to keep your favourites here." }
    : { Icon: Bookmark, title: "Nothing saved yet", body: "Bookmark articles as you read to build your reading list." };

  return (
    <div className="pcd-lib-overlay" role="dialog" aria-modal="true" aria-label="Library" onClick={onClose}>
      <div className="pcd-lib" onClick={(e) => e.stopPropagation()}>
        <div className="pcd-lib__grain" aria-hidden><GrainBackground variant="popcorn-blue" /></div>
        <div className="pcd-lib__head">
          <div>
            <h2 className="pcd-lib__title">Library</h2>
            <p className="pcd-lib__sub">{list.length} {list.length === 1 ? "article" : "articles"}</p>
          </div>
          <button type="button" className="pcd-lib__close" onClick={onClose} aria-label="Close library">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="pcd-lib__tabs" role="tablist">
          <span className="pcd-lib__slider" style={{ transform: tab === "saved" ? "translateX(0)" : "translateX(100%)" }} aria-hidden />
          {(["saved", "likes"] as const).map((t) => {
            const active = tab === t;
            const Icon = t === "likes" ? Heart : Bookmark;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                className="pcd-lib__tab"
                onClick={() => setTab(t)}
                style={{ color: active ? BLUE : "rgba(255,241,205,0.62)" }}
              >
                <Icon size={14} strokeWidth={2} fill={active && t === "likes" ? BLUE : "none"} />
                {t === "likes" ? "Likes" : "Saved"}
              </button>
            );
          })}
        </div>

        {list.length === 0 ? (
          <div className="pcd-lib__list is-empty">
            <div className="pcd-lib__empty">
              <div className="pcd-lib__empty-ic"><empty.Icon size={30} strokeWidth={1.6} style={{ color: "#fff1cd" }} /></div>
              <h3 className="pcd-lib__empty-h">{empty.title}</h3>
              <p className="pcd-lib__empty-p">{empty.body}</p>
            </div>
          </div>
        ) : (
          <div className="pcd-lib__list" key={tab}>
            {list.map((a) => (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                className="pcd-lib-card"
                onClick={() => { onClose(); onReadMore(a); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); onReadMore(a); } }}
              >
                {a.imageUrl && (
                  <div className="pcd-lib-card__img">
                    <img src={feedImageUrl(a.imageUrl)} alt="" loading="lazy" />
                  </div>
                )}
                <div className="pcd-lib-card__body">
                  <div className="pcd-lib-card__meta">
                    <span className="pcd-lib-card__cat">
                      <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: CATEGORY_COLORS[a.category] ?? "rgba(255,241,205,0.4)" }} />
                      {a.category}
                    </span>
                    <span className="pcd-lib-card__src">{a.source}</span>
                  </div>
                  <p className="pcd-lib-card__title">{a.title}</p>
                </div>
                <button
                  type="button"
                  className="pcd-lib-card__remove"
                  aria-label={tab === "saved" ? "Remove from saved" : "Remove from likes"}
                  title={tab === "saved" ? "Remove from saved" : "Remove from likes"}
                  onClick={(e) => { e.stopPropagation(); removeArticle(a); }}
                >
                  <X size={14} strokeWidth={2.6} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** AccountSettingsModal — web equivalent of the app's SettingsSheet. Opens
 *  from the profile dropdown's "Account settings" row. Lets the user edit
 *  their display name, change their password, and delete their account, all
 *  in the same blue+cream surface used across the account UI. */
function AccountSettingsModal({ onClose, currentUser }: { onClose: () => void; currentUser?: SupaUser | null }) {
  const { user: authUser, profile, updateProfile, updatePassword, deleteAccount } = useAuth();

  // This modal's useAuth instance can hand back a null user while it resolves;
  // read the session fresh on mount and prefer that so email/Google-detection
  // aren't blank.
  const [liveUser, setLiveUser] = useState<SupaUser | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && session?.user) setLiveUser(session.user);
    });
    return () => { active = false; };
  }, []);
  const user = currentUser ?? liveUser ?? authUser;

  const dnMeta = user?.user_metadata as { full_name?: string; name?: string; first_name?: string } | undefined;
  const initialName = (dnMeta?.full_name || dnMeta?.name || dnMeta?.first_name || "").trim();
  const handle = profile?.username ?? null;
  const userEmail = user?.email || (user?.user_metadata as { email?: string } | undefined)?.email || "";
  const dnApp = user?.app_metadata as { provider?: string; providers?: string[] } | undefined;
  const dnIdentities = (user?.identities ?? []) as { provider?: string }[];
  const isGoogle =
    dnIdentities.some((i) => i.provider === "google") ||
    dnApp?.provider === "google" ||
    (dnApp?.providers ?? []).includes("google");

  const [panel, setPanel] = useState<"root" | "name" | "password" | "delete">("root");

  // Display-name form
  const [nameDraft, setNameDraft] = useState(initialName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  // This modal's useAuth instance can resolve the user a beat after mount, so
  // fill the still-empty name draft once it arrives (else the field reads blank
  // even though the account has a name).
  useEffect(() => {
    if (initialName && !nameDraft) setNameDraft(initialName);
  }, [initialName, nameDraft]);

  // Password form
  const [pwCurrent, setPwCurrent] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  // Delete form
  const [delConfirm, setDelConfirm] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);
  const [delStage, setDelStage] = useState<"idle" | "deleting" | "farewell">("idle");
  const delReady = delConfirm.trim().toUpperCase() === "DELETE";
  const locked = delStage === "deleting" || delStage === "farewell";

  // Escape closes (unless mid-delete).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !locked) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, locked]);

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) { setNameMsg({ kind: "err", text: "Name can't be empty." }); return; }
    if (trimmed === initialName) { setPanel("root"); return; }
    setNameSaving(true);
    setNameMsg(null);
    try {
      await updateProfile({ full_name: trimmed });
      setNameMsg({ kind: "ok", text: "Saved." });
      setTimeout(() => { setNameMsg(null); setPanel("root"); }, 900);
    } catch (e) {
      setNameMsg({ kind: "err", text: e instanceof Error ? e.message : "Couldn't save — try again." });
    } finally {
      setNameSaving(false);
    }
  };

  const savePassword = async () => {
    if (!pwCurrent) { setPwMsg({ kind: "err", text: "Enter your current password." }); return; }
    if (pw1.length < 8) { setPwMsg({ kind: "err", text: "New password must be at least 8 characters." }); return; }
    if (pw1 === pwCurrent) { setPwMsg({ kind: "err", text: "Your new password must be different from your current one." }); return; }
    if (pw1 !== pw2) { setPwMsg({ kind: "err", text: "Passwords don't match." }); return; }
    setPwSaving(true);
    setPwMsg(null);
    try {
      // Verify the current password first (re-auth), timeout-guarded.
      const verify = await Promise.race([
        supabase.auth.signInWithPassword({ email: userEmail, password: pwCurrent }),
        new Promise<{ error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ error: { message: "__timeout__" } }), 12000),
        ),
      ]);
      if ((verify as { error: { message?: string } | null }).error) {
        const vmsg = ((verify as { error: { message?: string } }).error.message || "").toLowerCase();
        setPwMsg({
          kind: "err",
          text: vmsg.includes("__timeout__")
            ? "This is taking longer than expected — please try again."
            : "Your current password is incorrect.",
        });
        setPwSaving(false);
        return;
      }
      await updatePassword(pw1);
      setPwMsg({ kind: "ok", text: "Password updated." });
      setPwCurrent(""); setPw1(""); setPw2("");
      setTimeout(() => { setPwMsg(null); setPanel("root"); }, 1100);
    } catch (e) {
      setPwMsg({ kind: "err", text: e instanceof Error ? e.message : "Couldn't update password." });
    } finally {
      setPwSaving(false);
    }
  };

  const runDelete = async () => {
    if (!delReady || delStage !== "idle") return;
    setDelErr(null);
    setDelStage("deleting");
    try {
      await deleteAccount();
      setDelStage("farewell");
      // The App-level farewell overlay takes over (deleteAccount fires it);
      // its "Back to Popcorn" button reloads into the signed-out site.
    } catch (e) {
      setDelStage("idle");
      setDelErr(e instanceof Error ? e.message : "Couldn't delete account.");
    }
  };

  return createPortal(
    <div
      className="pcd-set-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}
    >
      <div className="pcd-set" role="dialog" aria-modal="true" aria-label="Account settings">
        <div className="pcd-set__grain" aria-hidden><GrainBackground variant="popcorn-blue" /></div>

        {delStage === "farewell" ? (
          <div className="pcd-del__farewell">
            <h3>Sorry to see you go.</h3>
            <p>Your account has been deleted. We hope you'll be back soon.</p>
          </div>
        ) : (
          <>
            <div className="pcd-set__head">
              <div style={{ minWidth: 0 }}>
                <p className="pcd-set__eyebrow">Popcorn · Account</p>
                <h2 className="pcd-set__title">Settings</h2>
                {handle && <p className="pcd-set__sub">Signed in as <b>@{handle}</b></p>}
              </div>
              {!locked && (
                <button type="button" className="pcd-set__close" aria-label="Close" onClick={onClose}>
                  <X size={17} strokeWidth={2.25} />
                </button>
              )}
            </div>

            <div className="pcd-set__body">
              <p className="pcd-set__seclabel">Account</p>

              {/* Email — read-only (the address you're signed in with) */}
              <div className="pcd-set-row" style={{ cursor: "default" }}>
                <div style={{ minWidth: 0 }}>
                  <p className="pcd-set-row__label">Email</p>
                  <p className="pcd-set-row__value" style={{ wordBreak: "break-all" }}>{userEmail || "—"}</p>
                </div>
              </div>

              {/* Display name */}
              <button
                type="button"
                className={`pcd-set-row${panel === "name" ? " is-open" : ""}`}
                onClick={() => { setNameDraft(initialName); setNameMsg(null); setPanel(panel === "name" ? "root" : "name"); }}
              >
                <div style={{ minWidth: 0 }}>
                  <p className="pcd-set-row__label">Display name</p>
                  <p className="pcd-set-row__value">{initialName || "Not set"}</p>
                </div>
                <Pencil className="pcd-set-row__ic" size={15} strokeWidth={2} />
              </button>

              {panel === "name" && (
                <div className="pcd-set-panel">
                  <label className="pcd-set-panel__label">New name</label>
                  <input
                    className={`pcd-set-input${nameMsg?.kind === "ok" ? " is-ok" : nameMsg?.kind === "err" ? " is-bad" : ""}`}
                    autoFocus
                    maxLength={60}
                    value={nameDraft}
                    placeholder="Your name"
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void saveName(); }}
                  />
                  {nameMsg && <p className={`pcd-set-msg ${nameMsg.kind === "ok" ? "is-ok" : "is-err"}`}>{nameMsg.text}</p>}
                  <div className="pcd-set-acts">
                    <button type="button" className="pcd-set-btn-ghost" onClick={() => setPanel("root")}>Cancel</button>
                    <button
                      type="button"
                      className="pcd-set-btn-go"
                      onClick={() => void saveName()}
                      disabled={nameSaving || !nameDraft.trim() || nameDraft.trim() === initialName}
                    >
                      {nameSaving ? "Saving…" : "Save"}
                      {!nameSaving && <ArrowRight size={14} strokeWidth={2.5} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Password */}
              <button
                type="button"
                className={`pcd-set-row${panel === "password" ? " is-open" : ""}`}
                onClick={() => { setPwMsg(null); setPanel(panel === "password" ? "root" : "password"); }}
              >
                <div style={{ minWidth: 0 }}>
                  <p className="pcd-set-row__label">Password</p>
                  <p className="pcd-set-row__value">{isGoogle ? "Signed in with Google" : "Change your password"}</p>
                </div>
                <ChevronRight className="pcd-set-row__ic pcd-set-row__chev" size={16} strokeWidth={2.25} />
              </button>

              {panel === "password" && (
                <div className="pcd-set-panel">
                  {isGoogle ? (
                    <p className="pcd-set-msg" style={{ color: "rgba(255,241,205,0.65)", lineHeight: 1.6 }}>
                      You signed in with Google, so there's no Popcorn password to change. Manage your password in your Google Account.
                    </p>
                  ) : (
                    <>
                  <label className="pcd-set-panel__label">Current password</label>
                  <input
                    className="pcd-set-input"
                    type={showPw ? "text" : "password"}
                    autoFocus
                    value={pwCurrent}
                    placeholder="Your current password"
                    onChange={(e) => setPwCurrent(e.target.value)}
                  />
                  <label className="pcd-set-panel__label">New password</label>
                  <div className="pcd-set-pwwrap">
                    <input
                      className="pcd-set-input"
                      type={showPw ? "text" : "password"}
                      value={pw1}
                      placeholder="At least 8 characters"
                      onChange={(e) => setPw1(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pcd-set-pweye"
                      aria-label={showPw ? "Hide password" : "Show password"}
                      onClick={() => setShowPw((v) => !v)}
                    >
                      {showPw ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                    </button>
                  </div>
                  <label className="pcd-set-panel__label">Confirm</label>
                  <input
                    className={`pcd-set-input${pw2.length > 0 && pw1 === pw2 ? " is-ok" : pw2.length > 0 ? " is-bad" : ""}`}
                    type={showPw ? "text" : "password"}
                    value={pw2}
                    placeholder="Re-type the new password"
                    onChange={(e) => setPw2(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void savePassword(); }}
                  />
                  {pwMsg && <p className={`pcd-set-msg ${pwMsg.kind === "ok" ? "is-ok" : "is-err"}`}>{pwMsg.text}</p>}
                  {!pwMsg && pw2.length > 0 && pw1 === pw2 && <p className="pcd-set-msg is-ok">Passwords match.</p>}
                  {!pwMsg && pw2.length > 0 && pw1 !== pw2 && <p className="pcd-set-msg is-err">Passwords don't match.</p>}
                  <div className="pcd-set-acts">
                    <button type="button" className="pcd-set-btn-ghost" onClick={() => setPanel("root")}>Cancel</button>
                    <button
                      type="button"
                      className="pcd-set-btn-go"
                      onClick={() => void savePassword()}
                      disabled={pwSaving || !pwCurrent || pw1.length < 8 || pw1 !== pw2}
                    >
                      {pwSaving ? "Saving…" : "Update"}
                      {!pwSaving && <ArrowRight size={14} strokeWidth={2.5} />}
                    </button>
                  </div>
                    </>
                  )}
                </div>
              )}

              {/* Danger zone */}
              <p className="pcd-set__seclabel is-danger">Danger zone</p>
              {panel !== "delete" ? (
                <button
                  type="button"
                  className="pcd-set-danger"
                  onClick={() => { setDelConfirm(""); setDelErr(null); setDelStage("idle"); setPanel("delete"); }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p className="pcd-set-danger__label">Delete account</p>
                    <p className="pcd-set-danger__p">Permanently erase your account and all your data.</p>
                  </div>
                  <ChevronRight size={16} strokeWidth={2.25} style={{ color: "rgba(255,179,171,0.7)", flexShrink: 0 }} />
                </button>
              ) : (
                <div className="pcd-set-delpanel">
                  <p className="pcd-set-delpanel__h">This can't be undone.</p>
                  <p className="pcd-set-delpanel__p">
                    This permanently deletes your account and all your data — profile, comments, likes, and saved articles.
                    Type <code>DELETE</code> below to confirm.
                  </p>
                  <input
                    className={`pcd-set-delinput${delReady ? " is-ready" : ""}`}
                    autoFocus
                    value={delConfirm}
                    placeholder="DELETE"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={delStage === "deleting"}
                    onChange={(e) => setDelConfirm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void runDelete(); }}
                  />
                  {delErr && <p className="pcd-set-msg is-err">{delErr}</p>}
                  <div className="pcd-set-acts">
                    <button
                      type="button"
                      className="pcd-set-btn-ghost"
                      disabled={delStage === "deleting"}
                      onClick={() => { setPanel("root"); setDelConfirm(""); setDelErr(null); setDelStage("idle"); }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`pcd-set-delbtn${delReady && delStage === "idle" ? " is-ready" : ""}`}
                      disabled={!delReady || delStage === "deleting"}
                      onClick={() => void runDelete()}
                    >
                      {delStage === "deleting" ? "Deleting…" : "Delete my account"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
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

/* Scalloped wave — echoes the popcorn-bucket rim. Renders as a top edge
   on a coloured strip (the wave bites into the strip from above).
   When `cutout` is true, the SVG is transparent and the path fills the
   AREA ABOVE the wave with `bg` — meant to overlay a textured field so
   the bumps inherit the texture underneath. */
function ScallopDivider({
  color = BLUE,
  bg = PAPER,
  scallops = 36,
  height = 22,
  flip = false,
  cutout = false,
}: {
  color?: string;
  bg?: string;
  scallops?: number;
  height?: number;
  flip?: boolean;
  cutout?: boolean;
}) {
  const w = 1600;
  const r = w / scallops / 2;
  const totalH = height + 40;

  if (cutout) {
    // Cap that covers the area ABOVE the wave on a transparent SVG.
    // Bumps poke up from y=height into the cap area; valleys reach y=height.
    let d = `M 0 0 L ${w} 0 L ${w} ${height} `;
    for (let i = scallops - 1; i >= 0; i--) {
      const cx = i * r * 2 + r;
      d += `Q ${cx} ${height - r * 1.6} ${i * r * 2} ${height} `;
    }
    d += `L 0 0 Z`;
    return (
      <svg
        viewBox={`0 0 ${w} ${totalH}`}
        className="block w-full"
        style={{ height: totalH, transform: flip ? "scaleY(-1)" : undefined }}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d={d} fill={bg} />
      </svg>
    );
  }

  let d = `M0 ${height} `;
  for (let i = 0; i < scallops; i++) {
    const cx = i * r * 2 + r;
    d += `Q ${cx} ${height - r * 1.6} ${cx + r} ${height} `;
  }
  d += `L ${w} ${totalH} L 0 ${totalH} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${totalH}`}
      className="block w-full"
      style={{ height: totalH, transform: flip ? "scaleY(-1)" : undefined, background: bg }}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={d} fill={color} />
    </svg>
  );
}

function Footer() {
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);
  const openLegal = (kind: LegalKind) => (e: ReactMouseEvent) => {
    e.preventDefault();
    setLegalKind(kind);
  };

  // Footer newsletter signup — posts to the same endpoint as the side tab.
  const [footEmail, setFootEmail] = useState("");
  const [footState, setFootState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [footErr, setFootErr] = useState("");
  const submitFooter = async (e: ReactFormEvent) => {
    e.preventDefault();
    if (footState === "loading") return;
    setFootErr("");
    setFootState("loading");
    try {
      const res = await fetch(`${apiBase()}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: footEmail, source: "website-footer" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFootState("error");
        setFootErr(d?.error || "Couldn't sign you up — please try again.");
        return;
      }
      setFootState("done");
    } catch {
      setFootState("error");
      setFootErr("Network error — please try again.");
    }
  };
  return (
    <>
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

      {/* Scalloped rim — paper cutout overlaid on the textured blue so the
          bumps you see ARE the textured field showing through. Positioned
          absolutely at the top edge so it shapes the footer without adding
          height (nothing gets pushed up). */}
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1, pointerEvents: "none" }}>
        <ScallopDivider cutout bg={PAPER} scallops={42} height={18} />
      </div>

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
            src="/logo-latest.png"
            alt="Popcorn"
            style={{
              height: 110,
              marginTop: 28,
              display: "block",
            }}
          />
          <span
            style={{
              display: "block",
              marginTop: 22,
              fontFamily: SANS,
              fontSize: 10.5,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 500,
              color: "rgba(255,255,255,0.65)",
            }}
          >
            © Popcorn Media {new Date().getFullYear()}
          </span>
        </div>

        <FooterColumn
          title="Sections"
          items={["Film & TV", "Music", "Internet", "Culture", "Fashion", "Tech"]}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <h5
            style={{
              fontFamily: MACABRO,
              fontSize: 15,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 400,
              color: "#fff",
              margin: "0 0 18px",
            }}
          >
            Popcorn
          </h5>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {([["About", "about"], ["Terms", "terms"], ["Privacy", "privacy"]] as [string, LegalKind][]).map(
              ([label, kind]) => (
                <li key={kind}>
                  <a
                    href="#"
                    onClick={openLegal(kind)}
                    style={{ fontFamily: SANS, fontSize: 14, color: "#fff", textDecoration: "none" }}
                  >
                    {label}
                  </a>
                </li>
              ),
            )}
          </ul>
        </div>

        <div>
          <h5
            style={{
              fontFamily: MACABRO,
              fontSize: 15,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 400,
              color: "#fff",
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
          {footState === "done" ? (
            <p
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: 15,
                color: "#fff",
                marginTop: 14,
              }}
            >
              You're in — see you in your inbox.
            </p>
          ) : (
            <>
              <form
                onSubmit={submitFooter}
                style={{
                  display: "flex",
                  marginTop: 12,
                  border: "1px solid rgba(255,255,255,0.4)",
                  background: "transparent",
                }}
              >
                <input
                  type="email"
                  required
                  value={footEmail}
                  onChange={(e) => {
                    setFootEmail(e.target.value);
                    if (footState === "error") setFootState("idle");
                  }}
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
                  disabled={footState === "loading"}
                  style={{
                    background: "#fff",
                    color: BLUE,
                    border: 0,
                    padding: "10px 16px",
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    cursor: footState === "loading" ? "default" : "pointer",
                    opacity: footState === "loading" ? 0.7 : 1,
                    fontFamily: SANS,
                  }}
                >
                  {footState === "loading" ? "…" : "Join"}
                </button>
              </form>
              {footState === "error" && (
                <p style={{ fontFamily: SANS, fontSize: 12, color: "#ffd9d4", margin: "8px 0 0" }}>
                  {footErr}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: MAX_W,
          margin: "28px auto 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <a
          href="https://instagram.com/news.popcorn"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Popcorn on Instagram"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.4)",
            color: "#fff",
            transition: "background .25s ease, color .25s ease",
          }}
        >
          <Instagram size={18} strokeWidth={1.8} />
        </a>
        <a
          href="mailto:hello@popcornmedia.org"
          style={{
            fontFamily: MACABRO,
            fontSize: 16,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          Contact us
        </a>
      </div>
    </footer>
    <DragLegalModal kind={legalKind} onClose={() => setLegalKind(null)} />
    </>
  );
}

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <h5
        style={{
          fontFamily: MACABRO,
          fontSize: 15,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 400,
          color: "#fff",
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

  /* Framed — one random effect-free story is hung like a piece in a gallery:
     a cream mat sits behind the image, a thin ink line draws the frame edge,
     and a soft cast shadow lifts the whole thing off the paper. */
  .card.framed .img {
    box-sizing: border-box;
    padding: clamp(12px, 1.5vw, 22px);
    background: ${CREAM};
    border: 1.5px solid ${INK};
    box-shadow:
      0 1px 0 rgba(255,255,255,0.5) inset,
      0 18px 34px -20px rgba(10,10,10,0.45),
      0 4px 12px -8px rgba(10,10,10,0.30);
    transition: transform .5s cubic-bezier(.22,.61,.36,1),
                box-shadow .5s cubic-bezier(.22,.61,.36,1);
  }
  /* Hairline fillet between the mat and the artwork. */
  .card.framed .img img {
    box-shadow: 0 0 0 1px rgba(10,10,10,0.22);
  }
  /* Lift the frame on hover instead of zooming the image — keeps the mat pristine. */
  .card.framed:hover .img { transform: translateY(-5px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.5) inset,
      0 28px 46px -22px rgba(10,10,10,0.52),
      0 8px 18px -10px rgba(10,10,10,0.34);
  }
  .card.framed:hover .img img { transform: none; }
  /* Park the View-story pill on the mat, bottom-right, like a gallery placard. */
  .card.framed .img::after {
    bottom: clamp(12px, 1.5vw, 22px);
    right: clamp(13px, 1.5vw, 23px);
  }

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
    padding: 8px 36px 0; max-width: ${MAX_W}px; margin: 0 auto;
    border-bottom: 1px solid ${RULE};
    max-height: 180px; overflow: hidden;
    transition: max-height .72s cubic-bezier(.22,.61,.36,1),
                padding-top .72s cubic-bezier(.22,.61,.36,1),
                padding-bottom .72s cubic-bezier(.22,.61,.36,1),
                opacity .5s ease;
  }
  /* The app ad is absolutely positioned, so it can't push the bar taller on
     its own. When it's present (drag mode), give the bar a matching min-height
     so the taller ad isn't clipped by overflow:hidden. */
  .pcd-secnav-bar:has(.pcd-secnav-ad) { min-height: 94px; }
  /* Brand logo parked at the left edge of the filter bar. */
  .pcd-secnav-logo { height: 92px; width: 92px; display: block; flex-shrink: 0; object-fit: cover; object-position: center; }
  /* Brand logo pinned to the right edge; its auto left-margin pushes the filter button to the left.
     align-self:center keeps it vertically centered; the bar sizes tightly around it (with the small
     vertical padding) so the hairline rule sits just beneath it. */
  .pcd-secnav-logoR { order: 1; height: 100px; width: auto; display: block; flex-shrink: 0; align-self: center; margin: -8px 36px -14px auto; }
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
  .pcd-page.is-drag .pcd-stickytop { flex: 0 0 auto; position: static; border-bottom: 1.25px solid ${INK}; }
  .pcd-page.is-drag .drag-shell { flex: 1 1 auto; min-height: 0; }

  .drag-shell {
    --drag-sans: "Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif;
    --drag-display: "Bricolage Grotesque", "Archivo", "Helvetica Neue", sans-serif;
    --drag-foot-h: 48px;
    position: relative;
    display: flex; flex-direction: column; height: 100%;
    /* breathing room below the masthead rule so the rail (and any top-aligned
       slide captions) don't ride flush against the line above it */
    padding-top: 16px;
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
    --rail-gap: clamp(74px, 6.2vw, 124px);
    display: flex; align-items: center; height: 100%;
    gap: var(--rail-gap);
    /* The chevron controls now live on the left/right edges (no bottom deck),
       so the old 92px floor was dead space. Trim it to a 14px gap — slides end
       right at the progress hairline (which sits 60px up), and since the frame
       flex-shrinks rather than spilling, content can never cross it. The
       reclaimed height keeps photos at their full band height. */
    padding: 0 max(36px, 2.5vw) 14px; width: max-content;
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
  /* COVER MOMENT — the edition date as outline-only ghost type, the only
     date on the cover. In flow (not absolute) so it can never overflow the
     panel; sized against both viewport and panel width so it always fits. */
  .drag-intro__big {
    display: block; margin: 0;
    font-family: var(--drag-display); font-weight: 800;
    font-size: clamp(34px, 3.6vw, 58px); line-height: 0.95;
    letter-spacing: -0.03em; text-transform: uppercase; white-space: nowrap;
    color: transparent; -webkit-text-stroke: 1.5px rgba(255,255,255,0.4);
    user-select: none;
  }
  /* the POPCORN masthead — set in the brand wordmark face (Macabro, same as
     the app masthead), letters tumbling up into place one beat apart */
  .drag-intro__mast {
    margin: 0; display: flex; overflow: hidden;
    font-family: "Macabro", "Bodoni Moda", "Didot", serif; font-weight: 400;
    font-size: clamp(30px, 3vw, 46px); line-height: 0.95;
    letter-spacing: 0.02em; color: #fff;
  }
  .drag-intro__mast span {
    display: inline-block;
    animation: mastIn .8s cubic-bezier(.22,.61,.36,1) both;
    animation-delay: calc(var(--li, 0) * 60ms + 200ms);
  }
  @keyframes mastIn {
    from { opacity: 0; transform: translateY(0.7em) rotate(5deg); }
    to   { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .drag-intro__mast span { animation: none; }
  }
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
    flex: 0 0 auto; height: 100%; box-sizing: border-box; position: relative;
    /* Flex column hugging its photo. The frame WIDTH is fixed to the original
       height-band × aspect (var(--fh) * var(--ar)), so image sizes read exactly
       as before. Only the frame HEIGHT is allowed to flex-shrink (see below):
       when a headline wraps to extra lines the photo yields a little height
       instead of shoving the social row down under the progress bar. The photo
       never NARROWS, so headlines keep a stable wrap measure. */
    display: flex; flex-direction: column;
    justify-content: safe center; align-items: flex-start;
    padding: 1.2vh 0;
  }
  /* Captions track the FRAME width (width:0 + min-width:100% means they never
     expand the slide past its image), so every slide hugs its photo. */
  /* Only the IMAGE carries the float offset, so it staggers gently. transform
     doesn't affect flow, so the stagger can never push a caption off-edge. */
  /* The frame keeps its gentle vertical float (--drag-off) AND a small resting
     tilt (--rot); both compose in one transform. On hover the tilt straightens
     while the float is preserved. */
  .drag-frame {
    order: 2; flex: 0 1 auto; min-height: 0; margin: 22px 0;
    /* Width = original height-band (--fh) × aspect (--ar) — identical sizing to
       before. Height starts at the same band but flex-shrink (above) lets it
       give back height when the caption is tall; object-fit: cover crops, so a
       shrunk frame just reads as a tighter letterbox and the caption + social
       row always stay above the progress bar. */
    width: calc(var(--fh, 44vh) * var(--ar, 1.5));
    height: var(--fh, 44vh);
    position: relative; overflow: hidden; background: #ededed; display: block;
    transform: translateY(var(--drag-off, 0px)) rotate(var(--rot, 0deg));
    box-shadow: 0 26px 50px -30px rgba(20,18,16,0.55);
    transition: transform .5s cubic-bezier(.22,.61,.36,1), box-shadow .5s ease;
  }
  .drag-slide:hover .drag-frame { transform: translateY(var(--drag-off, 0px)) rotate(0deg); }
  /* Captions track the FRAME width: width:0 means they contribute nothing to
     the slide's intrinsic width (so a long headline can never stretch the
     slide past its photo), then min-width:100% snaps them to the resolved
     slide width — the frame's. Headlines therefore wrap within the photo. */
  .drag-cat, .drag-title { width: 0; min-width: 100%; flex: 0 0 auto; }
  .drag-cat.is-top, .drag-title.is-top       { order: 1; }
  .drag-cat.is-bottom, .drag-title.is-bottom { order: 3; }

  /* per-slide social bar — travels WITH the caption: when the headline sits
     above the photo the row + its hairline rule sit up there too (order 1),
     and when the headline drops below the photo so does the row (order 3).
     Ink on paper (not white-on-photo). */
  .drag-social {
    width: 0; min-width: 100%; flex: 0 0 auto;
    display: flex; align-items: center; gap: 20px;
    margin-top: 12px; padding-top: 12px;
    border-top: 1px solid ${HAIR};
  }
  .drag-social.is-top    { order: 1; }
  .drag-social.is-bottom { order: 3; }
  .drag-social__btn {
    display: inline-flex; align-items: center; gap: 7px;
    background: none; border: 0; padding: 0; margin: 0; cursor: pointer;
    color: ${INK}; line-height: 1;
    transition: color .2s ease, transform .18s cubic-bezier(.22,.61,.36,1);
    -webkit-tap-highlight-color: transparent;
  }
  .drag-social__btn:hover  { color: ${BLUE}; }
  .drag-social__btn:active { transform: scale(0.88); }
  .drag-social__btn svg    { display: block; }
  .drag-social__btn.is-liked,
  .drag-social__btn.is-liked:hover { color: #e11d48; }
  .drag-social__count {
    font-family: ${SANS}; font-size: 13px; font-weight: 600;
    letter-spacing: 0.01em; color: ${INK2}; font-variant-numeric: tabular-nums;
  }
  .drag-social__save { margin-left: auto; }
  .drag-frame img {
    width: 100%; height: 100%; object-fit: cover;
    transition: transform .8s cubic-bezier(.22,.61,.36,1), filter .5s ease;
  }
  .drag-slide:hover .drag-frame img { transform: scale(1.04); }

  /* ── PARALLAX — the photo pans a touch slower than its frame as it crosses
     the stage, so every image reads as a window onto something deeper.
     Three layers so nothing fights: .drag-par clips (even when the frame
     itself opens overflow for blackframe/framed treatments), .drag-par__in
     carries the per-frame --par shift over a small bleed scale (no
     transition — it's driven every frame), and the img keeps its own slow
     hover-zoom transition untouched. ── */
  .drag-par {
    display: block; width: 100%; height: 100%;
    overflow: hidden;
  }
  .drag-par__in {
    display: block; width: 100%; height: 100%;
    transform: translate3d(var(--par, 0px), 0, 0) scale(1.08);
    will-change: transform;
  }

  /* poster-style offset colour-blocks — a hard, blur-less box-shadow that sits
     down-right of the photo; tightens toward the photo on hover. No tilt. The
     extra right margin keeps the block from eating into the gap to the next
     article, so spacing stays even. */
  .drag-slide.pop, .drag-slide.pop2, .drag-slide.pop3 { margin-right: 18px; }
  /* the offset block hangs 18px below the photo — reserve that depth so it
     never rides over the caption / social row beneath */
  .drag-slide.pop .drag-frame, .drag-slide.pop2 .drag-frame, .drag-slide.pop3 .drag-frame { margin-bottom: 36px; }
  .drag-slide.pop  .drag-frame { box-shadow: 18px 18px 0 ${CREAM}; }
  .drag-slide.pop2 .drag-frame { box-shadow: 18px 18px 0 ${BLOCK_BLUE}; }
  .drag-slide.pop3 .drag-frame { box-shadow: 18px 18px 0 ${BLOCK_BLACK}; }
  .drag-slide.pop:hover  .drag-frame { box-shadow: 10px 10px 0 ${CREAM}; }
  .drag-slide.pop2:hover .drag-frame { box-shadow: 10px 10px 0 ${BLOCK_BLUE}; }
  .drag-slide.pop3:hover .drag-frame { box-shadow: 10px 10px 0 ${BLOCK_BLACK}; }

  /* gallery frame — the lead slide is hung like a framed piece: a thin ink
     line for the frame edge with a transparent gap to the photo, lifted off
     the paper by a soft cast shadow. Overflow opens up so the gap shows. */
  .drag-frame.is-framed {
    box-sizing: border-box; overflow: visible;
    padding: clamp(6px, 0.7vw, 11px);
    background: transparent;
    border: 1.5px solid ${INK};
    box-shadow:
      0 30px 54px -28px rgba(20,18,16,0.55),
      0 8px 20px -12px rgba(20,18,16,0.32);
  }
  .drag-frame.is-framed img {
    box-shadow: 0 0 0 1px rgba(10,10,10,0.22);
  }
  /* lift the whole frame on hover instead of zooming the photo */
  .drag-slide:hover .drag-frame.is-framed { transform: translateY(calc(var(--drag-off, 0px) - 5px)) rotate(0deg); }
  .drag-slide:hover .drag-frame.is-framed img { transform: none; }

  /* thick black border — a frame that sits OUTSIDE the photo (drawn as a larger
     box behind it, so the image keeps its full size). Clean straight edges,
     solid black. */
  /* the frame is drawn OUTSIDE the photo (up to 20px on every side), so the
     photo's stock 18px caption margin isn't enough — reserve the frame depth
     too, or the black band rides over the genre tag / social row */
  .drag-frame.is-blackframe { overflow: visible; margin: calc(18px + clamp(12px, 1.3vw, 20px)) 0; }
  .drag-frame.is-blackframe::before {
    content: ""; position: absolute;
    inset: calc(-1 * clamp(12px, 1.3vw, 20px));
    z-index: 0; pointer-events: none;
    background: ${INK};
    box-shadow: 0 26px 50px -30px rgba(20,18,16,0.55);
  }
  .drag-frame.is-blackframe img { position: relative; z-index: 1; }


  /* height band — driven by image QUALITY (qualityClass), never collapsing
     to a weak thumbnail. Sharper/higher-res photos sit notably taller. */
  /* 50vh (was 57vh): the grid sizes each slide to a definite-height frame, so a
     tall photo can't flex-shrink — at 57vh a d-tall frame plus a 2-line caption
     overran the slide height and clipped the headline top/bottom. 50vh leaves
     headroom for the caption while keeping tall photos visibly taller than d-mid. */
  /* Heights are quality-banded BUT capped against available height: on a short
     laptop the raw vh frame + a 2-3 line caption overran the slide and clipped
     the headline. min(vh, calc(100vh - reserve)) lets the frame shrink only
     when the viewport is too short to hold both — big monitors keep full size,
     small ones yield image height to keep captions fully visible. The reserve
     ≈ top chrome + caption stack + margins + footer breathing room. */
  /* reserve bumped (+60px) over the pre-social-bar values so the like/comment/
     share/save row + its rule always clear the footer — the frame yields height
     to make room rather than letting the social bar slide under the footer. */
  /* Height band (--fh) — driven by image QUALITY, capped against available
     height: min(vh, calc(100vh - reserve)). The frame WIDTH = --fh × aspect
     (--ar), so these bands set the original image sizes; the rendered height
     is free to flex-shrink below --fh under a tall caption. */
  .drag-slide.d-tall  { --fh: min(62vh, calc(100vh - 440px)); }
  .drag-slide.d-mid   { --fh: min(55vh, calc(100vh - 458px)); }
  .drag-slide.d-short { --fh: min(44vh, calc(100vh - 482px)); }
  /* shape — landscape-dominant: a wide 3/2 and a gentler 4/3 carry the rail,
     with only an occasional square, so frames read as horizontal rectangles
     on average rather than vertical slivers. Each shape sets a numeric aspect
     (--ar); frame width = --fh × --ar. */
  .drag-slide.ar-xw .drag-frame { --ar: 1.7778; }
  .drag-slide.ar-w  .drag-frame { --ar: 1.5; }
  .drag-slide.ar-l  .drag-frame { --ar: 1.3333; }
  .drag-slide.ar-sq .drag-frame { --ar: 1; }
  .drag-slide.ar-t  .drag-frame { --ar: 0.8; }

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
    font-size: clamp(18px, 1.45vw, 23px);
  }

  /* ── LOUD slide — every third-or-so story breaks the whisper register:
     the headline jumps to display voice (Bricolage 800 caps), sitting flush
     under the photo like a poster caption. Quiet neighbours stay at the small
     base size so the rail breathes loud → quiet → quiet → loud.
     --loud-size is set per-slide from the headline length so long titles step
     down instead of clipping past the footer. ── */
  .drag-slide.is-loud .drag-cat::before { width: 34px; }
  /* loud frames cap a touch shorter so the big display headline + social row
     always have room; the photo flex-shrinks rather than pushing them off. */
  .drag-slide.is-loud .drag-frame { --fh: min(53vh, calc(100vh - 474px)); }
  .drag-slide.is-loud .drag-title {
    font-family: var(--drag-display); font-weight: 800; text-transform: uppercase;
    font-size: var(--loud-size, clamp(29px, 2.7vw, 45px));
    line-height: 0.96; letter-spacing: -0.015em;
  }

  /* ── POSTER slide — one mid-rail story goes full bleed: floor-to-ceiling
     photo, no frame, no tilt, headline supersized over the image. The rail's
     single cinematic beat. ── */
  .drag-slide.drag-poster { display: block; padding: 0; height: 100%; }
  .drag-poster__frame {
    position: relative; display: block; height: 100%;
    width: clamp(560px, 60vw, 1020px);
    overflow: hidden; cursor: pointer; background: ${INK};
  }
  .drag-poster__frame img {
    width: 100%; height: 100%; object-fit: cover; display: block;
  }
  .drag-poster__shade {
    position: absolute; inset: 0; pointer-events: none; z-index: 1;
    background: linear-gradient(0deg, rgba(4,8,22,0.86) 0%, rgba(4,8,22,0.32) 36%, transparent 60%);
  }
  .drag-poster__cap {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 2;
    padding: clamp(26px, 2.6vw, 46px); color: #fff;
    display: flex; flex-direction: column; gap: 14px; pointer-events: none;
  }
  .drag-poster__cap .tag {
    display: inline-flex; align-items: center; gap: 9px;
    font-size: 10.5px; letter-spacing: 0.24em; text-transform: uppercase;
    font-weight: 700; color: #cdd9f0;
  }
  .drag-poster__cap .tag::before { content: ""; width: 26px; height: 2px; background: #cdd9f0; }
  .drag-poster__cap h3 {
    font-family: var(--drag-display); font-weight: 800; text-transform: uppercase;
    line-height: 0.92; letter-spacing: -0.02em;
    font-size: clamp(38px, 4.2vw, 70px); margin: 0; max-width: 16ch; text-wrap: balance;
  }

  /* ── INDEX interlude — a photographer's CONTACT SHEET of the edition:
     the day's stories as small mono frames pinned to the signature-blue
     panel. Hovering a frame washes it back to colour and surfaces its
     headline in the caption line below; click jumps straight to the story.
     Image-led like the rest of the rail — no numbers, no list chrome. ── */
  .drag-index {
    flex: 0 0 auto; align-self: center;
    width: min(40vw, 560px);
    background: ${BLUE}; color: ${CREAM};
    display: flex; flex-direction: column; gap: 18px;
    padding: clamp(24px, 2.4vw, 42px);
    position: relative; isolation: isolate; overflow: hidden;
  }
  .drag-index__grain { position: absolute; inset: 0; opacity: 0.55; mix-blend-mode: overlay; pointer-events: none; z-index: 0; }
  .drag-index > :not(.drag-index__grain) { position: relative; z-index: 1; }
  .drag-index__kicker {
    display: flex; align-items: center; gap: 14px;
    font-size: 10.5px; letter-spacing: 0.3em; text-transform: uppercase;
    font-weight: 700; color: #ffffff;
  }
  .drag-index__kicker::after { content: ""; flex: 1; height: 1px; background: #ffffff; }
  .drag-index__sheet {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px;
  }
  .drag-index__sheet button {
    position: relative; display: block; padding: 0; border: 0; background: none;
    aspect-ratio: 1/1; overflow: hidden; cursor: pointer;
  }
  .drag-index__sheet img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    filter: grayscale(1) contrast(1.05); opacity: 0.82;
    transition: filter .35s ease, opacity .35s ease, transform .55s cubic-bezier(.22,.61,.36,1);
  }
  .drag-index__sheet button:hover img { filter: none; opacity: 1; transform: scale(1.07); }
  .drag-index__caption {
    margin: 0; min-height: 2.6em;
    font-family: var(--drag-display); font-weight: 600;
    font-size: clamp(14px, 1.1vw, 17px); line-height: 1.3; color: #ffffff;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .drag-index__caption.is-idle { color: #ffffff; font-weight: 500; }

  /* ── MONO slide — one story a day runs black & white, washing back to
     colour on hover. A quiet, art-edition beat. ── */
  .drag-slide.is-mono .drag-frame img { filter: grayscale(1) contrast(1.06); }
  .drag-slide.is-mono:hover .drag-frame img { filter: none; }

  /* ── BREAK slide — once a day a headline refuses its column: display-voice
     type pulled up over the photo's bottom edge and out past its left rim,
     each line carried on a paper slab (box-decoration clone). ── */
  .drag-slide.is-break { z-index: 2; }
  .drag-slide.is-break .drag-frame { --fh: min(53vh, calc(100vh - 474px)); }
  .drag-slide.is-break .drag-cat::before { width: 34px; }
  .drag-slide.is-break .drag-title {
    margin-top: calc(-1 * clamp(34px, 3.4vw, 58px));
    margin-left: clamp(-44px, -2.6vw, -20px);
    /* width:0 keeps the headline out of the slide's intrinsic width (it would
       otherwise stretch the slide to the full unwrapped line); min-width then
       sets the real wrap measure: photo width + the left pull-out. */
    width: 0; min-width: calc(100% + clamp(20px, 2.6vw, 44px));
    position: relative; z-index: 3;
    font-family: var(--drag-display); font-weight: 800; text-transform: uppercase;
    font-size: var(--loud-size, clamp(29px, 2.7vw, 45px));
    line-height: 1.08; letter-spacing: -0.015em;
  }
  .drag-slide.is-break .brk-line {
    background: ${PAPER};
    box-decoration-break: clone; -webkit-box-decoration-break: clone;
    padding: 0.08em 0.3em 0.08em 0.12em;
  }

  /* ── PROGRESS — a whisper-thin hairline floating just above the footer.
     Absolutely positioned so it costs the rail zero height (it lives inside
     the rail's existing 40px bottom clearance and can never crowd a slide's
     social row). The blue fill tracks rail position; click to seek. ── */
  .drag-progress {
    position: absolute; z-index: 5;
    left: max(36px, 2.5vw); right: max(36px, 2.5vw);
    bottom: calc(var(--drag-foot-h) + 12px);
    height: 2px; background: rgba(10,10,10,0.08); cursor: pointer;
  }
  /* a taller invisible hit area so the 2px line is still easy to grab */
  .drag-progress::before { content: ""; position: absolute; left: 0; right: 0; top: -7px; bottom: -7px; }
  .drag-progress__bar {
    position: absolute; left: 0; top: 0; bottom: 0; width: 0%;
    background: ${BLUE}; opacity: 0.55; transition: opacity .25s ease;
  }
  .drag-progress:hover .drag-progress__bar { opacity: 1; }

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

  /* ── COVER slide — full POPCORN magazine cover for ONE hero music / film
     story. Portrait 3/4 frame with the masthead up top, a serif cover line at
     the foot, and the same duotone-twinkle / grain / vignette texture stack as
     the grid edition's comic tile so the brand treatment reads identically. ── */
  .drag-cover { position: relative; }
  .drag-cv {
    position: relative; display: block; cursor: pointer; text-decoration: none;
    height: min(58vh, calc(100vh - 360px)); aspect-ratio: 3 / 4;
    background: ${BLUE}; overflow: hidden; isolation: isolate;
    box-shadow: 0 22px 56px rgba(4,44,133,0.30);
  }
  .drag-cv__img {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
    z-index: 0; filter: contrast(1.08) saturate(0.92) brightness(0.95);
    animation: dcv-press 11s ease-in-out infinite; will-change: filter, transform;
  }
  @keyframes dcv-press {
    0%   { filter: contrast(1.06) saturate(0.95) brightness(0.97); transform: scale(1.02) translate(0, 0); }
    50%  { filter: contrast(1.10) saturate(0.92) brightness(0.95); transform: scale(1.025) translate(-0.4%, 0.3%); }
    100% { filter: contrast(1.06) saturate(0.95) brightness(0.97); transform: scale(1.02) translate(0, 0); }
  }
  .drag-cv__duotone {
    position: absolute; inset: 0; z-index: 1; pointer-events: none; mix-blend-mode: screen;
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
    animation: dcv-twinkle 3.6s ease-in-out infinite;
  }
  @keyframes dcv-twinkle {
    0%, 100% { opacity: 0.35; transform: scale(0.92); filter: blur(0.4px); }
    25%      { opacity: 1;    transform: scale(1.10); filter: blur(0px);   }
    50%      { opacity: 0.55; transform: scale(0.98); filter: blur(0.6px); }
    75%      { opacity: 0.95; transform: scale(1.06); filter: blur(0.2px); }
  }
  .drag-cv__grain {
    position: absolute; inset: -4%; z-index: 3; pointer-events: none;
    background-image: url("${PCC_NOISE}"); background-size: 240px 240px;
    opacity: 0.22; mix-blend-mode: overlay; animation: dcv-grain 0.16s steps(5) infinite;
  }
  @keyframes dcv-grain {
    0%   { background-position: 0 0; }
    25%  { background-position: -40% 30%; }
    50%  { background-position: 30% -22%; }
    75%  { background-position: -18% -34%; }
    100% { background-position: 22% 26%; }
  }
  .drag-cv__shade {
    position: absolute; inset: 0; z-index: 4; pointer-events: none;
    background:
      linear-gradient(180deg, rgba(3,12,38,0.55) 0%, transparent 26%, transparent 52%, rgba(3,12,38,0.82) 100%),
      radial-gradient(ellipse at center, transparent 54%, rgba(3,12,38,0.5) 100%);
  }
  .drag-cv__mast {
    position: absolute; top: clamp(16px, 2vw, 26px); left: 0; right: 0; z-index: 6;
    display: flex; flex-direction: column; align-items: center; gap: 5px;
    color: #ffffff;
  }
  .drag-cv__mast b {
    font-family: "Macabro", "Bodoni Moda", serif; font-weight: 900;
    font-size: clamp(30px, 3vw, 46px); line-height: 0.82; letter-spacing: -0.014em;
    text-transform: uppercase; text-shadow: 0 4px 18px rgba(0,0,0,0.45);
  }
  .drag-cv__rule {
    display: flex; align-items: center; gap: 9px;
    font-family: var(--drag-sans); font-size: 8.5px; font-weight: 700;
    letter-spacing: 0.28em; text-transform: uppercase; color: rgba(255,241,205,0.92);
  }
  .drag-cv__rule::before, .drag-cv__rule::after {
    content: ""; width: 22px; height: 1px; background: rgba(255,241,205,0.55);
  }
  .drag-cv__foot {
    position: absolute; left: clamp(16px, 2vw, 26px); right: clamp(16px, 2vw, 26px);
    bottom: clamp(16px, 1.8vw, 24px); z-index: 6; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 9px;
  }
  .drag-cv__cat {
    font-family: var(--drag-sans); font-size: 9px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase; color: #fff1cd;
    padding: 3px 11px; border: 1px solid rgba(255,241,205,0.5); border-radius: 999px;
  }
  .drag-cv__title {
    margin: 0; font-family: "Bodoni Moda", "Newsreader", serif; font-weight: 600;
    font-size: clamp(17px, 1.5vw, 24px); line-height: 1.2; letter-spacing: 0.06em;
    color: #ffffff; text-shadow: 0 2px 14px rgba(0,0,0,0.6); text-wrap: balance;
  }
  .drag-cv:hover .drag-cv__title {
    text-decoration: underline; text-decoration-thickness: 1px;
    text-underline-offset: 6px; text-decoration-color: rgba(255,255,255,0.55);
  }
  @media (prefers-reduced-motion: reduce) {
    .drag-cv__img, .drag-cv__duotone, .drag-cv__grain { animation: none !important; }
  }

  /* ── Kept panels: app ad + IG pill ── */
  /* App-download ad lives inside the category-filter bar (shares its divider
     line), centered in the bar. */
  .pcd-secnav-ad { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; }
  .pcd-secnav-ad .promo-top { position: relative; top: auto; grid-column: auto; height: 68px; width: 660px; max-width: 54vw; margin: 0; }
  .pcd-secnav-ad .promo-top__cta { gap: 20px; }
  .pcd-secnav-ad .promo-top__wordmark { font-size: clamp(15px, 1.3vw, 20px); white-space: nowrap; text-transform: none; letter-spacing: 0.01em; }
  .pcd-secnav-ad .promo-top__btn { padding: 8px 15px; font-size: 10px; }
  .drag-ig { flex: 0 0 auto; width: 248px; display: flex; flex-direction: column; justify-content: center; }
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

  /* ── EDGE CHEVRONS — side pagers ──
     The bottom progress shelf was hiding card headlines, so navigation moved to
     two frosted signature-blue discs pinned to the left/right edges of the
     stage, vertically centred. They float above the rail without covering any
     copy. ── */
  .drag-edge {
    position: absolute; top: 50%; transform: translateY(-50%); z-index: 30;
    width: 46px; height: 46px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(4,44,133,0.12);
    background: rgba(255,255,255,0.72);
    -webkit-backdrop-filter: blur(10px) saturate(130%);
    backdrop-filter: blur(10px) saturate(130%);
    color: ${BLUE}; cursor: pointer;
    box-shadow: 0 6px 20px rgba(4,44,133,0.14);
    transition: background .18s ease, box-shadow .18s ease, transform .18s ease;
  }
  .drag-edge:hover  { background: ${BLUE}; color: #fff1cd; box-shadow: 0 8px 26px rgba(4,44,133,0.28); }
  .drag-edge:active { transform: translateY(-50%) scale(0.94); }
  .drag-edge:focus-visible { outline: 2px solid rgba(4,44,133,0.5); outline-offset: 2px; }
  .drag-edge--prev { left: clamp(10px, 1.6vw, 22px); }
  .drag-edge--next { right: clamp(10px, 1.6vw, 22px); }

  /* ── Drag-edition footer — slim signature-blue strip with scalloped rim
     and the same minimal links as the app's profile section. ── */
  .drag-foot {
    position: relative; flex: 0 0 auto; height: var(--drag-foot-h);
    background: ${BLUE}; overflow: hidden; isolation: isolate;
    display: flex; align-items: center; justify-content: center;
  }
  /* soft top highlight — matches the grid footer's radial sheen so the texture
     reads as a lit, grainy field rather than flat blue */
  .drag-foot::after {
    content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background: radial-gradient(90% 130% at 50% 0%, rgba(255,255,255,0.07), transparent 70%);
  }
  .drag-foot__grain { position: absolute; inset: 0; opacity: 0.62; mix-blend-mode: overlay; pointer-events: none; z-index: 0; }
  .drag-foot__scallop { position: absolute; top: 0; left: 0; right: 0; z-index: 1; pointer-events: none; }
  /* three-column rail: nav links pinned left, copyright dead-centre, and the
     Instagram badge + contact link grouped on the right. A wider container
     with slimmer side padding pushes the flanking clusters toward the edges. */
  .drag-foot__inner {
    position: relative; z-index: 2; width: 100%; max-width: 1280px;
    margin: 0 auto; padding: 0 18px; box-sizing: border-box;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 18px;
  }
  .drag-foot__links {
    justify-self: start;
    display: flex; align-items: center; flex-wrap: wrap; gap: 6px 14px;
    font-family: "Macabro", "Anton", sans-serif;
    font-size: 10px; letter-spacing: 0.16em; line-height: 1;
    text-transform: uppercase;
  }
  .drag-foot__links a {
    color: #ffffff; text-decoration: none; padding-left: 0.16em;
    transition: color .18s ease, opacity .18s ease; opacity: 1;
  }
  .drag-foot__links a:hover { opacity: 0.82; }
  /* separators rendered as tiny centred dots rather than glyph middots, so the
     spacing reads even regardless of the display face's baseline */
  .drag-foot__links span {
    display: inline-block; width: 3px; height: 3px; border-radius: 50%;
    flex: 0 0 auto; background: rgba(255,255,255,0.4); font-size: 0;
  }
  /* right cluster: Instagram badge · Contact link */
  .drag-foot__right { justify-self: end; display: flex; align-items: center; gap: 16px; }
  .drag-foot__contact {
    font-family: "Macabro", "Anton", sans-serif;
    font-size: 10px; letter-spacing: 0.16em; line-height: 1;
    text-transform: uppercase; text-decoration: none;
    color: #ffffff; opacity: 1; white-space: nowrap;
    transition: opacity .18s ease;
  }
  .drag-foot__contact:hover { opacity: 0.82; }
  .drag-foot__copy {
    justify-self: center; white-space: nowrap;
    font-family: "Macabro", "Anton", sans-serif;
    font-size: 10px; letter-spacing: 0.16em; line-height: 1;
    text-transform: uppercase; color: #ffffff;
  }
  /* Instagram badge — outlined circle that fills softly on hover */
  .drag-foot__ig {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 50%; color: #ffffff;
    border: 1px solid rgba(255,255,255,0.34); opacity: 0.85; cursor: pointer;
    transition: opacity .18s ease, background-color .18s ease, border-color .18s ease;
  }
  .drag-foot__ig:hover { opacity: 1; background-color: rgba(255,255,255,0.13); border-color: rgba(255,255,255,0.6); }
  .drag-foot__ig svg { width: 16px; height: 16px; display: block; }

  @media (max-width: 760px) {
    .drag-foot__copy { display: none; }
    .drag-rail { padding: 0 32px 96px; gap: 24px; }
    .drag-intro { width: 78vw; }
    .drag-lead .drag-frame { aspect-ratio: 4/5; }
    .drag-edge { width: 40px; height: 40px; }
  }

  /* ── Legal / About modal — a compact centred card (NOT a full-screen
       takeover). Reuses the same brand content as the mobile LegalSheet,
       re-skinned as a desktop dialog: blue paper, grain, cream type. ── */
  .drag-legal-overlay {
    position: fixed; inset: 0; z-index: 240;
    display: flex; align-items: center; justify-content: center;
    padding: 32px;
    background: rgba(8,12,28,0.58);
    backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
    animation: drag-legal-fade .22s ease forwards;
  }
  @keyframes drag-legal-fade { from { opacity: 0; } to { opacity: 1; } }
  .drag-legal {
    position: relative; isolation: isolate; overflow: hidden;
    width: min(520px, 100%); max-height: min(680px, 84vh);
    display: flex; flex-direction: column;
    background: ${BLUE}; color: #fff1cd;
    border-radius: 18px;
    box-shadow: 0 30px 80px rgba(4,12,40,0.45), 0 2px 0 rgba(255,255,255,0.06) inset;
    animation: drag-legal-rise .34s cubic-bezier(.22,.61,.36,1) forwards;
  }
  @keyframes drag-legal-rise {
    from { opacity: 0; transform: translateY(16px) scale(0.985); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .drag-legal__grain { position: absolute; inset: 0; z-index: 0; pointer-events: none;
    opacity: 0.55; mix-blend-mode: overlay; }
  .drag-legal__close {
    position: absolute; top: 16px; right: 16px; z-index: 3;
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border: 0; border-radius: 50%; cursor: pointer;
    background: rgba(255,241,205,0.12); color: rgba(255,241,205,0.82);
    transition: background-color .18s ease, color .18s ease;
  }
  .drag-legal__close:hover { background: rgba(255,241,205,0.22); color: #fff1cd; }
  .drag-legal__head { position: relative; z-index: 2; flex: 0 0 auto; padding: 30px 34px 18px; }
  .drag-legal__eyebrow {
    margin: 0 0 12px; font-family: ${SANS}; font-weight: 700; font-size: 10px;
    letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,241,205,0.40);
  }
  .drag-legal__title {
    margin: 0; font-family: "Macabro", "Anton", sans-serif;
    font-size: clamp(16px, 1.9vw, 21px); line-height: 0.98; letter-spacing: 0.012em;
    text-transform: uppercase; color: #fff1cd; white-space: pre-line;
  }
  .drag-legal__updated {
    margin: 12px 0 0; font-family: ${SANS}; font-size: 11px;
    letter-spacing: 0.02em; color: rgba(255,241,205,0.46);
  }
  .drag-legal__rule { position: relative; z-index: 2; flex: 0 0 auto;
    margin: 0 34px; height: 1px; background: rgba(255,241,205,0.16); }
  .drag-legal__body {
    position: relative; z-index: 2; flex: 1 1 auto; min-height: 0;
    overflow-y: auto; overscroll-behavior: contain;
    padding: 24px 34px 30px;
  }
  .drag-legal__body::-webkit-scrollbar { width: 8px; }
  .drag-legal__body::-webkit-scrollbar-thumb { background: rgba(255,241,205,0.18); border-radius: 8px; }
  .drag-legal__intro {
    margin: 0 0 26px; padding-left: 14px; border-left: 2px solid rgba(255,241,205,0.24);
    font-family: "Lora", Georgia, serif; font-style: italic; font-size: 13.5px;
    line-height: 1.7; color: rgba(255,241,205,0.80);
  }
  .drag-legal__sec { margin: 0 0 24px; }
  .drag-legal__h {
    display: flex; align-items: baseline; gap: 11px; margin: 0 0 10px;
    font-family: "Macabro", "Anton", sans-serif; font-size: 12px;
    letter-spacing: 0.10em; text-transform: uppercase; color: #fff1cd;
  }
  .drag-legal__num {
    flex: 0 0 auto; width: 18px; font-family: ${SANS}; font-weight: 700;
    font-size: 9px; letter-spacing: 0.04em; color: rgba(255,241,205,0.40);
  }
  .drag-legal__p {
    margin: 0 0 12px 29px; font-family: "Lora", Georgia, serif;
    font-size: 13.5px; line-height: 1.75; color: rgba(255,241,205,0.80);
  }
  .drag-legal__p:last-child { margin-bottom: 0; }
  .drag-legal__foot {
    margin: 34px 0 0; padding-top: 20px; text-align: center;
    border-top: 1px solid rgba(255,241,205,0.12);
    font-family: ${SANS}; font-size: 11px; letter-spacing: 0.03em;
    line-height: 1.6; color: rgba(255,241,205,0.42);
  }
  .drag-legal__foot b { font-weight: 600; color: #fff1cd; }
  @media (prefers-reduced-motion: reduce) {
    .drag-legal-overlay, .drag-legal { animation: none; }
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
  framed,
}: {
  article: NewsArticle;
  onOpen: () => void;
  span: "sp-3" | "sp-4" | "sp-6";
  ratio: "ar-4-5" | "ar-1-1" | "ar-3-2" | "ar-3-4";
  anim?: "anim-pick" | "anim-screen" | "anim-signal" | "anim-sport";
  framed?: boolean;
}) {
  const src = article.imageUrl ? feedImageUrl(article.imageUrl) : null;
  // When framed, drop the motion effect — the frame *is* the treatment.
  const cls = ["card", span, ratio, framed ? "framed" : anim].filter(Boolean).join(" ");
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
        {!framed && anim === "anim-screen" && <>
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

/* ── Seeded per-day randomness ──────────────────────────────────────
   Photo treatments (tilt / colour-block pop / loud display headline / mono /
   broken-frame) are dealt from a deterministic PRNG seeded by the day's
   article-id join (railKey). Same feed → same layout on every render and
   refresh; new feed day → a fresh, unpatterned deal. Constraints applied
   while dealing keep the rail readable (no adjacent pops, no adjacent loud
   slides, exactly one mono + one broken-frame per day). */
const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type SlideTreat = {
  rot: number;
  pop: "" | "pop" | "pop2" | "pop3";
  loud: boolean;
  mono: boolean;
  brk: boolean;
  off: number;
  ar: string;
};

/* Frame shape follows the REAL image ratio when dimensions are known, so a
   wide press shot gets a wide frame and a portrait gets a tall one — the
   photo fills its frame instead of being cropped to an arbitrary cycle.
   Unknown dimensions fall back to a seeded landscape coin-flip. */
const aspectClassFor = (a: NewsArticle, rnd: () => number): string => {
  const w = a.imageWidth ?? 0;
  const h = a.imageHeight ?? 0;
  if (w > 0 && h > 0) {
    const r = w / h;
    if (r >= 1.65) return "ar-xw";
    if (r >= 1.32) return "ar-w";
    if (r >= 1.08) return "ar-l";
    if (r >= 0.92) return "ar-sq";
    return "ar-t";
  }
  return rnd() < 0.5 ? "ar-w" : "ar-l";
};

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

/* Index interlude — a photographer's contact sheet of the day's edition.
   Small mono thumbnails of every imaged story on the signature-blue panel;
   hovering washes a frame back to colour and surfaces its headline in the
   caption line; clicking jumps straight into the story. */
function DragIndex({ articles, dateLabel, onOpen }: {
  articles: NewsArticle[];
  dateLabel: string;
  onOpen: (a: NewsArticle) => void;
}) {
  const [hovered, setHovered] = useState<NewsArticle | null>(null);
  const sheet = articles.filter((a) => a.imageUrl).slice(0, 12);
  if (!sheet.length) return null;
  return (
    <section className="drag-index">
      <div className="drag-index__grain" aria-hidden><GrainBackground variant="popcorn-blue" /></div>
      <span className="drag-index__kicker">Index · {dateLabel}</span>
      <div className="drag-index__sheet">
        {sheet.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-label={a.title}
            onClick={() => onOpen(a)}
            onMouseEnter={() => setHovered(a)}
            onMouseLeave={() => setHovered((h) => (h?.id === a.id ? null : h))}
          >
            <img src={feedImageUrl(a.imageUrl!)} alt="" loading="lazy" draggable={false} />
          </button>
        ))}
      </div>
      <p className={`drag-index__caption${hovered ? "" : " is-idle"}`}>
        {hovered ? hovered.title : "The day at a glance — tap a frame to jump in."}
      </p>
    </section>
  );
}

/* Slim signature-blue footer for the Drag edition — scalloped rim on top,
   minimal links only (mirrors the app's profile section). Sits flush at the
   bottom of the shell at a fixed short height so it never pushes the rail or
   hides slide text. */
function DragFooter({ onLegal }: { onLegal: (kind: LegalKind) => void }) {
  const open = (kind: LegalKind) => (e: ReactMouseEvent) => { e.preventDefault(); onLegal(kind); };
  return (
    <footer className="drag-foot" aria-label="Popcorn footer">
      <div className="drag-foot__grain" aria-hidden>
        <GrainBackground variant="popcorn-blue" />
      </div>
      <div className="drag-foot__inner">
        <nav className="drag-foot__links">
          <a href="#" onClick={open("about")}>About</a>
          <span aria-hidden>·</span>
          <a href="#" onClick={open("privacy")}>Privacy</a>
          <span aria-hidden>·</span>
          <a href="#" onClick={open("terms")}>Terms</a>
        </nav>
        <span className="drag-foot__copy">© Popcorn Media 2026</span>
        <div className="drag-foot__right">
          <a
            className="drag-foot__ig"
            href="https://instagram.com/news.popcorn"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Popcorn on Instagram"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
            </svg>
          </a>
          <a className="drag-foot__contact" href="mailto:hello@popcornmedia.org">Contact us</a>
        </div>
      </div>
    </footer>
  );
}

/* Compact centred Legal/About dialog for the drag edition. Reuses the same
   content as the mobile LegalSheet but renders as a small desktop modal that
   never covers the whole screen. Closes on backdrop click or Escape. */
function DragLegalModal({ kind, onClose }: { kind: LegalKind | null; onClose: () => void }) {
  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);

  if (!kind) return null;
  const doc: LegalDoc = kind === "terms" ? TERMS : kind === "privacy" ? PRIVACY : ABOUT;
  const eyebrow = kind === "about" ? "Popcorn · About" : "Popcorn · Legal";
  const heading = kind === "terms" ? "Terms" : kind === "privacy" ? "Privacy" : "About";

  return (
    <div className="drag-legal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={heading}>
      <div className="drag-legal" onClick={(e) => e.stopPropagation()}>
        <div className="drag-legal__grain" aria-hidden><GrainBackground variant="popcorn-blue" /></div>
        <button className="drag-legal__close" onClick={onClose} aria-label="Close">
          <X size={16} strokeWidth={2} />
        </button>
        <div className="drag-legal__head">
          <p className="drag-legal__eyebrow">{eyebrow}</p>
          <h2 className="drag-legal__title">{heading}</h2>
          <p className="drag-legal__updated">Last updated {doc.lastUpdated}</p>
        </div>
        <div className="drag-legal__rule" />
        <div className="drag-legal__body">
          {doc.intro && <p className="drag-legal__intro">{doc.intro}</p>}
          {doc.sections.map((s, i) => (
            <section className="drag-legal__sec" key={i}>
              <h3 className="drag-legal__h">
                <span className="drag-legal__num">{String(i + 1).padStart(2, "0")}</span>
                {s.heading}
              </h3>
              {s.paragraphs.map((p, j) => (
                <p className="drag-legal__p" key={j}>{p}</p>
              ))}
            </section>
          ))}
          <p className="drag-legal__foot">
            Questions? Write to us at <b>hello@popcornmedia.org</b>
          </p>
        </div>
      </div>
    </div>
  );
}

// Ink-on-paper social row for the drag rail — same like/comment/share/save
// actions as the mobile card (and the same hooks for real persistence), but
// recoloured for the light magazine rail. The bookmark anchors the far right.
function DragSocial({
  article,
  onComments,
  pos = "is-bottom",
}: {
  article: NewsArticle;
  onComments: (a: NewsArticle) => void;
  /** Matches the caption position so the row + rule travel with the headline. */
  pos?: "is-top" | "is-bottom";
}) {
  const { isLiked: isLikedFn, toggleLike, likeCountFor } = useLikedArticles();
  const { isSaved: isSavedFn, toggleSave } = useSavedArticles();
  const commentCount = useCommentCount(article.id);
  const liked = isLikedFn(article.id);
  const isSaved = isSavedFn(article.id);
  // Server count (seed + real likes from all users) plus the viewer's own
  // optimistic adjustment, so a tap moves the number instantly; reconciled on
  // the next feed fetch.
  const likeCount = likeCountFor(article);
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

  const stop = (e: ReactMouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  const onLike = (e: ReactMouseEvent) => {
    stop(e);
    void toggleLike(article.id, likeCount);
  };
  const onComment = (e: ReactMouseEvent) => { stop(e); onComments(article); };
  const onSave = (e: ReactMouseEvent) => { stop(e); void toggleSave(article.id); };
  const onShare = (e: ReactMouseEvent) => {
    stop(e);
    if (navigator.share) {
      navigator.share({ title: article.title, text: article.summary, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  };

  return (
    <div className={`drag-social ${pos}`}>
      <button className={`drag-social__btn${liked ? " is-liked" : ""}`} onClick={onLike} aria-label="Like">
        <Heart size={20} strokeWidth={1.8} fill={liked ? "currentColor" : "none"} />
        <span className="drag-social__count">{fmt(likeCount)}</span>
      </button>
      <button className="drag-social__btn" onClick={onComment} aria-label="Comments">
        <MessageCircle size={20} strokeWidth={1.8} />
        {commentCount != null && commentCount > 0 && (
          <span className="drag-social__count">{commentCount}</span>
        )}
      </button>
      <button className="drag-social__btn" onClick={onShare} aria-label="Share">
        <Send size={19} strokeWidth={1.8} />
      </button>
      <button className="drag-social__btn drag-social__save" onClick={onSave} aria-label="Save">
        <Bookmark size={20} strokeWidth={1.8} fill={isSaved ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

function DragFeed({
  articles,
  onOpen,
  group,
}: {
  articles: NewsArticle[];
  onOpen: (a: NewsArticle) => void;
  group?: DayGroup;
}) {
  const [commentArticle, setCommentArticle] = useState<NewsArticle | null>(null);
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const dateLabel = group ? format(group.date, "EEEE, MMMM d") : "Today";

  // Stable identity for the rail's contents — changes only when the actual
  // set/order of stories changes (day or category switch), NOT when an
  // optimistic update (like/bookmark) rebuilds the array with the same items.
  const railKey = useMemo(() => articles.map((a) => a.id).join(","), [articles]);

  // Full-bleed poster pick: the best-quality image in the middle band, so the
  // cinematic beat lands mid-ribbon rather than at the open.
  const midBand = articles.slice(5, 13).filter((a) => a.imageUrl);
  const posterId = midBand.length
    ? midBand.reduce((best, a) =>
        (a.imageWidth ?? 0) * (a.imageHeight ?? 0) > (best.imageWidth ?? 0) * (best.imageHeight ?? 0) ? a : best,
      ).id
    : null;

  // Deal the day's slide treatments from a PRNG seeded by the feed identity —
  // stable across re-renders and like/save updates, fresh each day. Dealing
  // constraints keep the rail readable: pops never sit adjacent, loud display
  // slides never sit adjacent, and exactly one mono (B&W) + one broken-frame
  // slide land per day (never on the poster).
  const deck = useMemo(() => {
    const rnd = mulberry32(hashStr(railKey));
    const map = new Map<number, SlideTreat>();

    const imaged = articles.filter((a) => a.imageUrl && a.id !== posterId);
    const monoId = imaged.length ? imaged[Math.floor(rnd() * imaged.length)].id : null;
    const brkPool = imaged.filter((a) => a.id !== monoId && a.title.length <= 72);
    const brkId = brkPool.length ? brkPool[Math.floor(rnd() * brkPool.length)].id : null;

    let prevPop = false;
    let prevLoud = false;
    articles.forEach((a) => {
      const ar = aspectClassFor(a, rnd);
      const mono = a.id === monoId;
      const brk = a.id === brkId;
      const loud = !brk && !prevLoud && a.imageUrl != null && rnd() < 0.34;
      const pop: SlideTreat["pop"] =
        !loud && !brk && !prevPop && rnd() < 0.32
          ? (["pop", "pop2", "pop3"] as const)[Math.floor(rnd() * 3)]
          : "";
      const rot = loud || brk || pop ? 0 : (rnd() < 0.5 ? -1 : 1) * (1.2 + rnd() * 1.3);
      const off = loud || brk ? 0 : Math.round((rnd() * 2 - 1) * 22);
      map.set(a.id, { rot, pop, loud, mono, brk, off, ar });
      prevPop = pop !== "";
      prevLoud = loud || brk;
    });
    return map;
  }, [articles, railKey, posterId]);

  // Reset to the start of the rail when the day / category changes.
  useEffect(() => {
    if (stageRef.current) stageRef.current.scrollLeft = 0;
  }, [railKey]);

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

    // ── Parallax: one rAF loop drives --par per slide so photos pan a touch
    // slower than their frames. Geometry is cached once (slide offsets are
    // static after layout) and styles are written only when a value moves a
    // quantised step — at rest the loop writes nothing at all.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let kinRaf = 0;
    if (!reduceMotion) {
      const slides = Array.from(stage.querySelectorAll<HTMLElement>(".drag-slide"));
      const centers = slides.map((s) => s.offsetLeft + s.offsetWidth / 2);
      const widths = slides.map((s) => s.offsetWidth);
      const parLast: number[] = new Array(slides.length).fill(NaN);
      const kinetics = () => {
        // pan each visible photo opposite its frame's travel, scaled to the
        // frame's own width so narrow frames never out-pan their bleed
        const half = stage.clientWidth / 2;
        const mid = stage.scrollLeft + half;
        for (let i = 0; i < slides.length; i++) {
          const rel = (centers[i] - mid) / half;
          if (rel > 1.5 || rel < -1.5) continue;
          const r = Math.max(-1.2, Math.min(1.2, rel));
          const par = Math.round(-r * widths[i] * 0.028 * 2) / 2; // 0.5px steps
          if (par !== parLast[i]) {
            parLast[i] = par;
            slides[i].style.setProperty("--par", `${par}px`);
          }
        }
        kinRaf = requestAnimationFrame(kinetics);
      };
      kinRaf = requestAnimationFrame(kinetics);
    }

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
      if (kinRaf) cancelAnimationFrame(kinRaf);
      stage.removeEventListener("scroll", onScroll);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", endDrag);
      stage.removeEventListener("pointercancel", endDrag);
      stage.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [railKey]);

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
  const regularSlide = (a: NewsArticle, keyPrefix: string, framed = false, blackFrame = false) => {
    seq += 1; const n = seq;
    const st = deck.get(a.id) ??
      { rot: -1.6, pop: "" as const, loud: false, mono: false, brk: false, off: 0, ar: "ar-w" };
    const src = a.imageUrl ? feedImageUrl(a.imageUrl) : null;
    const size = src ? qualityClass(a) : "d-mid";
    // LOUD: display-voice headline overlapping the photo's bottom edge.
    // BREAK: oversized headline that escapes the frame's left edge entirely.
    // Both come from the seeded deck; framed / blackframe slides stay quiet.
    const loud = !framed && !blackFrame && src != null && st.loud;
    const brk = !framed && !blackFrame && src != null && st.brk;
    const mono = src != null && st.mono;
    // category + headline sit together on the SAME side of the image, the pair
    // alternating side slide to slide. Loud/break slides always pin the cat on
    // top and the headline below the photo so the overlap reads as a paste-up.
    const pairTop = n % 2 === 0;
    const catPos = loud || brk ? "is-top" : pairTop ? "is-top" : "is-bottom";
    const titlePos = loud || brk ? "is-bottom" : catPos;
    // honour detected focal point so cropped frames keep the subject (face) in view
    const ox = a.imageFocalX != null ? `${Math.round(a.imageFocalX * 100)}%` : "50%";
    const oy = a.imageFocalY != null ? `${Math.round(a.imageFocalY * 100)}%` : "50%";
    // loud/break slides drop the image float so the overlap depth is predictable.
    // Otherwise the float must move the photo AWAY from its caption: when the
    // caption sits on top (is-top) the photo drifts DOWN, when it sits below the
    // photo drifts UP — so a negative float can never pull the image up over the
    // social row above it (the "social feed covered by image" bug).
    const off = loud || brk ? 0 : (catPos === "is-top" ? Math.abs(st.off) : -Math.abs(st.off));
    // Framed slides keep their resting tilt — the frame just adds an ink edge.
    // Loud/break slides sit flat and frameless: the typographic jump IS the
    // treatment. Pop slides sit flat so the hard offset block stays square.
    const popCls = framed || loud || brk ? "" : st.pop ? ` ${st.pop}` : "";
    const rot = loud || brk ? 0 : framed ? (st.rot || -1.8) : st.pop ? 0 : st.rot;
    // Display type steps down as the headline gets longer, so a five-line
    // title never pushes the social row under the footer.
    const tLen = a.title.length;
    const loudSize =
      tLen <= 45 ? "clamp(30px, 2.8vw, 46px)" :
      tLen <= 70 ? "clamp(25px, 2.3vw, 38px)" :
                   "clamp(21px, 1.9vw, 31px)";
    return (
      <article
        key={`${keyPrefix}-${a.id}`}
        className={`drag-slide ${loud ? "d-mid ar-w" : `${size} ${st.ar}`}${popCls}${loud ? " is-loud" : ""}${mono ? " is-mono" : ""}${brk ? " is-break" : ""}`}
        data-num={num2(n)}
        style={{
          ["--drag-off" as string]: `${off}px`,
          ["--rot" as string]: `${rot.toFixed(2)}deg`,
          ...(loud || brk ? { ["--loud-size" as string]: loudSize } : {}),
        }}
      >
        <span className={`drag-cat ${catPos}`}>{a.category || "Today"}</span>
        <a className={`drag-frame${src ? "" : " is-feat"}${framed ? " is-framed" : ""}${blackFrame ? " is-blackframe" : ""}`} href="#" onClick={(e) => { e.preventDefault(); onOpen(a); }}>
          {src
            ? (
              <span className="drag-par">
                <span className="drag-par__in">
                  <img src={src} alt="" loading="lazy" draggable={false} style={{ objectPosition: `${ox} ${oy}` }} />
                </span>
              </span>
            )
            : <h3 className="drag-feat-title">{a.title}</h3>}
        </a>
        <h3 className={`drag-title ${titlePos}`}>
          {brk ? <span className="brk-line">{a.title}</span> : a.title}
        </h3>
        <DragSocial article={a} onComments={setCommentArticle} pos={titlePos} />
      </article>
    );
  };

  // ONE hero music / film story is promoted to a full POPCORN magazine cover —
  // masthead up top, serif cover line at the foot, brand texture over the photo.
  const coverSlide = (a: NewsArticle, keyPrefix: string) => {
    seq += 1; const n = seq;
    const src = a.imageUrl ? feedImageUrl(a.imageUrl) : null;
    const ox = a.imageFocalX != null ? `${Math.round(a.imageFocalX * 100)}%` : "50%";
    const oy = a.imageFocalY != null ? `${Math.round(a.imageFocalY * 100)}%` : "50%";
    return (
      <article key={`${keyPrefix}-${a.id}`} className="drag-slide d-tall drag-cover" data-num={num2(n)}>
        <a className="drag-cv" href="#" onClick={(e) => { e.preventDefault(); onOpen(a); }}>
          {src && (
            <img className="drag-cv__img" src={src} alt="" loading="lazy" draggable={false} style={{ objectPosition: `${ox} ${oy}` }} />
          )}
          <div className="drag-cv__duotone" aria-hidden />
          <div className="drag-cv__grain" aria-hidden />
          <div className="drag-cv__shade" aria-hidden />
          <div className="drag-cv__mast">
            <b>POPCORN</b>
          </div>
          <div className="drag-cv__foot">
            <h3 className="drag-cv__title">{a.title}</h3>
          </div>
        </a>
        <DragSocial article={a} onComments={setCommentArticle} />
      </article>
    );
  };

  // ONE mid-rail story goes full bleed — floor-to-ceiling photo, edge to edge,
  // headline supersized over the image. Picked as the best-quality image in
  // the middle band so the cinematic beat lands mid-ribbon, not at the open.
  const posterSlide = (a: NewsArticle, keyPrefix: string) => {
    seq += 1; const n = seq;
    const src = feedImageUrl(a.imageUrl!);
    const ox = a.imageFocalX != null ? `${Math.round(a.imageFocalX * 100)}%` : "50%";
    const oy = a.imageFocalY != null ? `${Math.round(a.imageFocalY * 100)}%` : "50%";
    return (
      <article key={`${keyPrefix}-${a.id}`} className="drag-slide drag-poster" data-num={num2(n)}>
        <a className="drag-poster__frame" href="#" onClick={(e) => { e.preventDefault(); onOpen(a); }}>
          <img src={src} alt="" loading="lazy" draggable={false} style={{ objectPosition: `${ox} ${oy}` }} />
          <div className="drag-poster__shade" aria-hidden />
          <div className="drag-poster__cap">
            <span className="tag">{a.category || "Today"}</span>
            <h3>{a.title}</h3>
          </div>
        </a>
      </article>
    );
  };

  // Magazine cover branding is shelved for now — every story renders as the
  // uniform regular slide. (coverSlide is kept above for easy re-enable.)
  const slide = (a: NewsArticle, keyPrefix: string) =>
    a.id === posterId ? posterSlide(a, keyPrefix) : regularSlide(a, keyPrefix);

  const rail: ReactNode[] = [];
  rail.push(
    <section key="intro" className="drag-intro">
      <div className="drag-intro__grain" aria-hidden><GrainBackground variant="popcorn-blue" /></div>
      <span className="drag-intro__big" aria-hidden>
        {group ? format(group.date, "MMM d") : "Today"}
      </span>
      <h2 className="drag-intro__mast" aria-label={`Popcorn — ${dateLabel}`}>
        {"POPCORN".split("").map((ch, i) => (
          <span key={i} style={{ ["--li" as string]: i }}>{ch}</span>
        ))}
      </h2>
      <p className="drag-intro__tag">Culture Curated Daily</p>
      <div className="drag-intro__hint"><span>Drag to explore</span><span className="track" /><span>→</span></div>
    </section>,
  );
  // All story slides in editorial order.
  const storySlides: ReactNode[] = [];
  if (lead.length) { storySlides.push(slide(lead[0], "d-lead")); }
  picks.forEach((a, i) => storySlides.push(regularSlide(a, "d-pick", i === 0, i === 2)));
  screen.forEach((a) => storySlides.push(slide(a, "d-scr")));
  signal.forEach((a) => storySlides.push(slide(a, "d-sig")));
  news.forEach((a) => storySlides.push(slide(a, "d-news")));
  sport.forEach((a) => storySlides.push(slide(a, "d-spt")));
  also.forEach((a) => storySlides.push(slide(a, "d-also")));

  // Index interlude: a drenched-blue contact sheet just past the rail's
  // midpoint. The brand colour punctuates the ribbon (the old pull-quote's
  // job) but earns its slot — a jump-anywhere visual map of the edition
  // instead of a duplicate of one story.
  if (storySlides.length >= 4) {
    const iIdx = Math.min(Math.floor(storySlides.length * 0.62), storySlides.length);
    storySlides.splice(
      iIdx,
      0,
      <DragIndex key="index" articles={articles} dateLabel={dateLabel} onOpen={onOpen} />,
    );
  }

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
      <button className="drag-edge drag-edge--prev" aria-label="Previous story" onClick={() => page(-1)}>
        <ChevronLeft size={24} strokeWidth={1.75} />
      </button>
      <button className="drag-edge drag-edge--next" aria-label="Next story" onClick={() => page(1)}>
        <ChevronRight size={24} strokeWidth={1.75} />
      </button>
      <div className="drag-progress" ref={progressRef} onClick={seek} aria-hidden>
        <div className="drag-progress__bar" ref={barRef} />
      </div>
      <DragFooter onLegal={setLegalKind} />
      <CommentSheet
        isOpen={commentArticle != null}
        articleId={commentArticle?.id ?? 0}
        onClose={() => setCommentArticle(null)}
      />
      <DragLegalModal kind={legalKind} onClose={() => setLegalKind(null)} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ── Page ──────────────────────────────────────────────────────── */

export function DesktopHome() {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const saves = useSavesRoot(user);
  const likes = useLikesRoot(user);

  // Discreet sign-in / sign-out confirmation toast.
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const showToast = useCallback((msg: string) => setToast({ id: Date.now(), msg }), []);

  // Detect auth transitions (sign-in / sign-out) without firing on the
  // initial session restore. We wait for auth to settle once to establish a
  // baseline, then toast only on a genuine change.
  const authBaselineRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (authLoading) return;
    const curr = user?.id ?? null;
    if (authBaselineRef.current === undefined) {
      authBaselineRef.current = curr; // first settle — no toast
      return;
    }
    if (authBaselineRef.current !== curr) {
      if (curr) showToast("Signed in");
      else showToast("You've been signed out");
      authBaselineRef.current = curr;
    }
  }, [user, authLoading, showToast]);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteNewsFeed();

  // Signed-in identity — mirrors the app's profile derivation so the website
  // account surface shows the same name / @handle / avatar / topics.
  const userName =
    (user?.user_metadata?.full_name as string | undefined)
      ?? user?.email?.split("@")[0]
      ?? null;
  const userHandle = profile?.username ? `@${profile.username}` : null;
  const userAvatar = (user?.user_metadata?.avatar_url as string | undefined) ?? null;
  const userTopics: string[] = (user?.user_metadata?.topics as string[] | undefined) ?? [];

  // Library state — which tab the overlay opens to (null = closed) — and the
  // desktop legal modal, both surfaced from the profile dropdown.
  const [libraryTab, setLibraryTab] = useState<"likes" | "saved" | null>(null);
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // Membership gate (NYT-style): after a preview window, signed-out
  // visitors see an invitation to sign in. It's dismissible — once
  // dismissed, a persistent footer bar stays up and article bodies
  // remain blocked until they sign in.
  const [gateOpen, setGateOpen] = useState(false);
  const [gateDismissed, setGateDismissed] = useState(false);
  useEffect(() => {
    if (user) { setGateOpen(false); return; }
    // Once the gate has been shown in a prior visit, bring it straight back
    // on reload — don't make the reader sit through the preview window again.
    let alreadyShown = false;
    try { alreadyShown = localStorage.getItem("popcorn-web-gate-shown") === "1"; } catch { /* ignore */ }
    // Return visits / post-logout still ease the gate in after a short beat so
    // it doesn't slam up the instant the page paints. A brand-new first visit
    // still gets the long NYT-style preview window.
    const delay = alreadyShown ? 700 : 18000;
    const t = setTimeout(() => {
      setGateOpen(true);
      try { localStorage.setItem("popcorn-web-gate-shown", "1"); } catch { /* ignore */ }
    }, delay);
    return () => clearTimeout(t);
  }, [user]);

  const [signUpOpen, setSignUpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  // The gate is actually on screen only when it hasn't been dismissed and
  // no auth sheet is layered above it.
  const gateVisible = gateOpen && !user && !gateDismissed && !signInOpen && !signUpOpen;

  // Lock page scroll while the gate modal is up so the blurred content
  // behind can't be scrolled around. The footer does NOT lock scroll.
  useEffect(() => {
    if (!gateVisible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [gateVisible]);

  // Close every auth surface the moment the user becomes authed. The
  // SignInSheet can't reliably await signIn() to call onClose itself —
  // supabase-js holds the GoTrue lock through signInWithPassword and fires
  // onAuthStateChange before that promise resolves, so the await can hang
  // (symptom: "SIGNING IN…" spins until you manually dismiss the popup, but
  // you're actually already signed in). Mirrors FeedPageHorizontal's effect.
  useEffect(() => {
    if (user) { setGateOpen(false); setSignUpOpen(false); setSignInOpen(false); }
  }, [user]);

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

  // Saved / liked lists for the Library overlay — same filter the app uses.
  const savedArticles = useMemo(
    () => allArticles.filter((a) => saves.savedIds.has(a.id)),
    [allArticles, saves.savedIds],
  );
  const likedArticles = useMemo(
    () => allArticles.filter((a) => likes.likedIds.has(a.id)),
    [allArticles, likes.likedIds],
  );

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

  return (
    <SavesContext.Provider value={saves}>
    <LikesContext.Provider value={likes}>
      <style>{PAGE_CSS + EDITORIAL_CSS + DRAG_CSS + PROFILE_CSS}</style>

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
            userName={userName}
            userHandle={userHandle}
            userAvatar={userAvatar}
            userTopics={userTopics}
            savedCount={savedArticles.length}
            likedCount={likedArticles.length}
            onOpenLibrary={setLibraryTab}
            onOpenLegal={setLegalKind}
            onOpenSettings={() => setSettingsOpen(true)}
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
          <GridFeed articles={articles} onOpen={openArticle} />
        )}

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
          locked={!user}
          onSignInWithEmail={() => setSignInOpen(true)}
          onCreateAccount={() => setSignUpOpen(true)}
        />
      )}

      {libraryTab && (
        <LibraryOverlay
          initialTab={libraryTab}
          savedArticles={savedArticles}
          likedArticles={likedArticles}
          onReadMore={setReadingArticle}
          onClose={() => setLibraryTab(null)}
        />
      )}

      <DragLegalModal kind={legalKind} onClose={() => setLegalKind(null)} />

      {settingsOpen && user && (
        <AccountSettingsModal onClose={() => setSettingsOpen(false)} currentUser={user} />
      )}

      {gateVisible && (
        <DesktopAuthGate
          onSignInWithEmail={() => setSignInOpen(true)}
          onCreateAccount={() => setSignUpOpen(true)}
          onDismiss={() => setGateDismissed(true)}
          onOpenLegal={setLegalKind}
        />
      )}

      {/* Persistent footer once the gate is dismissed — NYT-style standing
          reminder. Hidden while an auth sheet is open. */}
      {!user && gateDismissed && !signInOpen && !signUpOpen && (
        <DesktopAuthFooter
          onSignInWithEmail={() => setSignInOpen(true)}
          onCreateAccount={() => setSignUpOpen(true)}
          onOpenLegal={setLegalKind}
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

      {toast && (
        <AuthToast key={toast.id} message={toast.msg} onDone={() => setToast(null)} />
      )}

      {/* Ambient, always-reachable newsletter signup — a discreet blue tab on
          the right edge that opens into a join card. Distinct from the footer
          form; remembers dismissal / prior signup so it never nags. */}
      <NewsletterTab />
    </LikesContext.Provider>
    </SavesContext.Provider>
  );
}

/* ── Discreet auth confirmation toast ──────────────────────────────────── */
function AuthToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [shown, setShown] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const a = requestAnimationFrame(() => setShown(true));
    const t1 = setTimeout(() => setShown(false), 2400);
    const t2 = setTimeout(() => doneRef.current(), 2760);
    return () => {
      cancelAnimationFrame(a);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "34px",
        zIndex: 300,
        transform: `translateX(-50%) translateY(${shown ? "0" : "14px"})`,
        opacity: shown ? 1 : 0,
        transition:
          "opacity .32s ease, transform .42s cubic-bezier(0.22,1,0.36,1)",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "11px 18px",
        borderRadius: 999,
        background: "#042c85",
        color: "#fff1cd",
        border: "1px solid rgba(255,241,205,0.22)",
        boxShadow: "0 12px 40px rgba(4,12,40,0.45)",
        fontFamily: "'Manrope', sans-serif",
        fontWeight: 600,
        fontSize: "13.5px",
        letterSpacing: "0.01em",
        pointerEvents: "none",
      }}
    >
      <Check size={15} strokeWidth={2.5} style={{ color: "#fff1cd", flexShrink: 0 }} />
      {message}
    </div>
  );
}
