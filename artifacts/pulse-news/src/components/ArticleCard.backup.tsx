import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronUp, CheckCircle2 } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";
import { ActionButtons } from "./ActionButtons";
import { CommentSheet } from "./CommentSheet";
import { isStandalone } from "@/lib/utils";

// Desktop threshold — at and above this viewport width, we swap the
// single-column mobile/iOS poster layout for an editorial side-by-side
// split: portrait poster plate on the left, typography column on the
// right. Below this, the existing mobile/iOS layout is preserved
// untouched.
const DESKTOP_BREAKPOINT = 1024;

const CATEGORY_COLORS: Record<string, string> = {
  'Music':        '#e879f9',  // fuchsia
  'Film & TV':    '#60a5fa',  // sky blue
  'Gaming':       '#a3e635',  // lime
  'Fashion':      '#f472b6',  // hot pink
  'Culture':      '#fb923c',  // orange
  'Sports':       '#34d399',  // emerald
  'Science':      '#22d3ee',  // cyan
  'AI':           '#818cf8',  // indigo
  'Social Media': '#fbbf24',  // amber
  'Technology':   '#2dd4bf',  // teal
  'Psychology':   '#c084fc',  // soft purple
  'Philosophy':   '#94a3b8',  // slate
  'Business':     '#f59e0b',  // gold
  'World':        '#6ee7b7',  // mint green
};

interface ArticleCardProps {
  article: NewsArticle;
  onReadMore: (article: NewsArticle) => void;
  isRead?: boolean;
  viewportHeight?: number;
  /** When false, renders a same-height empty snap shell — no images, no decode work */
  renderContent?: boolean;
  /** True only for the card at currentCardIndex — gets fetchpriority="high" */
  isActive?: boolean;
}

export function ArticleCard({
  article, onReadMore, isRead = false, viewportHeight,
  renderContent = true, isActive = false,
}: ArticleCardProps) {
  const hasImage = !!article.imageUrl;
  const [commentsOpen, setCommentsOpen] = useState(false);

  // Synchronous cache-hit detection: if the browser already has this image
  // decoded (from our <FeedPage> preloader or a prior render), skip the fade
  // animation entirely and paint it instantly. This is what makes fast
  // transitions feel native — no 300ms opacity fade for cached images.
  //
  // We start as `cached = null` (unknown) and let a layout-effect ref callback
  // synchronously check `img.complete && img.naturalWidth > 0` the instant
  // the <img> mounts. If true, we set the opacity to 1 with no animation.
  // If false, we fall back to the existing CSS fade-in.
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgReady, setImgReady] = useState(false);
  // Natural aspect ratio read directly from the loaded <img> — backend's
  // stored imageWidth/imageHeight can be wrong (e.g. 1080×? reported as
  // landscape when the file is actually 1080×1260 portrait), so we defer
  // to the actual decoded dimensions. `null` before load → we fall back
  // to the backend values so the plate still gets a sensible first paint.
  const [naturalAr, setNaturalAr] = useState<number | null>(null);
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const capture = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setNaturalAr(img.naturalWidth / img.naturalHeight);
      }
    };
    if (img.complete && img.naturalWidth > 0) {
      setImgReady(true);
      capture();
      return;
    }
    const onLoad = () => { setImgReady(true); capture(); };
    img.addEventListener('load', onLoad);
    // Re-check after adding listener — handles the race where the image
    // finishes loading between the `complete` check above and the
    // addEventListener call (load event already fired, won't fire again).
    if (img.complete && img.naturalWidth > 0) {
      setImgReady(true);
      capture();
    }
    return () => img.removeEventListener('load', onLoad);
    // `renderContent` is critical here: when the card first mounts outside the
    // ±3 render window, renderContent is false and no <img> exists (imgRef is
    // null). The effect runs on mount, finds null, and returns early. When the
    // user scrolls and the card enters the window, renderContent becomes true
    // and the <img> appears — but without renderContent in the deps the effect
    // won't re-run, leaving imgReady stuck at false (image invisible).
  }, [article.imageUrl, renderContent]);

  // Focal point support — when present, anchor the crop to the main subject.
  // This is the ONLY thing that affects how the image is positioned. Every
  // image renders full-bleed (object-fit: cover) — the earlier safe-box /
  // contain-fallback experiment was reverted because letterboxing on a
  // blurred backdrop looked worse than cover-cropping with a good focal
  // point, even for wide / multi-subject images.
  const hasFocal =
    typeof article.imageFocalX === 'number' &&
    typeof article.imageFocalY === 'number';

  // Convert a normalised focal point (0–1) into the correct CSS object-position
  // percentage for a cover-cropped image.
  //
  // WHY: `object-position: focalX% focalY%` is WRONG for images whose aspect
  // ratio differs significantly from the container. CSS `object-position: X%`
  // means "align the X%-point of the IMAGE with the X%-point of the BOX", not
  // "show the image centred on the focal point". The correct value is:
  //
  //   px = (containerW/2 − focalX × scaledW) / (containerW − scaledW) × 100
  //
  // …clamped to [0, 100]. This centres the focal point in the visible crop area
  // regardless of the image/container aspect ratio mismatch.
  //
  // Example — Bluesky article (5332×3000) on iPhone (393×844):
  //   naive:   object-position: 82% → shows 73.7% of image from left (447 px off)
  //   correct: object-position: 93.4% → correctly centres at 82%
  function focalToObjectPosition(
    fx: number, fy: number,
    iw: number | null | undefined,
    ih: number | null | undefined,
    cw: number, ch: number,
    topReserve = 0, bottomReserve = 0,
  ): string {
    if (!iw || !ih) {
      // No image dimensions stored — fall back to the naive approximation.
      return `${(fx * 100).toFixed(1)}% ${(fy * 100).toFixed(1)}%`;
    }
    const scale  = Math.max(cw / iw, ch / ih);
    const scaledW = iw * scale;
    const scaledH = ih * scale;

    let px = 50;
    if (scaledW > cw + 0.5) {
      px = ((cw / 2) - fx * scaledW) / (cw - scaledW) * 100;
      px = Math.max(0, Math.min(100, px));
    }

    // Vertical target: center of the VISIBLE area (between TopBar and
    // BottomNav). Using ch/2 would center the focal in the full container
    // — which for a standalone/native layout means the face hides partly
    // behind the TopBar. Shifting the target to the middle of the visible
    // band keeps faces in the unobstructed zone.
    const targetY = topReserve + (ch - topReserve - bottomReserve) / 2;
    let py = 50;
    if (scaledH > ch + 0.5) {
      py = (targetY - fy * scaledH) / (ch - scaledH) * 100;
      py = Math.max(0, Math.min(100, py));
    }

    return `${px.toFixed(1)}% ${py.toFixed(1)}%`;
  }

  // Track viewport width reactively so the desktop/mobile split flips
  // live on window resize — the existing viewportW read below was a
  // one-shot value that never updated. We keep the same variable name
  // so the rest of the geometry math is unchanged.
  const [vw, setVw] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 0,
  );
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const viewportW = vw || window.innerWidth;
  const viewportH = viewportHeight ?? window.innerHeight;
  const isDesktop = viewportW >= DESKTOP_BREAKPOINT;

  // ── Hero plate geometry ──
  // The plate fills the available area between the progress rule and the
  // action column / swipe hint. Width is viewport minus a thin side margin
  // so the blurred wash reads as a colored halo framing the image; height
  // extends down past the category pills so the plate visually "consumes"
  // the headline block. The feather mask dissolves the edges into the
  // atmosphere — no hard border.
  //
  // Portrait images (most of the feed) can show nearly full at this size;
  // landscape images use object-fit: cover with focal-point positioning so
  // the subject stays centred and the crop only trims neutral edges.
  const PLATE_SIDE_MARGIN = 0;                         // flush with viewport edge
  // Flush with the progress rule at the bottom of the TopBar.
  // Standalone (iOS PWA / Capacitor): safe-area ~47 + brand row ~41 + progress 3 ≈ 91.
  // Non-standalone (web): no safe-area padding inside the bar + brand row ~41 + progress 3 ≈ 47.
  const PLATE_TOP_OFFSET  = isStandalone ? 91 : 47;
  // Bottom of the plate — the image extends down until its bottom edge
  // lands JUST under the category/source pill row, so the pills read as
  // the first beat below the photo with no dead space between. The
  // headline then sits centered beneath the pills. Unified across iOS
  // and mobile-web. (Desktop uses its own plate geometry below and is
  // unaffected by this value.)
  const PLATE_BOTTOM_CAP  = 278;

  // ── Plate geometry ──
  // Mobile / iOS / mobile-web (< DESKTOP_BREAKPOINT): full-bleed portrait
  // plate, image spans the viewport width and fills the vertical band
  // between the TopBar progress rule and the category-pills block.
  //
  // Desktop (≥ DESKTOP_BREAKPOINT): editorial side-by-side split —
  // portrait poster on the LEFT (bounded height + 3:4 aspect), text
  // column on the RIGHT. The poster width is derived from the
  // available height so the hero never stretches past its natural
  // portrait shape; the text column gets the remaining viewport width
  // to breathe. Both columns sit inside a centered max-width content
  // row so the composition reads as an editorial spread rather than
  // hugging the viewport edges on ultra-wide screens.
  let plateW: number;
  let plateH: number;
  let plateLeft: number;
  let plateTop:  number;

  // Desktop content-row bookkeeping (only meaningful when isDesktop).
  // `rowLeft` is the left edge of the centered content row; `rowWidth`
  // is its total width. Both columns are laid out inside it.
  let rowLeft = 0;
  let rowWidth = viewportW;
  let textColLeft = 0;
  let textColWidth = viewportW;

  if (isDesktop) {
    // Vertical budget: top gutter of 56 px (clears the TopBar by a
    // generous margin so the plate reads as a centered composition,
    // not a tight-to-chrome hero) and a bottom gutter of 120 px to
    // keep clear of the BottomNav.
    const DT_TOP_GUTTER    = 56;
    const DT_BOTTOM_GUTTER = 120;
    const availableH = Math.max(1, viewportH - DT_TOP_GUTTER - DT_BOTTOM_GUTTER);

    // Centered content row — caps at ~1280 px so huge monitors don't
    // spread the composition into an awkward billboard. Horizontal
    // gutter scales gently with viewport width.
    const ROW_MAX_WIDTH = 1280;
    const H_GUTTER = Math.min(120, Math.max(48, viewportW * 0.06));
    rowWidth = Math.min(ROW_MAX_WIDTH, viewportW - H_GUTTER * 2);
    rowLeft  = Math.round((viewportW - rowWidth) / 2);

    // Poster aspect: 3:4 portrait — cinematic without being as tall as a
    // movie poster, matches the editorial tone and reads at mobile too.
    // Height is capped at the available vertical band; width is derived.
    const POSTER_ASPECT = 3 / 4; // w / h
    plateH = Math.min(availableH, 720); // never taller than 720 px
    plateW = Math.round(plateH * POSTER_ASPECT);

    // If the derived plate width would leave too little room for the
    // text column (< 360 px), shrink plate height until the split
    // balances. Text column gets at least 360 px; plate gets the rest.
    const COL_GAP = Math.min(88, Math.max(48, rowWidth * 0.05));
    const MIN_TEXT_COL = 360;
    const maxPlateW = rowWidth - COL_GAP - MIN_TEXT_COL;
    if (plateW > maxPlateW) {
      plateW = Math.max(280, maxPlateW);
      plateH = Math.round(plateW / POSTER_ASPECT);
    }

    // Vertically center the plate inside the available band.
    plateTop  = DT_TOP_GUTTER + Math.round((availableH - plateH) / 2);
    plateLeft = rowLeft;

    textColLeft  = plateLeft + plateW + COL_GAP;
    textColWidth = Math.max(MIN_TEXT_COL, rowLeft + rowWidth - textColLeft);
  } else {
    plateW    = Math.max(1, viewportW - PLATE_SIDE_MARGIN * 2);
    plateH    = Math.max(1, viewportH - PLATE_TOP_OFFSET - PLATE_BOTTOM_CAP);
    plateLeft = PLATE_SIDE_MARGIN;
    plateTop  = PLATE_TOP_OFFSET;
  }

  // The plate is portrait-leaning (narrower than tall), so almost every
  // source image will be wider than the plate's aspect — cover-crop is the
  // right default and keeps the image dominant. Focal-point positioning
  // keeps the subject centred so the crop trims neutral edges, not faces.
  const objectPosition = hasFocal
    ? focalToObjectPosition(
        article.imageFocalX as number,
        article.imageFocalY as number,
        article.imageWidth,
        article.imageHeight,
        plateW, plateH,
      )
    : 'center center';

  // Out-of-window: same-height snap placeholder, zero memory / decode pressure.
  if (!renderContent) {
    return (
      <div
        className="snap-start snap-always"
        style={{ height: viewportHeight, width: '100vw', position: 'relative', overflow: 'hidden', background: '#053980' }}
      />
    );
  }

  return (
    <div
      className="snap-start snap-always flex flex-col cursor-pointer"
      style={{
        height: viewportHeight,
        width: '100vw',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={() => onReadMore(article)}
    >
      {hasImage ? (
        <>
          {/* ── BLUR BLEED ──
              Second copy of the same URL at a heavy blur + mild saturation
              boost, scaled ~175% and centred so the Gaussian doesn't vignette
              at the edges. Acts as an atmospheric colour halo — the image's
              palette bleeds into every area the inset hero doesn't cover.
              Browsers cache the decode by URL so the bandwidth cost is one
              fetch per card; the GPU handles the blur compositing.            */}
          <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
            <img
              src={article.imageUrl}
              alt=""
              loading="eager"
              decoding="async"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '175%',
                height: '175%',
                transform: 'translate(-50%, -50%)',
                objectFit: 'cover',
                filter: 'blur(64px) saturate(1.35) brightness(0.92)',
                opacity: 0.92,
              }}
            />
            {/* Navy vignette — pulls bright corners (sky, stage lights) back
                toward the app palette so the TopBar chrome still reads. */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(ellipse at 50% 38%, rgba(5,57,128,0) 0%, rgba(5,57,128,0.18) 55%, rgba(5,57,128,0.52) 100%)',
              }}
            />
            {/* Reading gradient for the headline block at the bottom */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to bottom, rgba(0,0,0,0) 48%, rgba(0,0,0,0.42) 72%, rgba(0,0,0,0.78) 88%, rgba(0,0,0,0.90) 100%)',
              }}
            />
          </div>

          {/* ── HERO PLATE ──
              Mobile / iOS: full-bleed portrait, sharp side edges, vertical
              feather mask at the top (connects with the progress rule) and
              bottom (softens into the reading gradient).
              Desktop: centered portrait POSTER — framed with soft rounded
              corners, a sculpted drop-shadow, and a hairline inner ring so
              it reads as an editorial art object floating in the blurred
              atmosphere, not a cropped billboard. No feather mask — the
              posters should have crisp edges so the shape stays legible.  */}
          <div
            className="absolute z-10"
            style={{
              top: plateTop,
              left: plateLeft,
              width: plateW,
              height: plateH,
              ...(isDesktop
                ? {
                    borderRadius: 22,
                    overflow: 'hidden',
                    // Layered shadow: a soft wide halo + a crisper contact
                    // shadow pairs with an inset 1 px highlight so the
                    // poster feels physically lifted off the halo.
                    boxShadow:
                      '0 40px 80px -24px rgba(0,0,0,0.55), 0 14px 32px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
                  }
                : {
                    WebkitMaskImage:
                      'linear-gradient(to bottom, transparent 0, black 8px, black calc(100% - 12px), transparent 100%)',
                    maskImage:
                      'linear-gradient(to bottom, transparent 0, black 8px, black calc(100% - 12px), transparent 100%)',
                  }),
            }}
          >
            <img
              ref={imgRef}
              src={article.imageUrl}
              alt={article.title}
              loading="eager"
              decoding="async"
              fetchPriority={isActive ? 'high' : 'low'}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition,
                opacity: imgReady ? 1 : 0,
                transition: imgReady ? 'none' : 'opacity 0.18s ease',
              }}
            />
            {/* Desktop: soft inner vignette on the poster — pulls the eye
                toward the center of the composition and ties the hero
                back into the navy atmosphere. */}
            {isDesktop && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background:
                    'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.32) 100%)',
                }}
              />
            )}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 ink-diffusion-bg" />
      )}

      {/* Read indicator badge */}
      {isRead && (
        <div
          className="absolute left-4 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            top: `calc(env(safe-area-inset-top) + 60px)`,
            background: 'rgba(27,122,74,0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          <span className="font-['Inter'] font-semibold text-white" style={{ fontSize: '11px', letterSpacing: '0.02em' }}>Read</span>
        </div>
      )}

      {/* Vertical action buttons.
          Mobile / iOS: hug the right viewport edge near the bottom.
          Desktop: anchor to the right edge of the centered content row,
          vertically aligned with the bottom of the poster so they read
          as a column along the side of the editorial spread. */}
      <div
        className={isDesktop ? 'absolute z-30' : 'absolute right-4 bottom-[110px] z-30'}
        style={
          isDesktop
            ? {
                right: `${Math.max(24, viewportW - (rowLeft + rowWidth))}px`,
                top: `${plateTop + plateH - 180}px`,
              }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
      >
        <ActionButtons article={article} onOpenComments={() => setCommentsOpen(true)} />
      </div>

      {/* Portal to document.body so the fixed backdrop/sheet escapes the
          snap-scroll container's stacking context and properly overlays
          the BottomNav and all other fixed UI on iOS and desktop. */}
      {createPortal(
        <CommentSheet isOpen={commentsOpen} articleId={article.id} onClose={() => setCommentsOpen(false)} />,
        document.body,
      )}

      {/* Mobile / iOS: flex-spacer + bottom-anchored text block.
          See comments inside — unchanged from before. */}
      {!isDesktop && (
        <>
          {/* Spacer — flex-1 normally pushes the text block against the bottom
              (via pb-[72px]) so long headlines sit naturally flush with the
              image. BUT we cap its max-height at `plate-bottom + 12` so, when
              the headline is short and the block is small, the spacer stops
              growing there and the text lands right below the image instead
              of floating in the middle of the blurred wash. Long headlines
              never hit the cap — their block height alone eats the remaining
              space, so behaviour is unchanged. */}
          <div
            className="relative z-20"
            style={{ flex: '1 1 0%', maxHeight: `${PLATE_TOP_OFFSET + plateH + 12}px` }}
          />

          {/* Bottom text content — centered narrow column.
              Inner content is clamped to ~260px and centered via mx-auto
              so the centered pills + headline sit in the middle of the
              card without colliding with the absolute-positioned action
              column on the right edge. pb keeps the block clear of the
              BottomNav. */}
          <div
            className="relative z-20 px-5 sm:px-7 pr-24 sm:pr-28"
            style={{ paddingBottom: '72px' }}
          >
            {/* Category pill + source pill. `flex-wrap` lets the source pill drop
                to its own row when long source names can't fit alongside a wide
                category pill — without it, flex-shrink squeezes the source below
                its natural width, the text wraps internally, and the pill keeps
                the shrunk width leaving awkward empty space beside the shorter
                wrapped line. */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.22)',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: CATEGORY_COLORS[article.category] ?? 'rgba(255,255,255,0.5)',
                    boxShadow: `0 0 5px 1px ${CATEGORY_COLORS[article.category] ?? 'rgba(255,255,255,0.4)'}`,
                    flexShrink: 0,
                  }}
                />
                <span
                  className="uppercase tracking-widest"
                  style={{ fontSize: '10px', color: 'rgba(255,255,255,0.90)', fontFamily: "'Macabro', 'Anton', sans-serif" }}
                >
                  {article.category}
                </span>
              </span>

              <span
                className="px-2.5 py-1 rounded-full tracking-wide"
                style={{
                  fontSize: '10px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.65)',
                  fontFamily: "'Macabro', 'Anton', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                {article.source}
              </span>
            </div>

            <h2 className="text-[21.5px] font-['Manrope'] font-bold leading-[1.1] mb-3 tracking-tight text-white">
              {article.title}
            </h2>

            <div
              className="flex items-center gap-1 text-xs font-medium font-['Inter']"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              <ChevronUp className="w-3 h-3" />
              Swipe
            </div>
          </div>
        </>
      )}

      {/* ── DESKTOP TEXT COLUMN ──
          An editorial typography column sitting to the right of the
          poster, vertically centered against the plate. The eyebrow
          (category + source pills) introduces the headline; the
          headline is the star, set larger and tracked for the room;
          and a short meta line closes the column so the whole thing
          reads as a magazine spread, not a cropped mobile card. */}
      {isDesktop && (
        <div
          className="absolute z-20 flex flex-col justify-center"
          style={{
            top: plateTop,
            left: textColLeft,
            width: textColWidth,
            height: plateH,
          }}
        >
          {/* Eyebrow row — pills sit above the headline like a magazine
              section mark. Slightly tighter gap than the mobile pills
              because they have more horizontal room and read as one
              editorial line. */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.20)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: CATEGORY_COLORS[article.category] ?? 'rgba(255,255,255,0.5)',
                  boxShadow: `0 0 6px 1px ${CATEGORY_COLORS[article.category] ?? 'rgba(255,255,255,0.4)'}`,
                  flexShrink: 0,
                }}
              />
              <span
                className="uppercase tracking-[0.2em]"
                style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.95)',
                  fontFamily: "'Macabro', 'Anton', sans-serif",
                }}
              >
                {article.category}
              </span>
            </span>

            <span
              className="px-3 py-1.5 rounded-full tracking-[0.14em]"
              style={{
                fontSize: '11px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: 'rgba(255,255,255,0.70)',
                fontFamily: "'Macabro', 'Anton', sans-serif",
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              {article.source}
            </span>
          </div>

          {/* Hairline accent — a thin tinted rule in the category color
              gives the column its own editorial anchor before the
              headline lands. */}
          <div
            aria-hidden
            style={{
              width: 48,
              height: 2,
              marginBottom: 22,
              borderRadius: 2,
              background: CATEGORY_COLORS[article.category] ?? 'rgba(255,255,255,0.5)',
              boxShadow: `0 0 16px ${CATEGORY_COLORS[article.category] ?? 'rgba(255,255,255,0.4)'}`,
              opacity: 0.9,
            }}
          />

          {/* Headline — scaled for the wider column. Manrope at a heavier
              weight with tightened tracking keeps it editorial rather
              than webby. Leading-[1.05] compresses stacks so the title
              reads as a single block of type, not flowing prose. */}
          <h2
            className="font-['Manrope'] font-extrabold text-white"
            style={{
              fontSize: 'clamp(30px, 2.4vw, 44px)',
              lineHeight: 1.06,
              letterSpacing: '-0.02em',
              marginBottom: 24,
              // Subtle text shadow reads at low contrast spots on the
              // blurred halo without washing out.
              textShadow: '0 2px 16px rgba(0,0,0,0.35)',
            }}
          >
            {article.title}
          </h2>

          {/* Micro meta — summary first sentence if present, else a
              minimal "Open article" cue. Kept to one clamped line so
              the column geometry stays predictable. */}
          {article.summary ? (
            <p
              className="font-['Manrope'] text-white/70"
              style={{
                fontSize: 15,
                lineHeight: 1.5,
                maxWidth: '44ch',
                marginBottom: 20,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {article.summary}
            </p>
          ) : null}

          {/* CTA — replaces the mobile "Swipe" hint; reads as a button
              but preserves the whole-card click behaviour. */}
          <div
            className="inline-flex items-center gap-2 font-['Inter']"
            style={{
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.85)',
              padding: '10px 16px',
              borderRadius: 999,
              alignSelf: 'flex-start',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            Read
            <ChevronUp className="w-3.5 h-3.5 rotate-90" />
          </div>
        </div>
      )}
    </div>
  );
}
