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
// Set artificially high — full-bleed mobile layout applies on all screen sizes.
// The desktop-specific centred-card branch is disabled; text gets a max-width
// constraint below for readability on wide viewports.
const DESKTOP_BREAKPOINT = 99999;

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

  // ── Dominant image color (shared TopBar + headline-panel tint) ──
  // Sampled once per image via a 16×16 canvas average. Used as a frosted
  // tint on BOTH the z-0 atmosphere (under the TopBar) and the noir
  // plate (under the headline) so the two regions read as the SAME
  // frosted-glass color regardless of where each layer physically samples
  // the photo. Without this, photos with very different top vs center
  // palettes (e.g. Ellen DeGeneres on a blue stage with warm skin tones,
  // Hulu yacht with sky over water) showed mismatched colors between
  // the two regions because the TopBar physically sits over the image's
  // top strip while the headline panel sits below center.
  //
  // Falls back gracefully to `null` on CORS failures (canvas tainted),
  // in which case both regions use a neutral cream veil — same as before
  // this effect existed.
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  useEffect(() => {
    if (!article.imageUrl || !renderContent) return;
    let cancelled = false;
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onload = () => {
      if (cancelled) return;
      try {
        const SIZE = 16;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        if (!ctx) return;
        ctx.drawImage(probe, 0, 0, SIZE, SIZE);
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          // Skip near-black and near-white pixels — these tend to be
          // letterbox bars / blown highlights / shadows that don't
          // represent the photo's true tonal palette. Without this
          // filter, photos shot against pure-white backgrounds (studio
          // press shots) would average toward grey instead of picking
          // up the subject's color.
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          if (max < 24 || min > 232) continue;
          r += pr; g += pg; b += pb; n++;
        }
        if (n > 0) {
          const avgR = Math.round(r / n);
          const avgG = Math.round(g / n);
          const avgB = Math.round(b / n);
          setDominantColor(`${avgR},${avgG},${avgB}`);
        }
      } catch {
        // CORS-tainted canvas — silently fall back to cream veil.
      }
    };
    probe.src = article.imageUrl;
    return () => { cancelled = true; };
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
    // Vertical budget: top gutter clears the TopBar; bottom gutter keeps
    // clear of the BottomNav with breathing room.
    const DT_TOP_GUTTER    = 56;
    const DT_BOTTOM_GUTTER = 96;
    const availableH = Math.max(1, viewportH - DT_TOP_GUTTER - DT_BOTTOM_GUTTER);

    // Centered editorial column — capped so the composition stays a
    // poised page-spread on ultra-wide monitors. Same column hosts BOTH
    // the hero image AND the text block stacked beneath it.
    const ROW_MAX_WIDTH = 760; // editorial single-column feel
    const H_GUTTER = Math.min(160, Math.max(48, viewportW * 0.08));
    rowWidth = Math.min(ROW_MAX_WIDTH, viewportW - H_GUTTER * 2);
    rowLeft  = Math.round((viewportW - rowWidth) / 2);

    // Resolve image aspect ratio. Prefer the live decoded value
    // (naturalAr); fall back to backend dimensions; final fallback is a
    // gentle landscape so first-paint geometry is close to most images.
    const ar =
      naturalAr ??
      (article.imageWidth && article.imageHeight
        ? article.imageWidth / article.imageHeight
        : 16 / 10);

    // Image gets vertical priority so portraits don't get squashed,
    // but is held back enough to leave room for the headline +
    // summary + CTA stack underneath. ~54% of the available band hits
    // a nice editorial balance: image dominant, text breathes.
    const STACK_GAP = 22;
    const targetImgH = Math.min(
      Math.max(300, Math.round(availableH * 0.54)),
      520,
    );

    // Fit the WHOLE image preserving its natural aspect ratio — no
    // cropping. Sized FIRST by target height (so portraits dominate),
    // then constrained to rowWidth if landscape pushes wider.
    let imgH = targetImgH;
    let imgW = imgH * ar;
    if (imgW > rowWidth) {
      imgW = rowWidth;
      imgH = imgW / ar;
    }

    plateW = Math.round(imgW);
    plateH = Math.round(imgH);
    plateLeft = Math.round((viewportW - plateW) / 2);

    // Reserved text-block height = whatever's left after image + gap.
    const TEXT_BLOCK_H = Math.max(220, availableH - plateH - STACK_GAP);

    // Vertically center the entire (image + gap + text) stack so the
    // composition feels balanced regardless of headline length.
    const stackH = plateH + STACK_GAP + TEXT_BLOCK_H;
    plateTop = DT_TOP_GUTTER + Math.max(0, Math.round((availableH - stackH) / 2));

    // Text column: stacked directly under the image, but spans the
    // FULL editorial row width (not just the plate width) so portrait
    // images don't strangle the headline column. Centered alignment
    // keeps the visual axis with the image.
    textColLeft  = rowLeft;
    textColWidth = rowWidth;
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
  // Desktop bypasses focal-point math because the plate is sized to the
  // image's natural AR, so the image fits without cropping.
  const objectPosition = isDesktop
    ? 'center center'
    : hasFocal
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
                // Aligned with the noir-plate treatment so the TopBar
                // (which backdrop-filters this layer) and the headline
                // panel show consistent, image-derived colors instead
                // of a forced navy wash. Saturation kept low (1.15) so
                // per-region differences (top of image vs center of
                // image) are muted — both regions read as "frosted
                // cream with hint of color" rather than vivid raw
                // image color.
                filter: 'blur(84px) saturate(1.15) brightness(0.94)',
                opacity: 0.92,
              }}
            />
            {/* Frosted shared-tint veil — uses the image's dominant
                color (sampled via canvas) so the TopBar zone reads
                as the SAME frosted glass color as the headline panel
                below. Falls back to cream when canvas is tainted by
                CORS — same behavior as before this tint existed. */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: dominantColor
                  ? `rgba(${dominantColor},0.32)`
                  : 'rgba(255,241,205,0.16)',
              }}
            />
            {/* Top-edge readability shim — a very subtle dark band only
                in the top ~12% so the cream POPCORN/date chrome keeps
                contrast against bright images (e.g. snow, white walls).
                Kept much softer than the old navy vignette so it does
                NOT recolor the image — it only deepens slightly. */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.06) 8%, rgba(0,0,0,0) 14%)',
              }}
            />
            {/* Reading gradient for the headline block at the bottom.
                Black-based so the blurred image-color halo behind it
                stays visible and tints the headline zone with the
                photo's palette — keeps the card feeling like one
                continuous atmosphere instead of "image plus a navy
                strip". */}
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
              bottom — image ends sharply at the cream hairline.
              Desktop: centered editorial hero — the plate is sized to the
              image's natural aspect ratio so the WHOLE image is visible
              (no crop). Soft rounded corners, layered drop-shadow, and a
              hairline inner ring frame it as an editorial art object
              floating in the blurred halo. */}
          <div
            className="absolute z-10"
            style={{
              top: plateTop,
              left: plateLeft,
              width: plateW,
              height: plateH,
              ...(isDesktop
                ? {
                    borderRadius: 18,
                    overflow: 'hidden',
                    // Layered elevation: wide soft halo + crisper contact
                    // shadow + 1px hairline ring so the hero reads as
                    // gently lifted off the navy atmosphere.
                    boxShadow:
                      '0 36px 72px -22px rgba(0,0,0,0.55), 0 12px 28px -10px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,241,205,0.08)',
                  }
                : {
                    // Top: keep a short 8px feather to soften the
                    // seam against the progress rule.
                    WebkitMaskImage:
                      'linear-gradient(to bottom, transparent 0, black 8px, black 100%)',
                    maskImage:
                      'linear-gradient(to bottom, transparent 0, black 8px, black 100%)',
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
                // Desktop: `contain` to guarantee the WHOLE image is
                // visible, even if the live decoded AR drifts from the
                // backend dimensions used to size the plate. Mobile
                // continues to use `cover` for full-bleed framing.
                objectFit: isDesktop ? 'contain' : 'cover',
                objectPosition,
                opacity: imgReady ? 1 : 0,
                transition: imgReady ? 'none' : 'opacity 0.18s ease',
              }}
            />
          </div>

          {/* Section divider — single tapered cream hairline at the
              top of the image plate. The bottom seam used to also
              wear a hairline, but with the headline panel now bleeding
              the image's own colours that hard line was fighting the
              soft mask-feather. Removed to let the dissolve breathe. */}
          {!isDesktop && (
            <div
              aria-hidden
              className="absolute z-20 pointer-events-none"
              style={{
                top: plateTop,
                left: 12,
                right: 12,
                height: 1,
                background:
                  'linear-gradient(to right, rgba(255,241,205,0) 0%, rgba(255,241,205,0.18) 18%, rgba(255,241,205,0.45) 50%, rgba(255,241,205,0.18) 82%, rgba(255,241,205,0) 100%)',
                opacity: 0.55,
              }}
            />
          )}
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
          Mobile / iOS: hug the right viewport edge under the hairline.
          Desktop: float as a side rail to the RIGHT of the hero image,
          vertically centered against the image so it reads as a
          companion column to the editorial composition. */}
      <div
        className={isDesktop ? 'absolute z-30' : 'absolute right-4 z-30'}
        style={
          isDesktop
            ? {
                // Sit in the gutter between the image's right edge and
                // the viewport edge. Anchored at a fixed offset from
                // the image so the rail tracks the composition on
                // window resize.
                left: `${Math.min(
                  viewportW - 80,
                  plateLeft + plateW + Math.max(28, (viewportW - (plateLeft + plateW)) / 2 - 32),
                )}px`,
                // Vertically center against the hero image. The
                // ActionButtons column is ~213px tall so we offset by
                // half its height to true-center it.
                top: `${plateTop + Math.round(plateH / 2) - 106}px`,
              }
            : { top: `${plateTop + plateH + 8}px` }
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
          ────────────────────────────────────────────────────────
          Editorial composition:
            • z-15 noir ink plate (charcoal #0a0a0a + procedural
              newsprint grain, feathered top edge dissolves UP into
              the photo bottom) — replaces the implicit dark wash.
            • z-20 type column — pills + headline UNCHANGED from
              the original, with a refined editorial floor lockup
              ("READ THE STORY" with a cream hairline) in place
              of the old "Swipe ↑" hint.
          No blue. Headline font/size/colour unchanged. */}
      {!isDesktop && (
        <>
          {/* Spacer — fixed height equal to the image's bottom edge.
              Type column starts EXACTLY at the image bottom (no
              overlap onto the image), so the image stays fully
              visible with a clean sharp bottom edge. */}
          <div
            className="relative z-20"
            style={{ flex: '0 0 auto', height: `${PLATE_TOP_OFFSET + plateH}px` }}
          />

          {/* ── Layer 1: photo-bled editorial plate ──
              The frame applies the top-edge feather mask + grain
              (.popcorn-noir-plate). Inside, two children: a heavily
              blurred + saturated copy of the article photo as the
              ground (so the WHOLE panel — even below the image —
              picks up THIS story's color), and a darkening gradient
              wash on top to keep the white headline legible. */}
          <div
            aria-hidden
            className="popcorn-noir-plate absolute left-0 right-0"
            style={{
              top: `${plateTop + plateH}px`,
              bottom: 0,
              zIndex: 15,
              pointerEvents: 'none',
              // Override the .popcorn-noir-plate top-edge fade — the
              // plate now sits cleanly BELOW the image with a hard
              // edge so the photo's bottom edge stays sharp.
              WebkitMaskImage: 'none',
              maskImage: 'none',
            }}
          >
            {hasImage && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${article.imageUrl})`,
                  backgroundSize: 'cover',
                  // Sample the IMAGE CENTER (not bottom-weighted) so
                  // the noir plate's color matches the z-0 atmosphere
                  // behind the TopBar, which centers its sampling too.
                  // Without this, photos with very different top vs
                  // bottom palettes (Ellen on a lit stage, Hulu yacht
                  // with sky over water) showed mismatched colors
                  // between TopBar and headline panel.
                  backgroundPosition: 'center center',
                  // Heavier blur (84) + low saturation (1.15) so the
                  // panel reads as frosted glass with a subtle hint
                  // of image color, harmonizing with the TopBar at
                  // the top of the same image.
                  filter: 'blur(84px) saturate(115%) brightness(0.94)',
                  transform: 'scale(1.5)',
                  transformOrigin: 'center center',
                }}
              />
            )}
            {/* Frosted shared-tint veil — same dominant-color tint as
                the z-0 atmosphere under the TopBar so both regions
                read as the same frosted glass. Falls back to cream
                on CORS-tainted canvas. backdrop-filter adds the
                "glass depth" haze that makes the frosting feel real
                rather than a flat color overlay. */}
            <div
              className="absolute inset-0"
              style={{
                background: dominantColor
                  ? `rgba(${dominantColor},0.26)`
                  : 'rgba(255,241,205,0.14)',
                // NOTE: backdrop-filter removed — on iOS WebKit it
                // samples the z-20 headline sibling and blurs it on top
                // of itself, hiding the headline behind the frosting.
                // The 84px image blur on the layer below already
                // provides the frosted-glass effect.
              }}
            />
            {/* Bottom-only darkening — keeps headline + READ MORE
                legible without dimming the top half where colors
                are most vibrant. Top 40% stays clean (full color
                burst), gentle ramp from 40% → 100%. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.18) 70%, rgba(0,0,0,0.42) 100%)',
              }}
            />
          </div>

          {/* ── Layer 2: type column (pills + headline UNCHANGED) ──
              paddingTop reduced from 32 → 14 because the spacer
              above no longer overlaps the image — pills sit
              immediately below the image with a small breathing
              gap. paddingBottom reduced from 92 → 84 to keep a
              4-line headline fitting in the 278px below-image
              budget while still clearing the bottom-nav. */}
          <div
            className="relative z-20 px-5 sm:px-7 pr-24 sm:pr-28"
            style={{ paddingTop: '14px', paddingBottom: '84px', maxWidth: '760px' }}
          >
            {/* Category pill + source pill — locked to a SINGLE ROW.
                We previously used `flex-wrap` which let long source names
                ("The Hollywood Reporter") drop to a second row, adding ~28px
                of pill height that pushed the headline down past the
                bottom-nav. Now: category pill keeps its natural width,
                source pill takes the remaining space and truncates with
                an ellipsis if the combined width exceeds the column. */}
            <div className="flex items-center gap-2 mb-4 min-w-0">
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
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
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  flex: '0 1 auto',
                }}
              >
                {article.source}
              </span>
            </div>

            {/* Clamped to 4 lines — the spacer above lifts the
                type column up by 52px from the image bottom, which
                gives just enough room for a full 4-line 22px
                headline above the 92px nav reserve. */}
            {/* Headline — Suisse Int'l (Swiss Typefaces, paid).
                Falls back to Geist (Vercel, free on Google Fonts)
                which shares the Swiss-modern grotesque DNA:
                neutral letterforms, clean terminals, no humanist
                quirks. To use the actual Suisse Int'l, drop the
                licensed woff2 files in /public/fonts/ and add a
                @font-face block in index.css — the cascade picks
                them up automatically. */}
            <h2 className="text-[22px] mb-3 text-white overflow-hidden" style={{
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.2,
              fontFamily: "'Suisse Int\\'l', 'Geist', 'Inter', system-ui, sans-serif",
              fontWeight: 600,
              letterSpacing: '-0.025em',
            }}>
              {article.title}
            </h2>

            {/* Floor lockup — discreet "read more" hint in muted
                grey. Sized to whisper, not announce. mt-3 (was mt-2)
                opens an extra 4px between headline descenders and
                the lockup so the two never feel cramped. */}
            <div
              className="flex items-center gap-1.5 mt-3"
              style={{ color: 'rgba(255,255,255,0.38)' }}
            >
              <span
                className="uppercase"
                style={{
                  fontFamily: "'Macabro', 'Anton', sans-serif",
                  fontSize: '8px',
                  letterSpacing: '0.22em',
                  fontWeight: 400,
                }}
              >
                Read more
              </span>
              <ChevronUp className="w-2 h-2" strokeWidth={1.75} />
            </div>
          </div>
        </>
      )}

      {/* ── DESKTOP TEXT BLOCK ──
          Stacked DIRECTLY UNDER the hero image, sharing the same width
          and horizontal alignment so the page reads as one centered
          editorial column. Order: pills → tinted hairline accent →
          headline → optional summary → CTA. The mobile/iOS layout is
          untouched — this block only renders on desktop. */}
      {isDesktop && (
        <div
          className="absolute z-20 flex flex-col items-center text-center"
          style={{
            top: plateTop + plateH + 24,
            left: textColLeft,
            width: textColWidth,
          }}
        >
          {/* Eyebrow row — category + source pills, centered above the
              headline like a magazine section mark. */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,241,205,0.22)',
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
                  color: 'rgba(255,241,205,0.95)',
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
                border: '1px solid rgba(255,241,205,0.14)',
                color: 'rgba(255,241,205,0.70)',
                fontFamily: "'Macabro', 'Anton', sans-serif",
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              {article.source}
            </span>
          </div>

          {/* Tapered cream hairline — mirrors the mobile divider so the
              two layouts share a visual signature. Sits between the
              pills and the headline as a tiny accent band. */}
          <div
            aria-hidden
            style={{
              width: 56,
              height: 1,
              marginBottom: 14,
              background:
                'linear-gradient(to right, rgba(255,241,205,0) 0%, rgba(255,241,205,0.85) 50%, rgba(255,241,205,0) 100%)',
              boxShadow: '0 0 10px rgba(255,241,205,0.28)',
              opacity: 0.9,
            }}
          />

          {/* Headline — editorial Manrope, tightened tracking, generous
              size that scales gently with viewport width but caps so it
              never blows past three lines. */}
          <h2
            className="font-['Manrope'] font-extrabold"
            style={{
              fontSize: 'clamp(24px, 1.85vw, 34px)',
              lineHeight: 1.1,
              letterSpacing: '-0.018em',
              marginBottom: 14,
              maxWidth: '32ch',
              color: '#fff1cd',
              textShadow: '0 2px 18px rgba(0,0,0,0.45)',
            }}
          >
            {article.title}
          </h2>

          {/* Optional summary — clamped to two lines, slightly tinted
              cream so it reads as supportive copy, not body text. */}
          {article.summary ? (
            <p
              className="font-['Manrope']"
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                maxWidth: '52ch',
                marginBottom: 18,
                color: 'rgba(255,241,205,0.72)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {article.summary}
            </p>
          ) : null}

          {/* CTA — cream pill with navy text, mirrors the brand CTA
              treatment used elsewhere in the app (inverted accent). */}
          <div
            className="inline-flex items-center gap-2 font-['Inter']"
            style={{
              fontSize: 12,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight: 600,
              color: '#053980',
              padding: '11px 20px',
              borderRadius: 999,
              background: '#fff1cd',
              boxShadow: '0 8px 22px -8px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,241,205,0.5)',
            }}
          >
            Read article
            <ChevronUp className="w-3.5 h-3.5 rotate-90" />
          </div>
        </div>
      )}
    </div>
  );
}
