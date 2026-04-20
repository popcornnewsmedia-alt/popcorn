import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronUp, CheckCircle2 } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";
import { ActionButtons } from "./ActionButtons";
import { CommentSheet } from "./CommentSheet";
import { isStandalone } from "@/lib/utils";

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
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setImgReady(true);
      return;
    }
    const onLoad = () => setImgReady(true);
    img.addEventListener('load', onLoad);
    // Re-check after adding listener — handles the race where the image
    // finishes loading between the `complete` check above and the
    // addEventListener call (load event already fired, won't fire again).
    if (img.complete && img.naturalWidth > 0) {
      setImgReady(true);
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

  const containerW = window.innerWidth;
  const containerH = viewportHeight ?? window.innerHeight;

  // Chrome reserves in standalone/native. We deliberately bias faces toward
  // the BOTTOM half of the screen — subjects read better when they sit
  // between the TopBar chrome and the (less chrome-heavy) bottom nav area.
  // Using only a top reserve (and 0 bottom) pulls the focal target clearly
  // below true center by ~half the reserve. 160 ≈ TopBar (100) + a generous
  // buffer so hair/hats aren't clipped by the blur band.
  const topReserve    = isStandalone ? 160 : 0;
  const bottomReserve = 0;

  // When focal data exists, use the precise math. When it doesn't, use a
  // smart default that accounts for the web's landscape viewport: portrait
  // images (the majority of our feed) get heavily cropped top/bottom on wide
  // screens, cutting off faces. Biasing toward 25% vertical keeps heads in
  // frame. On mobile (portrait viewport) the image fills naturally so plain
  // 'center' is fine.
  let objectPosition: string;
  if (hasFocal) {
    objectPosition = focalToObjectPosition(
      article.imageFocalX as number,
      article.imageFocalY as number,
      article.imageWidth,
      article.imageHeight,
      containerW,
      containerH,
      topReserve,
      bottomReserve,
    );
  } else if (
    containerW > containerH &&
    article.imageWidth && article.imageHeight &&
    article.imageHeight > article.imageWidth
  ) {
    // Landscape viewport + portrait image → faces are usually in top third
    objectPosition = 'center 25%';
  } else {
    // In standalone, bias strongly toward the top of the image (low Y%).
    // object-position Y% < 50 shifts the image DOWN in the container, so
    // the subject's head drops below the TopBar blur instead of being
    // clipped by it. 15% is an aggressive push-down that works well for
    // the mostly-face editorial images in the feed.
    objectPosition = isStandalone ? 'center 15%' : 'center';
  }

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
          {/* SKELETON — only shown until the image is ready. When cached, we
              skip this entirely so there's zero perceptible lag on fast
              transitions. For uncached images we display a solid gradient
              (no fade animation — it's hidden the instant the img loads). */}
          {!imgReady && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                background: 'linear-gradient(135deg, #042f6a 0%, #053980 40%, #063d8f 60%, #042f6a 100%)',
              }}
            />
          )}

          {/* FOREGROUND — the ONLY decode of this image. No backdrop blur
              (it was invisible once the foreground loaded anyway and cost a
              full extra decode + GPU Gaussian blur per card). When `imgReady`
              is true we set opacity: 1 directly with no animation; when
              false we fall back to a short CSS fade. */}
          <img
            ref={imgRef}
            src={article.imageUrl}
            alt={article.title}
            loading="eager"
            decoding="async"
            fetchPriority={isActive ? 'high' : 'low'}
            style={{
              position: 'absolute',
              // In standalone/native, the container is the full-device
              // height but the image's composition centre almost always sits
              // in the top third of the source frame (editorial close-ups).
              // object-fit:cover + object-position-Y can only nudge the
              // crop by a few px when scaledH ≈ containerH, so a CSS-only
              // focal shift isn't enough on its own. We physically offset
              // the image down by ~44px so the subject drops below the
              // TopBar blur band; the image still extends from behind the
              // blur (the first 44px shows the card bg through the blur)
              // and its bottom simply clips past the container edge.
              top: isStandalone ? 44 : 0,
              left: 0,
              width: '100vw',
              height: '100%',
              objectFit: 'cover',
              objectPosition,
              zIndex: 5,
              opacity: imgReady ? 1 : 0,
              transition: imgReady ? 'none' : 'opacity 0.18s ease',
            }}
          />
          {/* Subtle dark tint — z-10. Kept intentionally light (0.10) so the
              image reads crisp and vibrant; the bottom gradient below handles
              text contrast on the metadata/headline overlay region. */}
          <div className="absolute inset-0 z-10" style={{ background: 'rgba(0,0,0,0.10)' }} />
          {/* Bottom gradient — z-10 */}
          <div
            className="absolute inset-0 z-10"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.78) 80%, rgba(0,0,0,0.92) 100%)' }}
          />
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

      {/* Vertical action buttons — right side */}
      <div className="absolute right-4 bottom-[110px] z-30" onClick={(e) => e.stopPropagation()}>
        <ActionButtons article={article} onOpenComments={() => setCommentsOpen(true)} />
      </div>

      {/* Portal to document.body so the fixed backdrop/sheet escapes the
          snap-scroll container's stacking context and properly overlays
          the BottomNav and all other fixed UI on iOS and desktop. */}
      {createPortal(
        <CommentSheet isOpen={commentsOpen} articleId={article.id} onClose={() => setCommentsOpen(false)} />,
        document.body,
      )}

      {/* Spacer */}
      <div className="flex-1 relative z-20" />

      {/* Bottom text content — left side, clear of the buttons */}
      <div className="relative z-20 px-5 pb-[90px] pr-24 sm:px-7 sm:pr-28">

        {/* Category pill + source pill */}
        <div className="flex items-center gap-2 mb-3">
          {/* Category pill with coloured dot */}
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

          {/* Source pill */}
          <span
            className="px-2.5 py-1 rounded-full tracking-wide"
            style={{
              fontSize: '10px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.65)',
              fontFamily: "'Macabro', 'Anton', sans-serif",
            }}
          >
            {article.source}
          </span>
        </div>

        {/* Headline */}
        <h2 className="text-[clamp(22px,6vw,38px)] font-['Manrope'] font-bold leading-[1.1] mb-3 tracking-tight text-white">
          {article.title}
        </h2>

        {/* Swipe hint */}
        <div
          className="flex items-center gap-1 text-xs font-medium font-['Inter']"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          <ChevronUp className="w-3 h-3" />
          Swipe
        </div>
      </div>
    </div>
  );
}
