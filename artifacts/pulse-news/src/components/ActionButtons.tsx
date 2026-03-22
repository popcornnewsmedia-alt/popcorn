import { useState } from "react";
import { Heart, Bookmark, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLikeArticle, useBookmarkArticle } from "@/hooks/use-news";
import type { NewsArticle } from "@workspace/api-client-react";

interface ActionButtonsProps {
  article: NewsArticle;
}

export function ActionButtons({ article }: ActionButtonsProps) {
  const [localLiked, setLocalLiked] = useState(false);
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

  const isLiked = localLiked || false;

  return (
    <div className="flex items-center gap-6 z-30">
      <button 
        onClick={handleLike}
        className="flex flex-col items-center gap-1.5 group transition-transform active:scale-90"
      >
        <div className={cn(
          "p-3 rounded-full transition-colors",
          isLiked ? "bg-red-500/15 text-red-600" : "bg-[#191c1b]/8 text-[#191c1b] hover:bg-[#191c1b]/15"
        )}>
          <Heart className={cn("w-6 h-6 transition-all", isLiked && "fill-current")} />
        </div>
        <span className="text-xs font-semibold text-[#474747]">
          {article.likes + (localLiked ? 1 : 0)}
        </span>
      </button>

      <button 
        onClick={handleBookmark}
        className="flex flex-col items-center gap-1.5 group transition-transform active:scale-90"
      >
        <div className={cn(
          "p-3 rounded-full transition-colors",
          article.isBookmarked ? "bg-primary/20 text-primary" : "bg-[#191c1b]/8 text-[#191c1b] hover:bg-[#191c1b]/15"
        )}>
          <Bookmark className={cn("w-6 h-6 transition-all", article.isBookmarked && "fill-current")} />
        </div>
        <span className="text-xs font-semibold text-[#474747]">
          Save
        </span>
      </button>

      <button 
        onClick={handleShare}
        className="flex flex-col items-center gap-1.5 group transition-transform active:scale-90"
      >
        <div className="p-3 rounded-full bg-[#191c1b]/8 text-[#191c1b] hover:bg-[#191c1b]/15 transition-colors">
          <Share2 className="w-6 h-6" />
        </div>
        <span className="text-xs font-semibold text-[#474747]">
          Share
        </span>
      </button>
    </div>
  );
}