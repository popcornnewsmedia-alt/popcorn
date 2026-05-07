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

// Module-level cache for the top-strip gradient — a horizontal CSS
// linear-gradient string sampled from the top ~25% of the image. Used
// by the TOP COLOUR BLEED div (behind the TopBar) so the nav bar picks
// up the image's colour mood WITHOUT replicating image shape and
// WITHOUT a CSS blur filter on every card.
const topStripGradientCache = new Map<string, string>();

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
  // Horizontal gradient sampled from the top ~25% of the image — drives
  // the TOP COLOUR BLEED strip behind the TopBar. Pure CSS gradient at
  // paint time (no image, no blur filter), so the strip costs nothing
  // per scroll frame.
  const [topStripGradient, setTopStripGradient] = useState<string | null>(null);

  // Category-derived fallback color used when the dominant-color probe fails
  // (e.g. CORS-restricted external CDNs like Dexerto that don't send
  // Access-Control-Allow-Origin). Gives each category a meaningful tint
  // instead of always falling back to the app's generic dark blue.
  const catHex = CATEGORY_COLORS[article.category] ?? '#053980';
  const catRgb = `${parseInt(catHex.slice(1,3),16)},${parseInt(catHex.slice(3,5),16)},${parseInt(catHex.slice(5,7),16)}`;
  useEffect(() => {
    if (!article.imageUrl || !renderContent) return;

    // Use the 64px probe variant — we only sample a 16×16 grid anyway,
    // so downloading a 2400px master here is wasted bandwidth + decode.
    const probeUrl = probeImageUrl(article.imageUrl);

    // Cache hit: skip the network + decode + pixel sweep, hand the
    // pre-computed "r,g,b" string straight to state.
    const cached = dominantColorCache.get(probeUrl);
    const cachedTopStrip = topStripGradientCache.get(probeUrl);
    if (cached) setDominantColor(cached);
    if (cachedTopStrip) setTopStripGradient(cachedTopStrip);
    if (cached && cachedTopStrip) return;

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
        // Saturation-weighted average: vivid/colourful pixels dominate;
        // neutral/grey pixels (skin against grey walls, shadows, etc.) are
        // de-weighted so they can't drag the result toward muddy olive/grey.
        // Fallback: if the image has no vivid pixels (e.g. true B&W photo),
        // drop back to the unweighted average so we still emit something.
        let r = 0, g = 0, b = 0, totalWeight = 0;
        let fr = 0, fg = 0, fb = 0, fn = 0;
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          if (max < 24 || min > 232) continue;
          fr += pr; fg += pg; fb += pb; fn++;
          // HSV saturation = chroma / max (0–1)
          const sat = max > 0 ? (max - min) / max : 0;
          // Skip nearly-grey pixels (sat < 12%) — they contribute mud
          if (sat < 0.12) continue;
          // Weight by sat² so the most vivid colour wins decisively
          const w = sat * sat;
          r += pr * w; g += pg * w; b += pb * w; totalWeight += w;
        }
        const useFallback = totalWeight < 0.5 && fn > 0;
        if (useFallback || totalWeight >= 0.5) {
          const outR = useFallback ? Math.round(fr / fn) : Math.round(r / totalWeight);
          const outG = useFallback ? Math.round(fg / fn) : Math.round(g / totalWeight);
          const outB = useFallback ? Math.round(fb / fn) : Math.round(b / totalWeight);
          const rgb = `${outR},${outG},${outB}`;
          dominantColorCache.set(probeUrl, rgb);
          setDominantColor(rgb);
        }

        // ── TOP-STRIP COLOUR PALETTE → ATMOSPHERIC GRADIENT ──
        // Sample 4 colours from the top ~25% of the probe image, then
        // compose them as overlapping radial gradients with scrambled
        // anchor positions. We use the image's TOP colour palette but
        // throw away its left-to-right ordering, so the strip never
        // reads as a stripe of the image — no centred subject showing
        // through, no horizontal subject-vs-background mapping.
        // Renders as pure CSS gradients (no blur filter, no image),
        // so cost per scroll frame stays zero.
        const COLS = 4;
        const stripCanvas = document.createElement('canvas');
        stripCanvas.width = COLS;
        stripCanvas.height = 1;
        const stripCtx = stripCanvas.getContext('2d', { willReadFrequently: false });
        if (stripCtx) {
          const sourceTopH = Math.max(1, Math.floor(probe.naturalHeight * 0.25));
          stripCtx.drawImage(
            probe,
            0, 0, probe.naturalWidth, sourceTopH,
            0, 0, COLS, 1,
          );
          const sd = stripCtx.getImageData(0, 0, COLS, 1).data;
          const palette: string[] = [];
          for (let i = 0; i < COLS; i++) {
            const o = i * 4;
            const sr = Math.round(sd[o] * 0.85);
            const sg = Math.round(sd[o + 1] * 0.85);
            const sb = Math.round(sd[o + 2] * 0.85);
            palette.push(`rgb(${sr},${sg},${sb})`);
          }
          // Scrambled anchors — palette colours are placed at points that
          // don't correspond to where they came from in the source image.
          const gradient = [
            `radial-gradient(ellipse 80% 220% at 22% 35%, ${palette[2]} 0%, transparent 65%)`,
            `radial-gradient(ellipse 80% 220% at 78% 65%, ${palette[0]} 0%, transparent 65%)`,
            `radial-gradient(ellipse 60% 180% at 52% 50%, ${palette[3]} 0%, transparent 55%)`,
            `linear-gradient(${palette[1]}, ${palette[1]})`,
          ].join(', ');
          topStripGradientCache.set(probeUrl, gradient);
          setTopStripGradient(gradient);
        }
      } catch {
        // CORS-tainted canvas — silently fall back to cream veil.
      }
    };
    // CORS-blocked CDN (e.g. Sky Sports, Getty mirrors) → image fetch with
    // crossOrigin='anonymous' fails entirely (onerror, not onload). Fall
    // back to a flat black strip so the TopBar stays consistent and there's
    // no abrupt switch to the article's underlying background.
    probe.onerror = () => {
      if (cancelled) return;
      const fallback = 'linear-gradient(rgb(0,0,0), rgb(0,0,0))';
      topStripGradientCache.set(probeUrl, fallback);
      setTopStripGradient(fallback);
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
  // TopBar bottom is always env(safe-area-inset-top) + 44px from the viewport top,
  // on both standalone (top:0 + paddingTop:safe-area) and non-standalone (top:safe-area).
  // brand row (py-3=12+12 + text 17px = 41px) + progress bar (3px) = 44px.
  // Keep a numeric estimate for JS calculations (plateH / focal point math).
  // Standalone (iOS PWA / Capacitor): safe-area ~47 + 44 ≈ 91.
  // Non-standalone (web): safe-area ~0 + 44 ≈ 44 (old value of 47 was slightly off).
  const PLATE_TOP_OFFSET  = isStandalone ? 91 : 44;
  // CSS value reads --pn-topbar-h set by TopBar's ResizeObserver, which
  // measures getBoundingClientRect().bottom — the true pixel distance from
  // viewport top to the bottom of the progress bar, on every device and
  // media-query state (desktop button vs mobile hint differ by ~8px).
  // Fallback 53px covers the desktop browser case if the var isn't set yet.
  const PLATE_TOP_CSS = 'var(--pn-topbar-h, 53px)';
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
  // Web desktop bar: 168px for the compact ledger layout.
  // Mobile/iOS: ~130px bottom cap — image ends before the content overlay
  // zone. The lost area is covered by a cinematic dark-fade vignette
  // inside the plate that dissolves the image into darkness.
  const PLATE_BOTTOM_CAP = isWebDesktop ? 168 : 238;

  // How far above the card's bottom edge the overlaid content should end.
  // Must clear the BottomNav pill + its outer padding + breathing room.
  //   Standalone iOS: pill ≈ 62px + env(safe-area-inset-bottom) (~34px on iPhone) + 12px gap
  //   Mobile web    : pill ≈ 54px + 12px gap = 66px
  const CONTENT_BOTTOM = isStandalone
    ? 'calc(env(safe-area-inset-bottom) + 94px)'
    : '86px';

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
  let plateTop:  number | string;

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
    plateW    = viewportW;
    plateH    = Math.max(1, viewportH - PLATE_TOP_OFFSET - PLATE_BOTTOM_CAP);
    plateLeft = 0;
    plateTop  = PLATE_TOP_CSS;
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
      {/* ── TOP COLOUR BLEED ── Fills y=0 → PLATE_TOP_CSS (the TopBar area)
          with a JS-extracted horizontal gradient sampled from the top
          ~25% of the hero image (see the canvas onload above). The
          gradient is a flat CSS `linear-gradient` — NO image background,
          NO `filter: blur()` — so the strip costs nothing per scroll
          frame and never replicates the image's shape/composition.
          The TopBar's own blur(24px) still samples these colours so the
          nav bar picks up the image's colour mood.
          z=8: behind the image plate (z-10) and behind the TopBar (z-40). */}
      {hasImage && !isDesktop && !isWebDesktop && isNearActive && topStripGradient && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: PLATE_TOP_CSS,
            background: topStripGradient,
            zIndex: 8,
          }}
        />
      )}

      {/* ── HERO PLATE ── Full-bleed portrait on mobile/iOS; editorial centered
          card on desktop. A cinematic scrim below provides text legibility. */}
      {hasImage ? (
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
                : isWebDesktop
                ? {
                    WebkitMaskImage:
                      'linear-gradient(to bottom, transparent 0, black 8px, black 100%)',
                    maskImage:
                      'linear-gradient(to bottom, transparent 0, black 8px, black 100%)',
                  }
                : {
                    // Mobile/iOS: subtle bottom feather so the image edge
                    // dissolves rather than hard-cuts into the dark panel.
                    WebkitMaskImage:
                      'linear-gradient(to bottom, black 0%, black 88%, transparent 100%)',
                    maskImage:
                      'linear-gradient(to bottom, black 0%, black 88%, transparent 100%)',
                  }),
            }}
          >
            <img
              ref={imgRef}
              src={feedImageUrl(article.imageUrl)}
              alt={article.title}
              loading="eager"
              decoding="async"
              fetchPriority={isActive ? 'high' : 'auto'}
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
            {/* ── Cinematic bottom-fade vignette (mobile/iOS only) ──
                The image dissolves into darkness over its bottom 40%, giving
                the impression the photo ends naturally rather than being
                hard-cropped. Three-stop gradient: the image is fully
                visible in the upper 60%, then a warm shadow midzone
                (optionally tinted with the dominant color) leads into
                near-opaque black at the bottom edge. No blur — purely
                opacity + darkness, like a film frame burning out. */}
            {!isDesktop && !isWebDesktop && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background: dominantColor
                    ? `linear-gradient(to bottom,
                        transparent 0%,
                        transparent 52%,
                        rgba(${dominantColor},0.12) 64%,
                        rgba(0,0,0,0.42) 76%,
                        rgba(0,0,0,0.78) 88%,
                        rgba(0,0,0,0.92) 100%
                      )`
                    : `linear-gradient(to bottom,
                        transparent 0%,
                        transparent 52%,
                        rgba(0,0,0,0.15) 64%,
                        rgba(0,0,0,0.46) 76%,
                        rgba(0,0,0,0.80) 88%,
                        rgba(0,0,0,0.94) 100%
                      )`,
                }}
              />
            )}
          </div>
      ) : (
        <div className="absolute inset-0 ink-diffusion-bg" />
      )}

      {/* Read indicator badge */}
      {isRead && (
        <div
          className="absolute left-4 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            top: `calc(env(safe-area-inset-top) + 60px)`,
            background: 'rgba(27,122,74,0.92)',
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          <span className="font-['Inter'] font-semibold text-white" style={{ fontSize: '11px', letterSpacing: '0.02em' }}>Read</span>
        </div>
      )}


      {/* Portal to document.body so the fixed backdrop/sheet escapes the
          snap-scroll container's stacking context and properly overlays
          the BottomNav and all other fixed UI on iOS and desktop. */}
      {createPortal(
        <CommentSheet isOpen={commentsOpen} articleId={article.id} onClose={() => setCommentsOpen(false)} />,
        document.body,
      )}

      {/* Mobile / iOS: full-bleed cinema — image fills entire card,
          text + actions overlay via a dark gradient scrim.
          Web desktop (≥768px browser): compact ledger bar preserved as-is. */}
      {!isDesktop && (
        <>
          {isWebDesktop ? (
            <>
              {/* ── Web desktop: spacer + editorial plate + compact bar (unchanged) ── */}
              <div
                className="relative z-20"
                style={{ flex: '0 0 auto', height: `${PLATE_TOP_OFFSET + plateH}px` }}
              />
              <div
                aria-hidden
                className="popcorn-noir-plate absolute left-0 right-0"
                style={{
                  top: `${plateTop + plateH}px`,
                  bottom: 0,
                  zIndex: 15,
                  pointerEvents: 'none',
                  WebkitMaskImage: 'none',
                  maskImage: 'none',
                }}
              >
                <div aria-hidden style={{
                  position: 'absolute', top: 0, left: 16, right: 16, height: 1,
                  background: 'linear-gradient(to right, rgba(255,241,205,0) 0%, rgba(255,241,205,0.35) 30%, rgba(255,241,205,0.35) 70%, rgba(255,241,205,0) 100%)',
                  zIndex: 1,
                }} />
                {article.imageUrl && (
                  <img
                    src={article.imageUrl}
                    alt=""
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: -0.375 * viewportH,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 1.75 * viewportW,
                      height: 1.75 * viewportH,
                      maxWidth: 'none',
                      objectFit: 'cover',
                      filter: 'blur(84px) saturate(1.15) brightness(0.94)',
                      opacity: 0.92,
                    }}
                  />
                )}
                <div className="absolute inset-0" style={{
                  background: dominantColor
                    ? [
                        'radial-gradient(ellipse 50% 38% at 14% -22%, rgba(255,241,205,0.06) 0%, rgba(255,241,205,0) 65%)',
                        `linear-gradient(to bottom, rgba(${dominantColor},0.24) 0%, rgba(${dominantColor},0.30) 45%, rgba(${dominantColor},0.38) 100%)`,
                      ].join(', ')
                    : 'linear-gradient(to bottom, rgba(255,241,205,0.18) 0%, rgba(255,241,205,0.10) 100%)',
                }} />
                <div className="absolute inset-0" style={{
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0) 65%, rgba(0,0,0,0.07) 82%, rgba(0,0,0,0.14) 100%)',
                }} />
              </div>
              <div
                className="relative z-20 px-6"
                style={{ paddingTop: '16px', paddingBottom: '60px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.22)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
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
                  </div>
                  <ActionButtons article={article} onOpenComments={() => setCommentsOpen(true)} horizontal />
                </div>
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
            </>
          ) : (
            <>
              {/* ── Mobile / iOS: cinematic full-bleed layout ── */}

              {/* Atmosphere strip removed — replaced by the TOP COLOUR BLEED div
                  above the hero plate, which samples the actual top of the image
                  (not the whole-image dominant colour average) so the TopBar
                  always reflects the true top-of-image colour mood. */}

              {/* Scrim — image-tinted dark veil over the image zone only. */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  zIndex: 15,
                  background: dominantColor
                    ? `linear-gradient(to bottom, transparent 0%, transparent 42%, rgba(${dominantColor},0.22) 56%, rgba(0,0,0,0.52) 74%, rgba(0,0,0,0.58) 100%)`
                    : `linear-gradient(to bottom, transparent 0%, transparent 60%, rgba(0,0,0,0.52) 78%, rgba(0,0,0,0.60) 100%)`,
                }}
              />

              {/* TikTok-style action column — right side, anchored above BottomNav */}
              <div
                className="absolute right-4 z-20"
                style={{ bottom: CONTENT_BOTTOM }}
                onClick={(e) => e.stopPropagation()}
              >
                <ActionButtons article={article} onOpenComments={() => setCommentsOpen(true)} />
              </div>

              {/* Bottom text overlay — left-anchored, right margin clears the action column */}
              <div
                className="absolute left-0 bottom-0 z-20"
                style={{
                  right: '72px',
                  paddingLeft: '20px',
                  paddingTop: '28px',
                  paddingBottom: isStandalone ? 'calc(env(safe-area-inset-bottom) + 86px)' : '86px',
                }}
              >
                {/* Pills row */}
                <div className="flex items-center gap-2 mb-2 min-w-0 overflow-hidden">
                  <span
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{
                      background: 'rgba(255,255,255,0.13)',
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

                </div>

                {/* Headline */}
                <h2
                  className="mb-3 text-white"
                  style={{
                    fontSize: '25px',
                    lineHeight: 1.2,
                    fontFamily: "'Suisse Int\\'l', 'Geist', 'Inter', system-ui, sans-serif",
                    fontWeight: 600,
                    letterSpacing: '-0.028em',
                    textShadow: '0 2px 16px rgba(0,0,0,0.55)',
                  }}
                >
                  {article.title}
                </h2>

                <div
                  className="flex items-center gap-1.5"
                  style={{ color: 'rgba(255,255,255,0.40)' }}
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
                background: 'rgba(255,255,255,0.18)',
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
