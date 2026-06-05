import type { ReactNode } from "react";
import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Check, Bookmark, Heart, MessageCircle, Share2, ArrowLeft, Instagram } from "lucide-react";
import { format } from "date-fns";
import type { NewsArticle } from "@workspace/api-client-react";
import { useLikeArticle } from "@/hooks/use-news";
import { useSavedArticles } from "@/hooks/use-saves";
import { CommentSheet } from "@/components/CommentSheet";
import { useCommentCount } from "@/hooks/use-comment-count";
import { GrainBackground } from "@/components/GrainBackground";
import { readerImageUrl } from "@/lib/image-url";

// Desktop editorial palette — mirrors DesktopHome.tsx so the article
// reader feels like a natural continuation of the home page.
const DESK_BLUE  = "#042c85";
const DESK_CREAM = "#FDF6E8";
const DESK_PAPER = "#FFFFFF";
const DESK_INK   = "#0F0F10";
const DESK_INK2  = "#2a2722";          // mockup --ink-2, slightly warmer body ink
const DESK_MUTE  = "#5F5F62";
const DESK_RULE  = "rgba(15,15,16,0.12)";

// Home-feed tokens — mirror DesktopHome.tsx so the article reader's top bar,
// headlines and category eyebrows match the home page exactly.
const HOME_BLUE     = "#042c85";                 // home masthead signature blue
const HOME_SANS     = '"Helvetica Neue", Helvetica, Arial, Inter, sans-serif';
const HEADLINE_FONT = '"Bricolage Grotesque", sans-serif'; // home-feed drag headline
const ARCHIVO       = '"Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif'; // mockup body sans

// Hook: track whether the viewport is desktop-sized (≥1024px). Used to
// switch between the mobile-first reader and the NYMag/Cut-style
// editorial desktop reader.
function useIsDesktop(breakpoint = 1024) {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(min-width: ${breakpoint}px)`).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isDesktop;
}

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
  'Sports':       '#f43f5e',
  'Culture':      '#fb923c',
  'Fashion':      '#fbbf24',
  'Internet':     '#84cc16',
  'Gaming':       '#22c55e',
  'World':        '#34d399',
  'Science':      '#14b8a6',
  'Tech':         '#22d3ee',
  'Film & TV':    '#60a5fa',
  'AI':           '#818cf8',
  'Books':        '#c084fc',
  'Music':        '#e879f9',
  'Industry':     '#94a3b8',
  'Technology':   '#22d3ee',
  'Social Media': '#84cc16',
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
  // Same-day articles surfaced in the "More to Read" footer block (desktop).
  relatedArticles?: NewsArticle[];
  // Called when the reader user clicks a related article tile — parent swaps in.
  onSelectArticle?: (a: NewsArticle) => void;
}

export function ArticleReader({ article, onClose, isRead = false, onMarkRead, initialCommentsOpen = false, focusCommentId = null, onRequireAuth, relatedArticles = [], onSelectArticle }: ArticleReaderProps) {
  const { isSaved: isSavedFn, toggleSave } = useSavedArticles();
  const { mutate: likeMutation } = useLikeArticle();
  const [imgError, setImgError] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
  const commentCount = useCommentCount(article?.id ?? null);
  const [localLiked, setLocalLiked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop(1024);

  // ESC key closes the reader (desktop convention). Active whenever an
  // article is open, regardless of viewport.
  useEffect(() => {
    if (!article) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !commentsOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [article, commentsOpen, onClose]);

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
        {article && isDesktop && (
          <DesktopArticleLayout
            article={article}
            onClose={onClose}
            isRead={isRead}
            onMarkRead={onMarkRead}
            commentsOpen={commentsOpen}
            setCommentsOpen={setCommentsOpen}
            commentCount={commentCount}
            localLiked={localLiked}
            setLocalLiked={setLocalLiked}
            likeMutation={likeMutation}
            isSavedFn={isSavedFn}
            toggleSave={toggleSave}
            scrollRef={scrollRef}
            fillRef={fillRef}
            handleScroll={handleScroll}
            imgError={imgError}
            setImgError={setImgError}
            focusCommentId={focusCommentId}
            onRequireAuth={onRequireAuth}
            relatedArticles={relatedArticles}
            onSelectArticle={onSelectArticle}
          />
        )}
        {article && !isDesktop && (
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
                  src={readerImageUrl(article.imageUrl!)}
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
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 25%, rgba(255,255,255,0) 78%, rgba(255,255,255,0.45) 92%, rgba(255,255,255,0.62) 100%)',
                  }}
                />
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
                  ? 'rgba(4,44,133,0.22)'
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
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, background: '#042c85', transform: 'scaleX(0)', transformOrigin: 'left center', willChange: 'transform' }}
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
                    <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'rgba(0,0,0,0.38)', fontFamily: "'Inter', sans-serif" }}>
                      <Calendar className="w-3 h-3" />
                      {format(new Date(article.publishedAt), 'MMM d, yyyy')}
                    </span>
                  </div>

                  {/* Headline */}
                  <h1
                    className="font-['Manrope']"
                    style={{ fontWeight: 800, fontSize: '20px', lineHeight: 1.06, letterSpacing: '-0.02em', color: '#1a1a1a', marginBottom: '20px' }}
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
                  <div className="mb-8" style={{ borderLeft: '3px solid #042c85', borderRadius: '0 10px 10px 0', padding: '16px 20px' }}>
                    <div style={{ fontSize: '12px', fontFamily: "'Macabro', 'Anton', sans-serif", letterSpacing: '0.14em', color: '#042c85', textTransform: 'uppercase', marginBottom: '8px' }}>
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

                  {/* Source footnote */}
                  <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.38)', fontFamily: "'Inter', sans-serif", marginTop: '32px', marginBottom: '0' }}>
                    via {article.source}
                  </p>

                  {/* Footer CTA */}
                  <div className="mt-16 pt-8 flex items-center justify-center" style={{ borderTop: '1px solid rgba(4,44,133,0.12)' }}>
                    <button
                      onClick={() => { onMarkRead?.(); onClose(); }}
                      className="flex items-center gap-2 px-7 py-3 rounded-full transition-all active:scale-95"
                      style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '13px', letterSpacing: '0.06em', background: '#042c85', color: '#fff1cd' }}
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid rgba(4,44,133,0.15)' }}>
      <span style={{ display: 'inline-block', width: 3, height: 13, background: '#042c85', borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontSize: '13px', color: '#042c85', fontFamily: "'Macabro', 'Anton', sans-serif", letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {children}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Desktop editorial article reader (≥1024px)
   Mirrors the home-page editorial register — Macabro tracked eyebrows,
   Newsreader serif headlines, generous 720-px reading column, blue
   utility strip on top with POPCORN wordmark + back-to-issue link.
   Nowness / NYMag / The Cut inspired. Keyboard ESC + top-left back +
   bottom CTA all close the reader.
   ────────────────────────────────────────────────────────────────────── */
function DesktopArticleLayout({
  article,
  onClose,
  isRead,
  onMarkRead,
  commentsOpen,
  setCommentsOpen,
  commentCount,
  localLiked,
  setLocalLiked,
  likeMutation,
  isSavedFn,
  toggleSave,
  scrollRef,
  fillRef,
  handleScroll,
  imgError,
  setImgError,
  focusCommentId,
  onRequireAuth,
  relatedArticles = [],
  onSelectArticle,
}: {
  article: NewsArticle;
  onClose: () => void;
  isRead?: boolean;
  onMarkRead?: () => void;
  commentsOpen: boolean;
  setCommentsOpen: (b: boolean) => void;
  commentCount: number | null | undefined;
  localLiked: boolean;
  setLocalLiked: (b: boolean) => void;
  likeMutation: (args: { id: string; liked: boolean }) => void;
  isSavedFn: (id: string) => boolean;
  toggleSave: (id: string) => Promise<void> | void;
  scrollRef: React.RefObject<HTMLDivElement>;
  fillRef: React.RefObject<HTMLDivElement>;
  handleScroll: () => void;
  imgError: boolean;
  setImgError: (b: boolean) => void;
  focusCommentId: number | null;
  onRequireAuth?: () => void;
  relatedArticles?: NewsArticle[];
  onSelectArticle?: (a: NewsArticle) => void;
}) {
  const hasImage = article.imageUrl && !imgError;
  const paragraphs = article.content.split("\n\n").filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.65, 0.3, 1] }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: DESK_PAPER, color: DESK_INK }}
    >
      {/* Subtle paper grain behind everything */}
      <GrainBackground variant="white" />

      {/* ── Utility strip — black bar + white ── */}
      <div
        className="relative w-full"
        style={{ background: "#0a0a0a", color: "#fff", zIndex: 50, flexShrink: 0, isolation: "isolate", overflow: "hidden" }}
      >
        <div className="relative max-w-[1320px] mx-auto px-10">
          <div className="grid grid-cols-3 items-center py-4">
            <button
              onClick={onClose}
              className="group inline-flex items-center gap-2 justify-self-start transition-opacity hover:opacity-80"
              style={{
                fontFamily: "'Macabro', serif",
                fontSize: "clamp(10px, 0.85vw, 14px)",
                letterSpacing: "0.06em",
                color: "#fff",
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.6} />
              <span>{format(new Date(article.publishedAt), "EEEE, do MMMM")}</span>
            </button>
            <div className="flex items-center justify-center">
              <span
                style={{
                  fontFamily: "'Macabro', serif",
                  fontSize: "clamp(20px, 2.2vw, 30px)",
                  letterSpacing: "0.04em",
                  color: "#fff",
                  textTransform: "uppercase",
                  lineHeight: 1,
                }}
              >
                POPCORN
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close article"
              className="inline-flex items-center gap-2 justify-self-end transition-opacity hover:opacity-80"
              style={{
                fontFamily: "'Macabro', serif",
                fontSize: "clamp(8.5px, 0.7vw, 11px)",
                letterSpacing: "0.28em",
                color: "#fff",
                textTransform: "uppercase",
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              <span>Close</span>
              <X className="w-3.5 h-3.5" strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Reading progress hairline ─────────────────────────────────── */}
      <div style={{ height: 2, width: "100%", background: "rgba(15,15,16,0.06)", position: "relative", flexShrink: 0, zIndex: 21 }}>
        <div
          ref={fillRef}
          style={{
            position: "absolute",
            inset: 0,
            background: DESK_BLUE,
            transform: "scaleX(0)",
            transformOrigin: "left center",
            willChange: "transform",
          }}
        />
      </div>

      {/* ── Scrollable editorial canvas ───────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative"
        style={{ background: DESK_PAPER, zIndex: 3 }}
      >
        <div className="max-w-[1320px] mx-auto px-10 pt-16 pb-32 relative">
          {/* ── Sticky LEFT rail — editorial action stack ───────────────
              Vertical pill stack of 4 buttons sharing borders. Each cell
              has icon + (optional) count, hover fills ink/cream, active
              states for like + save. Visible at xl: only (≥1280px). */}
          <aside
            className="hidden xl:block popcorn-desk-railL"
            style={{
              position: "relative",
              float: "right",
              marginTop: 57,
              marginRight: "calc((100% - 720px)/2 - 96px)",
              marginLeft: "-9999px",
              width: 56,
              zIndex: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
              }}
            >
              <RailCell
                icon={
                  <Heart
                    style={{
                      width: 18,
                      height: 18,
                      strokeWidth: 1.5,
                    }}
                  />
                }
                count={article.likes >= 1000 ? `${(article.likes / 1000).toFixed(1)}k` : String(article.likes)}
                onClick={() => {
                  const next = !localLiked;
                  setLocalLiked(next);
                  likeMutation({ id: article.id, liked: next });
                }}
                active={localLiked}
                activeFill="#e11d48"
              />
              <RailCell
                icon={<MessageCircle style={{ width: 18, height: 18, strokeWidth: 1.5 }} />}
                count={commentCount != null ? String(commentCount) : ""}
                onClick={() => setCommentsOpen(true)}
              />
              <RailCell
                icon={
                  <Bookmark
                    style={{
                      width: 18,
                      height: 18,
                      strokeWidth: 1.5,
                    }}
                  />
                }
                count=""
                onClick={() => void toggleSave(article.id)}
                active={isSavedFn(article.id)}
              />
              <RailCell
                icon={<Share2 style={{ width: 18, height: 18, strokeWidth: 1.5 }} />}
                count=""
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: article.title, text: article.summary, url: window.location.href }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(window.location.href).catch(() => {});
                  }
                }}
              />
            </div>
          </aside>

          {/* ── HEADER — kicker + headline + dek (single column) ─────── */}
          <header style={{ maxWidth: 720, margin: "22px auto 0" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                fontFamily: ARCHIVO,
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: HOME_BLUE,
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              <span style={{ width: 18, height: 8, background: HOME_BLUE, flex: "0 0 auto" }} />
              {article.category}
            </span>

            {/* Headline — Bricolage Grotesque */}
            <h1
              style={{
                fontFamily: HEADLINE_FONT,
                fontWeight: 700,
                fontSize: "clamp(34px, 5vw, 62px)",
                lineHeight: 0.98,
                letterSpacing: "-0.018em",
                color: DESK_INK,
                margin: "18px 0 0 0",
                textWrap: "balance",
              }}
            >
              {article.title}
            </h1>

            {/* Dek — Archivo, dark, medium */}
            {article.summary && (
              <p
                style={{
                  fontFamily: ARCHIVO,
                  fontWeight: 500,
                  fontSize: "clamp(18px, 2vw, 22px)",
                  lineHeight: 1.45,
                  color: DESK_INK,
                  margin: "22px 0 0 0",
                  maxWidth: "54ch",
                }}
              >
                {article.summary}
              </p>
            )}
          </header>

          {/* ── HERO — editorial media at reading-column width, 16/9.
              Sized to match the text column so it sits clear of the
              sticky left action rail in the gutter. ─────────────────── */}
          {hasImage && (
            <figure style={{ maxWidth: 720, margin: "34px auto 0" }}>
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  aspectRatio: "16 / 9",
                  background: DESK_CREAM,
                }}
              >
                <img
                  src={readerImageUrl(article.imageUrl!)}
                  alt={article.title}
                  onError={() => setImgError(true)}
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition:
                      typeof article.imageFocalX === "number" && typeof article.imageFocalY === "number"
                        ? `${(article.imageFocalX * 100).toFixed(1)}% ${(article.imageFocalY * 100).toFixed(1)}%`
                        : "center 40%",
                  }}
                />
              </div>
              {article.imageCredit && (
                <figcaption
                  style={{
                    fontFamily: ARCHIVO,
                    fontSize: "12.5px",
                    color: DESK_MUTE,
                    marginTop: 11,
                    maxWidth: 720,
                  }}
                >
                  {article.imageCredit}
                </figcaption>
              )}
            </figure>
          )}

          {/* ── Reading column — 720px ─────────────────────────────── */}
          <article style={{ maxWidth: 720, margin: "38px auto 0" }}>

            {/* Body — Archivo (mockup) */}
            <div
              className="popcorn-desk-body"
              style={{
                position: "relative",
                fontFamily: ARCHIVO,
                fontWeight: 400,
                fontSize: "19px",
                lineHeight: 1.68,
                color: DESK_INK2,
                letterSpacing: "-0.002em",
              }}
            >
              {/* Left-side Popcorn app ad — sits in the gutter beside the
                  reading column, sticky as the body scrolls, and stops at the
                  bottom of the article body (its containing block ends here). */}
              <DeskAppAd />
              {(() => {
                const midIdx = Math.max(1, Math.floor(paragraphs.length / 2));
                return paragraphs.map((para, i) => (
                  <Fragment key={i}>
                    {i === midIdx && (
                      <aside
                        aria-label="Follow Popcorn on Instagram"
                        style={{
                          float: "right",
                          width: 200,
                          marginLeft: 28,
                          marginBottom: 16,
                          marginTop: 4,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: ARCHIVO,
                            fontWeight: 700,
                            fontSize: "10px",
                            letterSpacing: "0.2em",
                            color: HOME_BLUE,
                            textTransform: "uppercase",
                            lineHeight: 1,
                            marginBottom: 10,
                          }}
                        >
                          Follow Us
                        </div>
                        <a
                          href="https://instagram.com"
                          target="_blank"
                          rel="noreferrer"
                          className="relative overflow-hidden block group"
                          style={{
                            aspectRatio: "1 / 1",
                            border: `1px solid ${DESK_INK}`,
                            background: HOME_BLUE,
                            isolation: "isolate",
                          }}
                        >
                          <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0"
                            style={{ opacity: 0.55, mixBlendMode: "overlay" }}
                          >
                            <GrainBackground variant="popcorn-blue" />
                          </div>
                          <div
                            className="absolute"
                            style={{ top: 10, left: 10, color: DESK_CREAM }}
                          >
                            <Instagram size={17} strokeWidth={1.8} />
                          </div>
                          <div
                            className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-4 px-3 transition-transform duration-300 group-hover:-translate-y-0.5"
                            style={{
                              fontFamily: "'Newsreader', serif",
                              fontStyle: "italic",
                              fontSize: "13px",
                              color: DESK_CREAM,
                              textAlign: "center",
                              lineHeight: 1.3,
                            }}
                          >
                            @popcornmedia
                          </div>
                        </a>
                        <h4
                          style={{
                            margin: "12px 0 5px",
                            fontFamily: HEADLINE_FONT,
                            fontWeight: 600,
                            fontSize: "15px",
                            lineHeight: 1.18,
                            color: DESK_INK,
                            letterSpacing: "-0.012em",
                          }}
                        >
                          See you in the comments section
                        </h4>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: ARCHIVO,
                            fontSize: "12.5px",
                            lineHeight: 1.5,
                            color: DESK_MUTE,
                          }}
                        >
                          Follow @popcornmedia for more music, film, internet
                          and culture.
                        </p>
                      </aside>
                    )}
                    <p
                      style={{ margin: "0 0 26px 0" }}
                      className={i === 0 ? "popcorn-desk-first" : undefined}
                    >
                      {para}
                    </p>
                  </Fragment>
                ));
              })()}
              {/* Clear the float so subsequent blocks resume full width. */}
              <div style={{ clear: "both" }} />
            </div>

            {/* ── UP NEXT — clean 3-card grid of same-day stories ─────── */}
            {relatedArticles.length > 0 && (
              <section
                style={{
                  // Sits at the reading-column width so the cards stay compact
                  // and the block clears the sticky left action rail.
                  maxWidth: 720,
                  margin: "64px auto 0",
                }}
              >
                <header
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 14,
                    marginBottom: 26,
                  }}
                >
                  <h3
                    style={{
                      fontFamily: HEADLINE_FONT,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      fontSize: "clamp(22px, 2.4vw, 30px)",
                      lineHeight: 1,
                      letterSpacing: "-0.01em",
                      color: DESK_INK,
                      margin: 0,
                    }}
                  >
                    Up Next
                  </h3>
                  <span style={{ flex: 1, height: 1, background: DESK_RULE, alignSelf: "center" }} />
                </header>

                <ul
                  className="popcorn-desk-upnext"
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 20,
                    alignItems: "start",
                  }}
                >
                  {relatedArticles.slice(0, 3).map((rel) => {
                    const relImg = rel.imageUrl ? readerImageUrl(rel.imageUrl) : null;
                    return (
                      <li key={rel.id} style={{ margin: 0 }}>
                        <button
                          type="button"
                          onClick={() => onSelectArticle?.(rel)}
                          className="popcorn-desk-ncard"
                          style={{
                            display: "block",
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              position: "relative",
                              aspectRatio: "4 / 5",
                              overflow: "hidden",
                              background: DESK_CREAM,
                              boxShadow: "0 20px 40px -28px rgba(20,18,16,0.5)",
                            }}
                          >
                            {relImg && (
                              <img
                                src={relImg}
                                alt=""
                                loading="lazy"
                                className="popcorn-desk-ncard-img"
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  transition: "transform .7s cubic-bezier(.22,.61,.36,1)",
                                }}
                              />
                            )}
                          </div>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 7,
                              marginTop: 12,
                              fontFamily: ARCHIVO,
                              fontSize: "10px",
                              fontWeight: 700,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              color: HOME_BLUE,
                            }}
                          >
                            <span style={{ width: 12, height: 6, background: HOME_BLUE, flex: "0 0 auto" }} />
                            {rel.category}
                          </span>
                          <h4
                            style={{
                              margin: "6px 0 0",
                              fontFamily: HEADLINE_FONT,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              fontSize: "15px",
                              lineHeight: 1.08,
                              letterSpacing: "-0.005em",
                              color: DESK_INK,
                              textWrap: "balance",
                            }}
                          >
                            {rel.title}
                          </h4>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* End scallop — mark as read */}
            <div
              style={{
                marginTop: 64,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 18,
              }}
            >
              <button
                onClick={() => {
                  onMarkRead?.();
                  onClose();
                }}
                className="inline-flex items-center gap-2 rounded-full transition-all active:scale-95 hover:opacity-90"
                style={{
                  marginTop: 6,
                  fontFamily: "'Macabro', serif",
                  fontSize: "14px",
                  letterSpacing: "0.06em",
                  padding: "13px 30px",
                  color: "#fff",
                  background: "#042c85",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2} />
                {isRead ? "Unmark as read" : "Mark as read"}
              </button>
            </div>
          </article>
        </div>

        {/* Body styles — drop cap + rail hover */}
        <style>{`
          .popcorn-desk-body .popcorn-desk-first::first-letter {
            font-family: ${HEADLINE_FONT};
            font-weight: 700;
            color: ${HOME_BLUE};
            font-size: 84px;
            line-height: 0.74;
            float: left;
            padding: 6px 14px 0 0;
            margin-top: 4px;
            letter-spacing: -0.02em;
          }
          @media (max-width: 760px) {
            .popcorn-desk-body .popcorn-desk-first::first-letter {
              font-size: 64px;
              padding: 4px 10px 0 0;
            }
          }
          .popcorn-desk-rail-cell:hover {
            background: ${DESK_INK} !important;
            color: ${DESK_CREAM} !important;
            border-color: ${DESK_INK} !important;
            transform: translateY(-1px);
          }
          .popcorn-desk-rail-cell:hover span,
          .popcorn-desk-rail-cell:hover svg {
            color: ${DESK_CREAM} !important;
            stroke: ${DESK_CREAM} !important;
          }
          .popcorn-desk-rail-cell:active {
            transform: scale(0.97);
          }

          /* Left app-ad: only shown when the gutter is wide enough to hold the
             larger card without clipping (the action rail eats ~96px of it). */
          .popcorn-desk-appad { display: none; }
          @media (min-width: 1440px) { .popcorn-desk-appad { display: block; } }
          /* Left app-ad download button — subtle lift on hover. */
          .popcorn-desk-appad-btn { transition: transform .18s ease, opacity .18s ease; }
          .popcorn-desk-appad-btn:hover { transform: translateY(-1px); opacity: 0.92; }

          /* Left app-ad flicker montage → resolved CTA crossfade. */
          .popcorn-deskad-flick { position: absolute; inset: 0; opacity: 1; transition: opacity .9s ease; z-index: 0; }
          .popcorn-deskad-card.is-resolved .popcorn-deskad-flick { opacity: 0; }
          .popcorn-deskad-flick img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; filter: grayscale(0.2) contrast(1.06); }
          .popcorn-deskad-flick img.is-on { opacity: 1; }
          .popcorn-deskad-cta { position: absolute; inset: 0; background: ${HOME_BLUE}; opacity: 0; pointer-events: none; transition: opacity .9s ease; z-index: 1; }
          .popcorn-deskad-card.is-resolved .popcorn-deskad-cta { opacity: 1; pointer-events: auto; }
          .popcorn-deskad-wordmark { transform: translateY(8px); opacity: 0; transition: transform .9s cubic-bezier(.22,.61,.36,1), opacity .9s ease; }
          .popcorn-deskad-card.is-resolved .popcorn-deskad-wordmark { transform: translateY(0); opacity: 1; }

          /* Up Next cards: slow image zoom on hover. */
          .popcorn-desk-ncard:hover .popcorn-desk-ncard-img { transform: scale(1.05); }
          .popcorn-desk-ncard:focus-visible {
            outline: 2px solid ${HOME_BLUE};
            outline-offset: 4px;
          }
          @media (max-width: 760px) {
            .popcorn-desk-upnext { grid-template-columns: 1fr !important; }
          }

          /* Foot tag pill: outline by default, fills brand blue on hover. */
          .popcorn-desk-tag {
            transition: background .18s ease, color .18s ease, border-color .18s ease;
          }
          .popcorn-desk-tag:hover {
            background: ${HOME_BLUE};
            color: #fff;
            border-color: ${HOME_BLUE};
          }
        `}</style>
      </div>

      {/* Comment sheet still slides up from the bottom on desktop */}
      <CommentSheet
        isOpen={commentsOpen}
        articleId={article.id}
        onClose={() => setCommentsOpen(false)}
        focusCommentId={commentsOpen ? focusCommentId : null}
        onRequireAuth={onRequireAuth}
      />
    </motion.div>
  );
}

/* Left-side app-download ad — a compact vertical card that mirrors the
   home feed's AppPromoTop (kicker + title + CTA over a popcorn-blue grain
   field). Sticks in the left gutter beside the reading column, xl-only. */
// Same intro montage frames the home-feed app ad flickers through.
const DESK_PROMO_FRAMES: ReadonlyArray<string> = [
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

function DeskAppAd() {
  const [i, setI] = useState(0);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let flick: number | undefined;
    let stop: number | undefined;
    let restart: number | undefined;

    // Flicker through the frames for ~10s, crossfade to the resolved lockup,
    // hold briefly, then replay the montage.
    const runCycle = () => {
      setResolved(false);
      setI(0);
      flick = window.setInterval(
        () => setI((p) => (p + 1) % DESK_PROMO_FRAMES.length),
        300,
      );
      stop = window.setTimeout(() => {
        window.clearInterval(flick);
        setResolved(true);
        restart = window.setTimeout(runCycle, 16000);
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
    <aside
      className="popcorn-desk-appad"
      aria-label="Download the Popcorn app"
      style={{
        position: "sticky",
        top: 132,
        float: "left",
        marginLeft: "calc((100% - 720px)/2 - 342px)",
        marginRight: "-9999px",
        width: 240,
        zIndex: 4,
      }}
    >
      <div
        className={`popcorn-deskad-card ${resolved ? "is-resolved" : ""}`}
        style={{
          position: "relative",
          overflow: "hidden",
          aspectRatio: "1 / 2",
          background: HOME_BLUE,
          color: "#fff",
          border: `1px solid ${DESK_INK}`,
          boxShadow: "0 14px 26px -18px rgba(0,0,0,0.5)",
          isolation: "isolate",
        }}
      >
        {/* Flicker montage */}
        <div className="popcorn-deskad-flick">
          {DESK_PROMO_FRAMES.map((src, n) => (
            <img
              key={n}
              src={src}
              alt=""
              className={n === i ? "is-on" : ""}
              draggable={false}
            />
          ))}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: 0.4, mixBlendMode: "overlay" }}>
            <GrainBackground variant="popcorn-blue" />
          </div>
        </div>

        {/* Resolved CTA — crossfades in over the montage */}
        <div className="popcorn-deskad-cta">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: 0.55, mixBlendMode: "overlay" }}>
            <GrainBackground variant="popcorn-blue" />
          </div>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", padding: "22px 18px" }}>
            <span
              style={{
                display: "block",
                fontFamily: "'Macabro', serif",
                fontSize: "10px",
                letterSpacing: "0.42em",
                textTransform: "uppercase",
                color: "#fff",
                opacity: 0.85,
                lineHeight: 1,
              }}
            >
              Popcorn for iOS
            </span>
            <h3
              className="popcorn-deskad-wordmark"
              style={{
                margin: "auto 0 0",
                fontFamily: "'Macabro', serif",
                fontWeight: 400,
                fontSize: "clamp(28px, 2.3vw, 38px)",
                lineHeight: 1.0,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                color: "#fff",
              }}
            >
              The Pop in your pocket.
            </h3>
            <a
              href="#"
              className="popcorn-desk-appad-btn"
              style={{
                marginTop: 18,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontFamily: HOME_SANS,
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: HOME_BLUE,
                background: "#fff",
                padding: "12px 14px",
                textDecoration: "none",
              }}
            >
              Download ↗
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* Vertical stack cell used by the left-hand editorial action rail.
   Each cell renders an icon + a small count below it. Cells share top
   hairlines (except the first) so the column reads as one bordered
   pill. Hover fills ink + inverts cream. Active states (liked, saved)
   fill the icon and tint it. */
function RailCell({
  icon,
  count,
  onClick,
  active = false,
  activeFill,
}: {
  icon: ReactNode;
  count: string;
  onClick: () => void;
  active?: boolean;
  activeFill?: string;
}) {
  const fill = active ? (activeFill ?? DESK_INK) : "transparent";
  const stroke = active ? (activeFill ?? DESK_INK) : DESK_INK;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
      }}
    >
      <button
        onClick={onClick}
        className="popcorn-desk-rail-cell"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: DESK_PAPER,
          border: `1px solid ${active ? (activeFill ?? DESK_INK) : DESK_RULE}`,
          color: stroke,
          cursor: "pointer",
          position: "relative",
          boxShadow: "0 8px 18px -12px rgba(0,0,0,0.4)",
          transition: "background .18s ease, color .18s ease, border-color .18s ease, transform .12s ease",
        }}
      >
        <span style={{ display: "inline-flex", color: stroke }}>
          {cloneWithFill(icon, fill, stroke)}
        </span>
      </button>
      {count && (
        <span
          style={{
            fontFamily: "'Newsreader', serif",
            fontSize: 11,
            fontWeight: 700,
            color: DESK_INK,
            letterSpacing: "0.01em",
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

/* Helper — clone an icon element to add a custom fill + stroke. */
function cloneWithFill(icon: ReactNode, fill: string, stroke: string): ReactNode {
  if (!icon || typeof icon !== "object" || !("props" in (icon as { props?: unknown }))) return icon;
  const el = icon as React.ReactElement<{ style?: React.CSSProperties }>;
  const prevStyle = el.props.style ?? {};
  return {
    ...el,
    props: {
      ...el.props,
      style: { ...prevStyle, fill, color: stroke },
    },
  } as React.ReactElement;
}
