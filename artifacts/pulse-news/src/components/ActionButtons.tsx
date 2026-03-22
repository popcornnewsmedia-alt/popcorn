import { useState } from "react";
import { Heart, Bookmark, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLikeArticle, useBookmarkArticle } from "@/hooks/use-news";
import type { NewsArticle } from "@workspace/api-client-react";

interface ActionButtonsProps {
  article: NewsArticle;
}

export function ActionButtons({ article }: ActionButtonsProps) {
  const [localLiked, setLocalLiked] = useState(false); // For immediate animation beyond optimistic UI
  const { mutate: likeMutation } = useLikeArticle();
  const { mutate: bookmarkMutation } = useBookmarkArticle();

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!localLiked) {
      setLocalLiked(true);
      likeMutation(article.id);
    }
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    bookmarkMutation(article.id);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Native share API or fallback to clipboard
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.summary,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const isLiked = localLiked || false; // Backend doesn't return isLiked per user in the schema, using local + count

  return (
    <div className="flex items-center gap-6 z-30">
      <button 
        onClick={handleLike}
        className="flex flex-col items-center gap-1.5 group transition-transform active:scale-90"
      >
        <div className={cn(
          "p-3 rounded-full backdrop-blur-md transition-colors",
          isLiked ? "bg-red-500/20 text-red-500" : "bg-white/10 text-white hover:bg-white/20"
        )}>
          <Heart 
            className={cn("w-6 h-6 transition-all", isLiked && "fill-current")} 
          />
        </div>
        <span className="text-xs font-semibold text-white/90 text-shadow-sm">
          {article.likes + (localLiked ? 1 : 0)}
        </span>
      </button>

      <button 
        onClick={handleBookmark}
        className="flex flex-col items-center gap-1.5 group transition-transform active:scale-90"
      >
        <div className={cn(
          "p-3 rounded-full backdrop-blur-md transition-colors",
          article.isBookmarked ? "bg-primary/20 text-primary" : "bg-white/10 text-white hover:bg-white/20"
        )}>
          <Bookmark 
            className={cn("w-6 h-6 transition-all", article.isBookmarked && "fill-current")} 
          />
        </div>
        <span className="text-xs font-semibold text-white/90 text-shadow-sm">
          Save
        </span>
      </button>

      <button 
        onClick={handleShare}
        className="flex flex-col items-center gap-1.5 group transition-transform active:scale-90"
      >
        <div className="p-3 rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition-colors">
          <Share2 className="w-6 h-6" />
        </div>
        <span className="text-xs font-semibold text-white/90 text-shadow-sm">
          Share
        </span>
      </button>
    </div>
  );
}
