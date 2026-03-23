import { useState } from "react";
import { Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";
import { useLikeArticle, useBookmarkArticle } from "@/hooks/use-news";
import type { NewsArticle } from "@workspace/api-client-react";

interface ActionButtonsProps {
  article: NewsArticle;
}

const glassBtn = {
  background: 'rgba(236, 243, 239, 0.75)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(26,68,48,0.14)',
  boxShadow: '0 4px 16px rgba(26,68,48,0.14)',
};

const glassBtnActive = {
  background: 'rgba(220, 242, 230, 0.90)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(26,68,48,0.28)',
  boxShadow: '0 4px 16px rgba(26,68,48,0.20)',
};

export function ActionButtons({ article }: ActionButtonsProps) {
  const [localLiked, setLocalLiked] = useState(false);
  const { mutate: likeMutation } = useLikeArticle();
  const { mutate: bookmarkMutation } = useBookmarkArticle();

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

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const isLiked = localLiked;
  const isSaved = article.isBookmarked;

  return (
    <div className="flex flex-col items-center gap-3">

      {/* Like */}
      <button
        onClick={handleLike}
        className="flex flex-col items-center gap-1 transition-transform active:scale-90"
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={isLiked ? glassBtnActive : glassBtn}>
          <Heart
            className="w-5 h-5 transition-all"
            style={{ color: isLiked ? '#e11d48' : '#0f2a1a', fill: isLiked ? '#e11d48' : 'none' }}
          />
        </div>
        <span className="text-[10px] font-semibold font-['Inter'] text-white/70">
          {(article.likes + (localLiked ? 1 : 0)).toLocaleString()}
        </span>
      </button>

      {/* Comment */}
      <button
        onClick={handleComment}
        className="flex flex-col items-center gap-1 transition-transform active:scale-90"
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={glassBtn}>
          <MessageCircle className="w-5 h-5" style={{ color: '#0f2a1a' }} />
        </div>
        <span className="text-[10px] font-semibold font-['Inter'] text-white/70">Comment</span>
      </button>

      {/* Save */}
      <button
        onClick={handleBookmark}
        className="flex flex-col items-center gap-1 transition-transform active:scale-90"
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={isSaved ? glassBtnActive : glassBtn}>
          <Bookmark
            className="w-5 h-5 transition-all"
            style={{ color: '#0f2a1a', fill: isSaved ? '#0f2a1a' : 'none' }}
          />
        </div>
        <span className="text-[10px] font-semibold font-['Inter'] text-white/70">Save</span>
      </button>

      {/* Share */}
      <button
        onClick={handleShare}
        className="flex flex-col items-center gap-1 transition-transform active:scale-90"
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={glassBtn}>
          <Share2 className="w-5 h-5" style={{ color: '#0f2a1a' }} />
        </div>
        <span className="text-[10px] font-semibold font-['Inter'] text-white/70">Share</span>
      </button>

    </div>
  );
}
