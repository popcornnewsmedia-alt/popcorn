import type { ReactNode } from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Check, Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { format } from "date-fns";
import type { NewsArticle } from "@workspace/api-client-react";
import { useLikeArticle } from "@/hooks/use-news";
import { useSavedArticles } from "@/hooks/use-saves";
import { CommentSheet } from "@/components/CommentSheet";
import { useCommentCount } from "@/hooks/use-comment-count";
import { GrainBackground } from "@/components/GrainBackground";

// Converts a normalised focal point (0–1) to the correct CSS object-position
// percentage, taking the actual image and container dimensions into account.
// See ArticleCard.tsx for a full explanation of the maths.
function focalToObjectPosition(
  fx: number, fy: number,
  iw: number | null | undefined,
  ih: number | null | undefined,
  cw: number, ch: number,
): string {
  if (!iw || !ih) return `${(fx * 100).toFixed(1)}% ${(fy * 100).toFixed(1)}%`;
  const scale  = Math.max(cw / iw, ch / ih);
  const scaledW = iw * scale;
  const scaledH = ih * scale;
  let px = 50;
  if (scaledW > cw + 0.5) {
    px = ((cw / 2) - fx * scaledW) / (cw - scaledW) * 100;
    px = Math.max(0, Math.min(100, px));
  }
  let py = 50;
  if (scaledH > ch + 0.5) {
    py = ((ch / 2) - fy * scaledH) / (ch - scaledH) * 100;
    py = Math.max(0, Math.min(100, py));
  }
  return `${px.toFixed(1)}% ${py.toFixed(1)}%`;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Music':        '#e879f9',
  'Film & TV':    '#60a5fa',
  'Gaming':       '#a3e635',
  'Fashion':      '#f472b6',
  'Culture':      '#fb923c',
  'Sports':       '#34d399',
  'Science':      '#22d3ee',
  'AI':           '#818cf8',
  'Social Media': '#fbbf24',
  'Technology':   '#2dd4bf',
  'Psychology':   '#c084fc',
  'Philosophy':   '#94a3b8',
  'Business':     '#f59e0b',
  'World':        '#6ee7b7',
};

// Height of the hero image area (px). Content starts below this and scrolls
// up over the fixed image.
const HERO_HEIGHT = 340;

interface ArticleReaderProps {
  article: NewsArticle | null;
  onClose: () => void;
  isRead?: boolean;
  onMarkRead?: () => void;
  // When set on open, the comment sheet auto-opens (used for notification deep-links).
  initialCommentsOpen?: boolean;
  // Scroll-to + highlight a specific comment when the sheet opens.
  focusCommentId?: number | null;
  // Called when comments require a signed-in user (composer/vote taps while signed out).
  onRequireAuth?: () => void;
}

export function ArticleReader({ article, onClose, isRead = false, onMarkRead, initialCommentsOpen = false, focusCommentId = null, onRequireAuth }: ArticleReaderProps) {
  const { isSaved: isSavedFn, toggleSave } = useSavedArticles();
  const { mutate: likeMutation } = useLikeArticle();
  const [imgError, setImgError] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
  const commentCount = useCommentCount(article?.id ?? null);
  const [localLiked, setLocalLiked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  // ── Drag-to-close (CommentSheet-style) ────────────────────────────────────
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);

  // How far the content has been scrolled — drives parallax + status bar fade
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setImgError(false);
    setLocalLiked(false);
    setCommentsOpen(initialCommentsOpen);
    setScrollY(0);
    setDragOffset(0);
    if (fillRef.current) fillRef.current.style.transform = 'scaleX(0)';
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [article?.id, initialCommentsOpen]);

  // ── Scroll handler: progress bar + parallax scroll tracking ───────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    const fill = fillRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setScrollY(scrollTop);
    if (fill) {
      const max = scrollHeight - clientHeight;
      const pct = max > 0 ? scrollTop / max : 0;
      fill.style.transform = `scaleX(${pct})`;
    }
  }, []);

  // ── Drag-to-close touch handlers ──────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = scrollRef.current;
    if (el && el.scrollTop > 4) return;
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta <= 0) { setDragOffset(0); return; }
    // 10px hysteresis to distinguish drag from scroll
    if (!isDragging.current && delta < 10) return;
    isDragging.current = true;
    // Sqrt-based damping for natural resistance
    const dampened = Math.sqrt(delta) * Math.sqrt(delta < 80 ? delta : 80);
    setDragOffset(Math.min(delta, dampened + delta * 0.18));
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    if (dragOffset > 80) {
      setDragOffset(0);
      onClose();
    } else {
      setDragOffset(0);
    }
    isDragging.current = false;
  }, [dragOffset, onClose]);

  // Parallax: image moves at 40% of scroll speed
  const imageTranslateY = Math.min(scrollY * 0.4, HERO_HEIGHT * 0.5);
  // Status bar overlay fades in as content scrolls past the hero
  const statusBarOpacity = Math.min(1, Math.max(0, (scrollY - 40) / (HERO_HEIGHT * 0.5)));

  const hasImage = article?.imageUrl && !imgError;

  return (
    <>
      <AnimatePresence>
        {article && (
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden"
            style={{
              background: '#ffffff',
              transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
              transition: dragOffset > 0 ? 'none' : 'transform 0.34s cubic-bezier(0.32,0.72,0,1)',
            }}
          >
            {/* Grain sits behind everything — rendered first so hero paints over it */}
            <GrainBackground variant="white" />

            {/* ── Fixed hero image (behind scrollable content, above grain) ──── */}
            {hasImage && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: HERO_HEIGHT,
                  overflow: 'hidden',
                  zIndex: 2,
                  transform: `translateY(${-imageTranslateY}px)`,
                  willChange: 'transform',
                }}
              >
                <img
                  src={article.imageUrl!}
                  alt={article.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: typeof article.imageFocalX === 'number' && typeof article.imageFocalY === 'number'
                      ? focalToObjectPosition(article.imageFocalX, article.imageFocalY, article.imageWidth, article.imageHeight, window.innerWidth, HERO_HEIGHT)
                      : 'center 30%',
                  }}
                  onError={() => setImgError(true)}
                />
                {/* Bottom gradient fade to white — soft blend at the bottom edge */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 25%, rgba(255,255,255,0) 65%, rgba(255,255,255,0.85) 90%, rgba(255,255,255,1) 100%)',
                  }}
                />
                {/* Image credit — bottom-right of hero, sits over the image before fade-to-white */}
                {article.imageCredit && (
                  <div
                    className="font-['Inter']"
                    style={{
                      position: 'absolute',
                      right: '14px',
                      bottom: '120px',
                      fontSize: '9px',
                      lineHeight: 1,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontWeight: 500,
                      color: 'rgba(255,241,205,0.80)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.75)',
                      maxWidth: '60vw',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      pointerEvents: 'none',
                    }}
                  >
                    {article.imageCredit}
                  </div>
                )}
              </div>
            )}

            {/* ── Fallback: no-image bg ──────────────────────────────────────── */}
            {!hasImage && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HERO_HEIGHT, zIndex: 2 }}>
                <div style={{ position: 'absolute', inset: 0, background: '#ecf3ef' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,46,30,0.32)', mixBlendMode: 'multiply' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, #ffffff 100%)' }} />
              </div>
            )}

            {/* ── Status bar white transition — fades in as user scrolls past hero ── */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 'calc(env(safe-area-inset-top) + 2px)',
                zIndex: 30,
                pointerEvents: 'none',
                background: '#ffffff',
                opacity: statusBarOpacity,
                transition: 'opacity 0.08s linear',
              }}
            />

            {/* ── Drag handle ────────────────────────────────────────────────── */}
            <div
              className="absolute inset-x-0 z-40 flex justify-center pb-6"
              style={{ touchAction: 'none', top: 0, paddingTop: 'calc(8px + env(safe-area-inset-top))' }}
            >
              <div style={{
                width: 36,
                height: 4,
                borderRadius: 9999,
                background: statusBarOpacity > 0.5
                  ? 'rgba(5,57,128,0.22)'
                  : 'rgba(255,255,255,0.55)',
                transition: 'background 0.15s',
              }} />
            </div>

            {/* ── X button ───────────────────────────────────────────────────── */}
            <button
              onClick={onClose}
              className="absolute right-4 z-40 p-1.5 rounded-full transition-colors"
              style={{ background: '#000000', color: '#ffffff', border: '1px solid rgba(0,0,0,0.15)', top: 'calc(12px + env(safe-area-inset-top))' }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* ── Reading progress bar ────────────────────────────────────────── */}
            <div style={{ height: 2, width: '100%', position: 'relative', zIndex: 21, flexShrink: 0, background: 'transparent', marginTop: 'env(safe-area-inset-top)' }}>
              <div
                ref={fillRef}
                className="progress-fill-article"
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, background: '#053980', transform: 'scaleX(0)', transformOrigin: 'left center', willChange: 'transform' }}
              />
            </div>

            {/* ── Scrollable content (slides over the fixed hero) ─────────────── */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ position: 'relative', zIndex: 3, touchAction: 'pan-y' }}
            >
              {/* Transparent spacer — lets the fixed hero image show through */}
              <div style={{ height: hasImage ? HERO_HEIGHT - 40 : 0, pointerEvents: 'none' }} />

              {/* Article body — white background so it covers the image as it scrolls up */}
              <div style={{ background: '#ffffff', position: 'relative', minHeight: '100vh' }}>
                {/* Soft top edge to blend with hero gradient */}
                {hasImage && (
                  <div style={{
                    position: 'absolute',
                    top: -30,
                    left: 0,
                    right: 0,
                    height: 30,
                    background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)',
                    pointerEvents: 'none',
                  }} />
                )}

                <div className="max-w-2xl mx-auto px-5 pt-5 pb-28 sm:px-8">

                  {/* Image credit now rendered as a subtle overlay on the hero image itself */}

                  {/* Category + source pills + date */}
                  <div className="flex flex-wrap items-center gap-2 mb-5">
                    <span
                      className="flex items-center gap-1 px-2 py-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.09)' }}
                    >
                      <span style={{
                        display: 'inline-block', width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                        background: CATEGORY_COLORS[article.category] ?? 'rgba(0,0,0,0.3)',
                        boxShadow: `0 0 4px 1px ${CATEGORY_COLORS[article.category] ?? 'rgba(0,0,0,0.2)'}`,
                      }} />
                      <span style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '9px', color: 'rgba(0,0,0,0.65)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                        {article.category}
                      </span>
                    </span>
                    <span
                      className="px-2 py-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.09)', fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '9px', color: 'rgba(0,0,0,0.50)', letterSpacing: '0.08em' }}
                    >
                      {article.source}
                    </span>
                    <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'rgba(0,0,0,0.38)', fontFamily: "'Inter', sans-serif" }}>
                      <Calendar className="w-3 h-3" />
                      {format(new Date(article.publishedAt), 'MMM d, yyyy')}
                    </span>
                  </div>

                  {/* Headline */}
                  <h1
                    className="font-['Manrope']"
                    style={{ fontWeight: 800, fontSize: 'clamp(26px, 6vw, 38px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: '#1a1a1a', marginBottom: '20px' }}
                  >
                    {article.title}
                  </h1>

                  {/* Social actions */}
                  <div className="flex items-center gap-5 mb-8 pb-5" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <button
                      onClick={() => { const next = !localLiked; setLocalLiked(next); likeMutation({ id: article.id, liked: next }); }}
                      className="flex items-center gap-1.5 transition-all duration-200 active:scale-90"
                    >
                      <Heart style={{ width: 22, height: 22, color: localLiked ? '#e11d48' : '#111111', fill: localLiked ? '#e11d48' : 'none', strokeWidth: 1.6 }} />
                      <span className="font-['Inter'] font-semibold" style={{ fontSize: '13px', color: localLiked ? '#e11d48' : '#111111' }}>
                        {article.likes >= 1000 ? `${(article.likes / 1000).toFixed(1)}k` : article.likes}
                      </span>
                    </button>
                    <button
                      onClick={() => setCommentsOpen(true)}
                      className="flex items-center gap-1.5 transition-all duration-200 active:scale-90"
                    >
                      <MessageCircle style={{ width: 22, height: 22, color: '#111111', strokeWidth: 1.6 }} />
                      <span className="font-['Inter'] font-semibold" style={{ fontSize: '13px', color: '#111111' }}>
                        {commentCount ?? ""}
                      </span>
                    </button>
                    <button
                      onClick={() => void toggleSave(article.id)}
                      className="flex items-center gap-1.5 transition-all duration-200 active:scale-90"
                      style={{ marginLeft: 'auto' }}
                    >
                      <Bookmark style={{ width: 22, height: 22, color: '#111111', fill: isSavedFn(article.id) ? '#111111' : 'none', strokeWidth: 1.4 }} />
                    </button>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({ title: article.title, text: article.summary, url: window.location.href }).catch(() => {});
                        } else {
                          navigator.clipboard.writeText(window.location.href);
                        }
                      }}
                      className="flex items-center gap-1.5 transition-all duration-200 active:scale-90"
                    >
                      <Share2 style={{ width: 22, height: 22, color: '#111111', strokeWidth: 1.4 }} />
                    </button>
                  </div>

                  {/* TLDR */}
                  <div className="mb-8" style={{ borderLeft: '3px solid #053980', borderRadius: '0 10px 10px 0', padding: '16px 20px' }}>
                    <div style={{ fontSize: '12px', fontFamily: "'Macabro', 'Anton', sans-serif", letterSpacing: '0.14em', color: '#053980', textTransform: 'uppercase', marginBottom: '8px' }}>
                      TLDR
                    </div>
                    <p style={{ fontSize: '16px', color: '#111111', lineHeight: 1.75, fontFamily: "'Lora', Georgia, serif", margin: 0 }}>
                      {article.summary}
                    </p>
                  </div>

                  {/* Story */}
                  <div className="mb-8">
                    <SectionHeading>Story</SectionHeading>
                    <div className="space-y-5" style={{ fontSize: '17px', color: '#111111', lineHeight: 1.88, fontFamily: "'Lora', Georgia, serif" }}>
                      {article.content.split('\n\n').map((para: string, i: number) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </div>

                  {/* Footer CTA */}
                  <div className="mt-16 pt-8 flex items-center justify-center" style={{ borderTop: '1px solid rgba(5,57,128,0.12)' }}>
                    <button
                      onClick={() => { onMarkRead?.(); onClose(); }}
                      className="flex items-center gap-2 px-7 py-3 rounded-full transition-all active:scale-95"
                      style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '13px', letterSpacing: '0.06em', background: '#053980', color: '#fff1cd' }}
                    >
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                      {isRead ? 'Unmark as Read' : 'Mark as Read'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Comment sheet */}
            <CommentSheet
              isOpen={commentsOpen}
              articleId={article.id}
              onClose={() => setCommentsOpen(false)}
              focusCommentId={commentsOpen ? focusCommentId : null}
              onRequireAuth={onRequireAuth}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid rgba(5,57,128,0.15)' }}>
      <span style={{ display: 'inline-block', width: 3, height: 13, background: '#053980', borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontSize: '13px', color: '#053980', fontFamily: "'Macabro', 'Anton', sans-serif", letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {children}
      </span>
    </div>
  );
}
