import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Calendar, Check, Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { format } from "date-fns";
import type { NewsArticle } from "@workspace/api-client-react";
import { useBookmarkArticle, useLikeArticle } from "@/hooks/use-news";
import { CommentSheet, getInitialCommentCount } from "@/components/CommentSheet";
import { GrainBackground } from "@/components/GrainBackground";

const CATEGORY_COLORS: Record<string, string> = {
  Models:   '#a78bfa',
  Research: '#34d399',
  Industry: '#fbbf24',
  Policy:   '#60a5fa',
  Tools:    '#f472b6',
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
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '300px', objectFit: 'cover', objectPosition: 'top center' }}
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
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(32,74,82,0.22)' }} />
            </div>

            {/* X button */}
            <button
              onClick={onClose}
              className="absolute right-4 z-40 p-1.5 rounded-full transition-colors"
              style={{ background: '#000000', color: '#ffffff', border: '1px solid rgba(0,0,0,0.15)', top: 'calc(12px + env(safe-area-inset-top))' }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Reading progress bar */}
            <div style={{ height: 2, width: '100%', position: 'relative', zIndex: 21, flexShrink: 0, background: 'rgba(32,74,82,0.08)' }}>
              <div
                ref={fillRef}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: '100%', background: '#204a52' }}
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
                    className="w-full h-full object-cover object-top"
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
                {/* Category pill */}
                <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 10 }}>
                  <span
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full uppercase"
                    style={{ background: '#000000', color: '#ffffff', border: '1px solid rgba(0,0,0,0.15)', fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: '10px', letterSpacing: '0.05em' }}
                  >
                    <span
                      style={{
                        display: 'inline-block', width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: CATEGORY_COLORS[article.category] ?? 'rgba(255,255,255,0.5)',
                        boxShadow: `0 0 5px 1px ${CATEGORY_COLORS[article.category] ?? 'rgba(255,255,255,0.4)'}`,
                      }}
                    />
                    {article.tag}
                  </span>
                </div>
              </div>

              {/* Article body */}
              <div className="max-w-2xl mx-auto px-5 pt-7 pb-28 sm:px-8">

                {/* Source + metadata */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-5">
                  <span style={{ fontSize: '13px', color: '#204a52', fontFamily: "'Macabro', 'Anton', sans-serif", letterSpacing: '0.04em' }}>
                    {article.source}
                  </span>
                  <span style={{ color: 'rgba(32,74,82,0.3)', fontSize: '13px' }}>·</span>
                  <span className="flex items-center gap-1" style={{ fontSize: '12px', color: 'rgba(32,74,82,0.55)', fontFamily: "'Inter', sans-serif" }}>
                    <Calendar className="w-3 h-3" />
                    {format(new Date(article.publishedAt), 'MMM d, yyyy')}
                  </span>
                  <span style={{ color: 'rgba(32,74,82,0.3)', fontSize: '13px' }}>·</span>
                  <span className="flex items-center gap-1" style={{ fontSize: '12px', color: 'rgba(32,74,82,0.55)', fontFamily: "'Inter', sans-serif" }}>
                    <Clock className="w-3 h-3" />
                    {article.readTimeMinutes} min read
                  </span>
                </div>

                {/* Headline */}
                <h1
                  className="font-['Manrope']"
                  style={{ fontWeight: 800, fontSize: 'clamp(26px, 6vw, 38px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: '#1a1a1a', marginBottom: '28px' }}
                >
                  {article.title}
                </h1>

                {/* TLDR — callout block */}
                <div className="mb-8" style={{ borderLeft: '3px solid #204a52', borderRadius: '0 10px 10px 0', padding: '16px 20px' }}>
                  <div style={{ fontSize: '9px', fontFamily: "'Macabro', 'Anton', sans-serif", letterSpacing: '0.16em', color: '#204a52', textTransform: 'uppercase', marginBottom: '8px' }}>
                    TLDR
                  </div>
                  <p style={{ fontSize: '16px', color: '#111111', lineHeight: 1.75, fontFamily: "'Lora', Georgia, serif", margin: 0 }}>
                    {article.summary}
                  </p>
                </div>

                {/* Key Points */}
                {article.keyPoints && article.keyPoints.length > 0 && (
                  <div className="mb-8">
                    <SectionHeading>Key Points</SectionHeading>
                    <ul className="flex flex-col gap-3">
                      {article.keyPoints.map((point: string, i: number) => (
                        <li key={i} className="flex gap-3 items-start">
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#204a52', flexShrink: 0, marginTop: '9px' }} />
                          <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '15px', lineHeight: 1.7, color: '#111111', margin: 0 }}>{point}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Story */}
                <div className="mb-8">
                  <SectionHeading>Story</SectionHeading>
                  <div className="space-y-5" style={{ fontSize: '17px', color: '#111111', lineHeight: 1.88, fontFamily: "'Lora', Georgia, serif" }}>
                    {article.content.split('\n\n').map((para: string, i: number) => (
                      <p key={i} style={{ margin: 0 }}>{para}</p>
                    ))}
                  </div>
                </div>

                {/* Impact */}
                {article.impact && (
                  <div className="mb-8">
                    <SectionHeading>Impact</SectionHeading>
                    <div style={{ borderLeft: '3px solid #204a52', background: 'rgba(32,74,82,0.04)', borderRadius: '0 10px 10px 0', padding: '16px 20px' }}>
                      <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '15px', lineHeight: 1.75, color: '#111111', fontStyle: 'italic', margin: 0 }}>{article.impact}</p>
                    </div>
                  </div>
                )}

                {/* Footer CTA */}
                <div className="mt-16 pt-8 flex items-center justify-center" style={{ borderTop: '1px solid rgba(32,74,82,0.12)' }}>
                  <button
                    onClick={() => { onMarkRead?.(); onClose(); }}
                    className="flex items-center gap-2 px-7 py-3 rounded-full font-['Manrope'] font-bold text-sm transition-all active:scale-95"
                    style={{ background: '#204a52', color: '#fff3d3', letterSpacing: '0.02em' }}
                  >
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                    {isRead ? 'Unmark as Read' : 'Mark as Read'}
                  </button>
                </div>
              </div>
            </div>

            {/* Social bar — right side, vertical */}
            <div className="absolute right-3 top-0 bottom-0 z-20 flex flex-col items-center justify-center gap-5 pointer-events-none pb-6">
              {/* Like */}
              <button
                onClick={() => { const next = !localLiked; setLocalLiked(next); likeMutation({ id: article.id, liked: next }); }}
                className="pointer-events-auto flex flex-col items-center gap-1 transition-all duration-200 active:scale-90"
              >
                <Heart style={{ width: 26, height: 26, color: localLiked ? '#e11d48' : '#204a52', fill: localLiked ? '#e11d48' : 'none', strokeWidth: 1.6 }} />
                <span className="font-['Inter'] font-semibold" style={{ fontSize: '10px', lineHeight: 1, color: localLiked ? '#e11d48' : 'rgba(32,74,82,0.5)' }}>
                  {article.likes >= 1000 ? `${(article.likes / 1000).toFixed(1)}k` : article.likes}
                </span>
              </button>

              {/* Comment */}
              <button
                onClick={() => setCommentsOpen(true)}
                className="pointer-events-auto flex flex-col items-center gap-1 transition-all duration-200 active:scale-90"
              >
                <MessageCircle style={{ width: 26, height: 26, color: '#204a52', strokeWidth: 1.6 }} />
                <span className="font-['Inter'] font-semibold" style={{ fontSize: '10px', lineHeight: 1, color: 'rgba(32,74,82,0.5)' }}>
                  {getInitialCommentCount(article.id)}
                </span>
              </button>

              {/* Bookmark */}
              <button
                onClick={() => bookmarkMutation(article.id)}
                className="pointer-events-auto flex flex-col items-center gap-1 transition-all duration-200 active:scale-90"
              >
                <Bookmark style={{ width: 26, height: 26, color: '#204a52', fill: article.isBookmarked ? '#204a52' : 'none', strokeWidth: 1.4 }} />
              </button>

              {/* Share */}
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: article.title, text: article.summary, url: window.location.href }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
                className="pointer-events-auto flex flex-col items-center gap-1 transition-all duration-200 active:scale-90"
              >
                <Share2 style={{ width: 26, height: 26, color: '#204a52', strokeWidth: 1.4 }} />
              </button>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid rgba(32,74,82,0.15)' }}>
      <span style={{ display: 'inline-block', width: 3, height: 13, background: '#204a52', borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontSize: '10px', color: '#204a52', fontFamily: "'Macabro', 'Anton', sans-serif", letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        {children}
      </span>
    </div>
  );
}
