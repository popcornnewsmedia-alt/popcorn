import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronUp, CheckCircle2 } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";
import { ActionButtons } from "./ActionButtons";
import { CommentSheet } from "./CommentSheet";
import { isStandalone } from "@/lib/utils";
import { feedImageUrl, probeImageUrl } from "@/lib/image-url";

// Module-level cache for the dominant-color probe result, keyed by the
// final probe URL. The probe involves a network fetch (64px variant) +
// canvas decode + 16×16 pixel sweep, all of which is wasted work the
// second time we mount the same card (e.g. re-entering the feed tab,
// scrolling a card back into the render window). Cache keys are URLs;
// values are pre-formatted "r,g,b" strings ready for setState.
const dominantColorCache = new Map<string, string>();

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
  // ── 13 canonical Popcorn categories ──────────────────────────────────────
  'Sports':       '#f43f5e',  // vivid rose-red     — competition
  'Culture':      '#fb923c',  // orange             — warmth, creativity
  'Fashion':      '#fbbf24',  // amber-gold         — luxury (distinct from Music)
  'Internet':     '#84cc16',  // lime               — viral, fresh energy
  'Gaming':       '#22c55e',  // bright green       — level up
  'World':        '#34d399',  // emerald            — global
  'Science':      '#14b8a6',  // teal               — discovery
  'Tech':         '#22d3ee',  // cyan               — digital circuits
  'Film & TV':    '#60a5fa',  // sky blue           — cinematic
  'AI':           '#818cf8',  // indigo             — neural, futuristic
  'Books':        '#c084fc',  // lavender           — imagination
  'Music':        '#e879f9',  // fuchsia            — sound, creativity
  'Industry':     '#94a3b8',  // slate              — business, neutral
  // ── Legacy / variant keys ─────────────────────────────────────────────
  'Technology':   '#22d3ee',
  'Social Media': '#84cc16',
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
  /** True for cards within ±1 of currentCardIndex — gates the blur-bleed layer
   *  so off-screen cards don't carry a second decoded copy of the hero image
   *  (halves peak decoded RAM on iOS WebView). */
  isNearActive?: boolean;
}

export function ArticleCard({
  article, onReadMore, isRead = false, viewportHeight,
  renderContent = true, isActive = false, isNearActive = true,
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

    // Use the 64px probe variant — we only sample a 16×16 grid anyway,
    // so downloading a 2400px master here is wasted bandwidth + decode.
    const probeUrl = probeImageUrl(article.imageUrl);

    // Cache hit: skip the network + decode + pixel sweep, hand the
    // pre-computed "r,g,b" string straight to state.
    const cached = dominantColorCache.get(probeUrl);
    if (cached) {
      setDominantColor(cached);
      return;
    }

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
          const rgb = `${avgR},${avgG},${avgB}`;
          dominantColorCache.set(probeUrl, rgb);
          setDominantColor(rgb);
        }
      } catch {
        // CORS-tainted canvas — silently fall back to cream veil.
      }
    };
    probe.src = probeUrl;
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
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onBreakpointChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setVw(e.matches ? DESKTOP_BREAKPOINT : window.innerWidth);
    };
    if (mql.addEventListener) {
      mql.addEventListener('change', onBreakpointChange);
      return () => mql.removeEventListener('change', onBreakpointChange);
    } else {
      // Fallback for older browsers
      mql.addListener(onBreakpointChange);
      return () => mql.removeListener(onBreakpointChange);
    }
  }, []);

  const viewportW = vw || window.innerWidth;
  const viewportH = viewportHeight ?? window.innerHeight;
  const isDesktop = viewportW >= DESKTOP_BREAKPOINT;
  // Web browser at tablet/desktop width — gets a compact horizontal bar
  // instead of the tall mobile panel. Safe to use backdrop-filter here
  // (Chrome/Firefox don't have the iOS WebKit stacking-context bug).
  const isWebDesktop = !isStandalone && viewportW >= 768;

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
  // iOS standalone: 278px (room for 4-line headline + safe area).
  // Web desktop (≥768px): 168px — compact cinematic ledger, image gets
  //   ~76% of the viewport. Headline clamped to 2 lines.
  // Mobile web (<768px): proportional 30% of viewport, min 220px.
  const PLATE_BOTTOM_CAP = isWebDesktop
    ? 168
    : isStandalone
      ? 278
      : Math.max(220, Math.round(viewportHeight * 0.30));

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
            {/* Blur layer is the second decoded copy of the hero image
                (different scale/filter, but a separate bitmap in RAM).
                On iOS WebView at 1290px wide this means ~5MB extra per
                card — gating it to active ± 1 cuts feed peak RAM in half
                without any visible change to the user (off-screen cards
                aren't seen). The dominantColor veil + readability shims
                still render so the in-view edge cards don't pop. */}
            {isNearActive && (
              <img
                src={feedImageUrl(article.imageUrl)}
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
            )}
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
                Kept subtle so the headline panel's backdrop-filter sees
                the image-tinted atmosphere (like the TopBar does at the
                top), not a dark wash. The headline panel adds its own
                soft darkening on top for text readability. */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.10) 80%, rgba(0,0,0,0.18) 100%)',
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
              src={feedImageUrl(article.imageUrl)}
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

      {/* Vertical action buttons — mobile/iOS only.
          Web desktop embeds horizontal actions inside the compact bar. */}
      {!isWebDesktop && (
        <div
          className="absolute right-4 z-30"
          style={{ top: `${plateTop + plateH + 8}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <ActionButtons article={article} onOpenComments={() => setCommentsOpen(true)} />
        </div>
      )}

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

          {/* ── Layer 1: frosted editorial plate ──
              Matches the TopBar aesthetic exactly: transparent background
              + backdropFilter blur(24px). Both the TopBar and this panel
              blur the same z-0 atmosphere layer, so they read as the same
              frosted glass color derived from the image. The darkening
              gradient below keeps the white headline legible. */}
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
            {/* Cream hairline at the top of the panel — web desktop only.
                On mobile the image's bottom edge serves as the divider. */}
            {isWebDesktop && (
              <div aria-hidden style={{
                position: 'absolute', top: 0, left: 16, right: 16, height: 1,
                background: 'linear-gradient(to right, rgba(255,241,205,0) 0%, rgba(255,241,205,0.35) 30%, rgba(255,241,205,0.35) 70%, rgba(255,241,205,0) 100%)',
                zIndex: 1,
              }} />
            )}
            {/* Replicate the z-0 atmosphere's TOP REGION inside the
                panel so the panel reads as the same frosted glass
                color as the TopBar. The TopBar backdrop-filters only
                a narrow strip (~21–27%) of z-0's top, so previously
                using backgroundSize: 'cover' here pulled in too much
                of the image (e.g. HoD dragon armor for the bottom of
                the card) and made the panel look mismatched.
                Instead: render the image as an actual <img> at 175%
                of the panel's WIDTH (matching z-0's 175% scaling) and
                NATURAL ASPECT, anchored to top:0. The panel's
                overflow:hidden then clips it to a narrow top strip —
                visually matching what the TopBar sees behind it. */}
            {article.imageUrl && (
              <img
                src={article.imageUrl}
                alt=""
                aria-hidden
                style={{
                  position: 'absolute',
                  // Match z-0's exact img placement so the panel renders
                  // the SAME image region the TopBar's backdrop-filter
                  // sees. z-0 uses width:175%/height:175% of CARD dims,
                  // centered with translate(-50%,-50%) → image-top in
                  // card-coords = -0.375 × cardH. We re-create that
                  // relative to the card here: img-top in panel coords
                  // = -0.375 × cardH, sized to 1.75 × cardH tall. Panel
                  // overflow:hidden clips it to the top 21–38% region
                  // — same warm/cool family the TopBar pulls.
                  top: -0.375 * viewportH,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 1.75 * viewportW,
                  height: 1.75 * viewportH,
                  maxWidth: 'none', // override global `img { max-width: 100% }`
                  objectFit: 'cover',
                  filter: 'blur(84px) saturate(1.15) brightness(0.94)',
                  opacity: 0.92,
                }}
              />
            )}
            <div
              className="absolute inset-0"
              style={{
                background: dominantColor
                  ? `rgba(${dominantColor},0.32)`
                  : 'rgba(255,241,205,0.16)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.10) 80%, rgba(0,0,0,0.18) 100%)',
              }}
            />
          </div>

          {/* ── Layer 2: type column ──
              Two layouts:
              - Web desktop (≥768px in browser): compact horizontal bar
                with pills + actions in one row, headline clamped to 2 lines.
              - Mobile / iOS: existing tall layout, 4-line headline. */}
          {isWebDesktop ? (
            /* Web desktop compact bar */
            <div
              className="relative z-20 px-6"
              style={{ paddingTop: '16px', paddingBottom: '60px' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top row: pills left · social actions right */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                  <span
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.22)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{
                      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                      background: CATEGORY_COLORS[article.category] ?? 'rgba(255,255,255,0.5)',
                      boxShadow: `0 0 5px 1px ${CATEGORY_COLORS[article.category] ?? 'rgba(255,255,255,0.4)'}`,
                      flexShrink: 0,
                    }} />
                    <span className="uppercase tracking-widest" style={{
                      fontSize: 10, color: 'rgba(255,255,255,0.90)',
                      fontFamily: "'Macabro', 'Anton', sans-serif",
                    }}>{article.category}</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full tracking-wide" style={{
                    fontSize: 10,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.65)',
                    fontFamily: "'Macabro', 'Anton', sans-serif",
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    minWidth: 0, flex: '0 1 auto',
                  }}>{article.source}</span>
                </div>
                <ActionButtons article={article} onOpenComments={() => setCommentsOpen(true)} horizontal />
              </div>

              {/* Headline — 2 lines max on web desktop */}
              <h2 className="text-white overflow-hidden mb-2" style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.2,
                fontSize: '24px',
                fontFamily: "'Suisse Int\\'l', 'Geist', 'Inter', system-ui, sans-serif",
                fontWeight: 600,
                letterSpacing: '-0.025em',
              }}>{article.title}</h2>

              <div className="flex items-center gap-1.5 mt-2" style={{ color: 'rgba(255,255,255,0.38)' }}>
                <span className="uppercase" style={{
                  fontFamily: "'Macabro', 'Anton', sans-serif",
                  fontSize: 8, letterSpacing: '0.22em', fontWeight: 400,
                }}>Read more</span>
                <ChevronUp className="w-2 h-2" strokeWidth={1.75} />
              </div>
            </div>
          ) : (
            /* Mobile / iOS: existing tall layout */
            <div
              className="relative z-20 px-5 sm:px-7 pr-24 sm:pr-28"
              style={{ paddingTop: '14px', paddingBottom: '84px', maxWidth: '760px' }}
            >
              {/* Category pill + source pill — locked to a SINGLE ROW */}
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

              <h2 className="mb-3 text-white" style={{
                fontSize: '21.5px',
                lineHeight: 1.2,
                fontFamily: "'Suisse Int\\'l', 'Geist', 'Inter', system-ui, sans-serif",
                fontWeight: 600,
                letterSpacing: '-0.025em',
              }}>
                {article.title}
              </h2>

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
          )}
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
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,241,205,0.22)',
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
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,241,205,0.14)',
                color: 'rgba(255,241,205,0.70)',
                fontFamily: "'Macabro', 'Anton', sans-serif",
                whiteSpace: 'nowrap',
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
