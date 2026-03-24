import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ChevronUp, CheckCircle2, Heart, Bookmark, Share2, MessageCircle } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";
import { useLikeArticle, useBookmarkArticle } from "@/hooks/use-news";
import { getInitialCommentCount } from "@/components/CommentSheet";
import { CommentSheet } from "./CommentSheet";

interface ArticleCardProps {
  article: NewsArticle;
  onReadMore: (article: NewsArticle) => void;
  onEnter?: (publishedAt: string) => void;
  isRead?: boolean;
}

export function ArticleCard({ article, onReadMore, onEnter, isRead = false }: ArticleCardProps) {
  const hasImage = !!article.imageUrl;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [localLiked, setLocalLiked] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { mutate: likeMutation } = useLikeArticle();
  const { mutate: bookmarkMutation } = useBookmarkArticle();
  const commentCount = getInitialCommentCount(article.id);

  useEffect(() => {
    if (!onEnter || !cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onEnter(article.publishedAt); },
      { threshold: 0.6 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [article.publishedAt, onEnter]);

  const likeCount = article.likes + (localLiked ? 1 : 0);
  const isSaved = article.isBookmarked;

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!localLiked) { setLocalLiked(true); likeMutation(article.id); }
  };
  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    bookmarkMutation(article.id);
  };
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({ title: article.title, text: article.summary, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div
      ref={cardRef}
      className="h-[100dvh] w-full snap-start snap-always relative overflow-hidden flex flex-col cursor-pointer"
      onClick={() => onReadMore(article)}
    >
      {/* Background */}
      {hasImage ? (
        <>
          <img
            src={article.imageUrl!}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover object-top"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div
            className="absolute inset-0 z-10"
            style={{ background: 'rgba(15, 46, 30, 0.32)', mixBlendMode: 'multiply' }}
          />
          <div
            className="absolute inset-0 z-10"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.28) 50%, rgba(0,0,0,0.62) 70%, rgba(0,0,0,0.82) 100%)' }}
          />
        </>
      ) : (
        <div className="absolute inset-0 ink-diffusion-bg" />
      )}

      {/* Read badge */}
      {isRead && (
        <div
          className="absolute top-[68px] left-4 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(27,122,74,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          <span className="font-['Inter'] font-semibold text-white" style={{ fontSize: '11px', letterSpacing: '0.02em' }}>Read</span>
        </div>
      )}

      <CommentSheet isOpen={commentsOpen} articleId={article.id} onClose={() => setCommentsOpen(false)} />

      {/* Spacer */}
      <div className="flex-1 relative z-20" />

      {/* Glass card panel */}
      <div className="relative z-20 px-4">
        <div
          style={{
            borderRadius: '18px 18px 0 0',
            padding: '20px 20px 16px',
            background: 'rgba(255,255,255,0.13)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.20)',
            borderBottom: 'none',
          }}
        >
          {/* Eyebrow — plain text, no pills */}
          <div className="flex items-center gap-2 mb-2.5">
            <span className="font-['Inter'] font-bold uppercase tracking-widest" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.95)', letterSpacing: '0.12em' }}>
              {article.tag}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>·</span>
            <span className="font-['Inter'] font-semibold uppercase tracking-widest" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.10em' }}>
              {article.source}
            </span>
          </div>

          {/* Headline */}
          <h2
            className="font-['Manrope'] font-extrabold text-white"
            style={{ fontSize: '28px', lineHeight: 1.08, letterSpacing: '-0.02em', marginBottom: '10px' }}
          >
            {article.title}
          </h2>

          {/* Summary */}
          <p
            className="font-['Inter']"
            style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.68)',
              lineHeight: 1.55,
              marginBottom: '14px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }}
          >
            {article.summary}
          </p>

          {/* Bottom row */}
          <div
            className="flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: '12px' }}
          >
            {/* Meta */}
            <div className="flex items-center gap-2 font-['Inter'] font-medium" style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.42)' }}>
              <span>{format(new Date(article.publishedAt), 'MMM d')}</span>
              <span>·</span>
              <span>{article.readTimeMinutes} min</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <ChevronUp className="w-3 h-3" />
                Tap
              </span>
            </div>

            {/* Action pills */}
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {/* Like */}
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 transition-transform active:scale-90"
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  background: localLiked ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif",
                  color: localLiked ? '#fca5a5' : 'rgba(255,255,255,0.82)',
                }}
              >
                <Heart size={12} fill={localLiked ? '#fca5a5' : 'none'} stroke={localLiked ? '#fca5a5' : 'rgba(255,255,255,0.82)'} strokeWidth={2} />
                {likeCount >= 1000 ? `${(likeCount / 1000).toFixed(1)}k` : likeCount}
              </button>

              {/* Comment */}
              <button
                onClick={(e) => { e.stopPropagation(); setCommentsOpen(true); }}
                className="flex items-center justify-center transition-transform active:scale-90"
                style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.82)' }}
              >
                <MessageCircle size={12} strokeWidth={2} />
              </button>

              {/* Bookmark */}
              <button
                onClick={handleBookmark}
                className="flex items-center justify-center transition-transform active:scale-90"
                style={{ width: 30, height: 30, borderRadius: 999, background: isSaved ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.82)' }}
              >
                <Bookmark size={12} strokeWidth={2} fill={isSaved ? 'rgba(255,255,255,0.82)' : 'none'} />
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex items-center justify-center transition-transform active:scale-90"
                style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.82)' }}
              >
                <Share2 size={12} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
