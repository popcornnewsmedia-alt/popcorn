import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Check, Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { format } from "date-fns";
import type { NewsArticle } from "@workspace/api-client-react";
import { useBookmarkArticle, useLikeArticle } from "@/hooks/use-news";
import { CommentSheet, getInitialCommentCount } from "@/components/CommentSheet";
import { GrainBackground } from "@/components/GrainBackground";

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

interface ArticleReaderProps {
  article: NewsArticle | null;
  onClose: () => void;
  isRead?: boolean;
  onMarkRead?: () => void;
}

export function ArticleReader({ article, onClose, isRead = false, onMarkRead }: ArticleReaderProps) {
  const { mutate: bookmarkMutation } = useBookmarkArticle();
  const { mutate: likeMutation } = useLikeArticle();
  const [imgError, setImgError] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [localLiked, setLocalLiked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    setImgError(false);
    setLocalLiked(false);
    setCommentsOpen(false);
    if (fillRef.current) fillRef.current.style.right = '100%';
  }, [article?.id]);

  const handleScroll = () => {
    const el = scrollRef.current;
    const fill = fillRef.current;
    if (!el || !fill) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const max = scrollHeight - clientHeight;
    const pct = max > 0 ? scrollTop / max : 0;
    fill.style.right = `${(1 - pct) * 100}%`;
  };

  const onHandleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };
  const onHandleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - dragStartY.current;
    if (dy > 80) onClose();
    dragStartY.current = null;
  };

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
            style={{ background: '#ffffff' }}
          >
            <GrainBackground variant="white" />

            {/* Status-bar image bleed — fills env(safe-area-inset-top) with the hero image so the iOS
                status bar shows the article photo rather than the plain cream background */}
            <div
              style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 'env(safe-area-inset-top)',
                overflow: 'hidden',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              {article.imageUrl && !imgError ? (
                <>
                  <img
                    src={article.imageUrl}
                    aria-hidden="true"
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '300px',
                      objectFit: 'cover',
                      objectPosition: typeof article.imageFocalX === 'number' && typeof article.imageFocalY === 'number'
                        ? `${(article.imageFocalX * 100).toFixed(1)}% ${(article.imageFocalY * 100).toFixed(1)}%`
                        : 'center 20%',
                    }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }} />
                </>
              ) : (
                <div style={{ position: 'absolute', inset: 0, background: '#ffffff' }} />
              )}
            </div>

            {/* Drag handle */}
            <div
              className="absolute inset-x-0 z-30 flex justify-center pb-6"
              onTouchStart={onHandleTouchStart}
              onTouchEnd={onHandleTouchEnd}
              style={{ touchAction: 'none', top: 0, paddingTop: 'calc(8px + env(safe-area-inset-top))' }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(5,57,128,0.22)' }} />
            </div>

            {/* X button */}
            <button
              onClick={onClose}
              className="absolute right-4 z-40 p-1.5 rounded-full transition-colors"
              style={{ background: '#000000', color: '#ffffff', border: '1px solid rgba(0,0,0,0.15)', top: 'calc(12px + env(safe-area-inset-top))' }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Reading progress bar — navy on white, clearly visible */}
            <div style={{ height: 2, width: '100%', position: 'relative', zIndex: 21, flexShrink: 0, background: 'rgba(5,57,128,0.10)' }}>
              <div
                ref={fillRef}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: '100%', background: '#053980' }}
              />
            </div>

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ position: 'relative', zIndex: 1, touchAction: 'pan-y' }}
            >
              {/* Hero image */}
              <div className="relative h-72 sm:h-80 flex-shrink-0">
                {article.imageUrl && !imgError ? (
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: typeof article.imageFocalX === 'number' && typeof article.imageFocalY === 'number'
                        ? `${(article.imageFocalX * 100).toFixed(1)}% ${(article.imageFocalY * 100).toFixed(1)}%`
                        : 'center 30%',
                    }}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <>
                    <div className="absolute inset-0" style={{ background: '#ecf3ef' }} />
                    <div className="absolute inset-0" style={{ background: 'rgba(15,46,30,0.32)', mixBlendMode: 'multiply' }} />
                  </>
                )}
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 38%, rgba(255,255,255,0) 65%, rgba(255,255,255,1) 100%)' }}
                />
              </div>

              {/* Article body */}
              <div className="max-w-2xl mx-auto px-5 pt-7 pb-28 sm:px-8">

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

                {/* Social actions — inline horizontal */}
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
                      {getInitialCommentCount(article.id)}
                    </span>
                  </button>
                  <button
                    onClick={() => bookmarkMutation(article.id)}
                    className="flex items-center gap-1.5 transition-all duration-200 active:scale-90"
                    style={{ marginLeft: 'auto' }}
                  >
                    <Bookmark style={{ width: 22, height: 22, color: '#111111', fill: article.isBookmarked ? '#111111' : 'none', strokeWidth: 1.4 }} />
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

                {/* TLDR — callout block */}
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

            {/* Comment sheet */}
            <CommentSheet
              isOpen={commentsOpen}
              articleId={article.id}
              onClose={() => setCommentsOpen(false)}
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
