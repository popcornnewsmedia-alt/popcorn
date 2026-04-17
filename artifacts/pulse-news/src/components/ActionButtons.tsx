import { useState } from "react";
import { Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";
import { useLikeArticle } from "@/hooks/use-news";
import { useSavedArticles } from "@/hooks/use-saves";
import { useCommentCount } from "@/hooks/use-comment-count";
import type { NewsArticle } from "@workspace/api-client-react";

interface ActionButtonsProps {
  article: NewsArticle;
  onOpenComments: () => void;
}

export function ActionButtons({ article, onOpenComments }: ActionButtonsProps) {
  const [localLiked, setLocalLiked] = useState(false);
  const { mutate: likeMutation } = useLikeArticle();
  // Saves are now persisted per-user in Supabase (see use-saves.ts). We
  // read the live set from context so both this icon and the Saved tab
  // stay in step, and the state syncs across devices.
  const { isSaved: isSavedFn, toggleSave } = useSavedArticles();
  const commentCount = useCommentCount(article.id);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !localLiked;
    setLocalLiked(next);
    likeMutation({ id: article.id, liked: next });
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    void toggleSave(article.id);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({ title: article.title, text: article.summary, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleComment = (e: React.MouseEvent) => { e.stopPropagation(); onOpenComments(); };

  const isLiked = localLiked;
  // Prefer the live set over `article.isBookmarked` so the icon flips
  // instantly on toggle, even if the parent hasn't re-rendered with the
  // updated overlay yet.
  const isSaved = isSavedFn(article.id);
  const likeCount = article.likes;

  const iconStyle = { filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.55))' };

  return (
    <div className="flex flex-col items-center gap-5">

      {/* Like */}
      <button onClick={handleLike} className="flex flex-col items-center gap-1 transition-transform active:scale-90">
        <Heart
          className="w-7 h-7 transition-all"
          style={{ color: isLiked ? '#e11d48' : 'white', fill: isLiked ? '#e11d48' : 'none', ...iconStyle }}
        />
        <span className="text-[11px] font-semibold font-['Inter'] text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
          {likeCount >= 1000 ? `${(likeCount / 1000).toFixed(1)}k` : likeCount}
        </span>
      </button>

      {/* Comment */}
      <button onClick={handleComment} className="flex flex-col items-center gap-1 transition-transform active:scale-90">
        <MessageCircle className="w-7 h-7" style={{ color: 'white', ...iconStyle }} />
        <span className="text-[11px] font-semibold font-['Inter'] text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{commentCount ?? ""}</span>
      </button>

      {/* Save */}
      <button onClick={handleBookmark} className="flex flex-col items-center gap-1 transition-transform active:scale-90">
        <Bookmark
          className="w-7 h-7 transition-all"
          style={{ color: 'white', fill: isSaved ? 'white' : 'none', ...iconStyle }}
        />
      </button>

      {/* Share */}
      <button onClick={handleShare} className="flex flex-col items-center gap-1 transition-transform active:scale-90">
        <Share2 className="w-7 h-7" style={{ color: 'white', ...iconStyle }} />
      </button>

    </div>
  );
}
