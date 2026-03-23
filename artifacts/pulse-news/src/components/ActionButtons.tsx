import { useState } from "react";
import { Heart, Bookmark, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLikeArticle, useBookmarkArticle } from "@/hooks/use-news";
import type { NewsArticle } from "@workspace/api-client-react";

interface ActionButtonsProps {
  article: NewsArticle;
  hasImage?: boolean;
}

export function ActionButtons({ article, hasImage = false }: ActionButtonsProps) {
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

  const iconBg = hasImage ? 'bg-white/12 border border-white/18' : 'bg-[#191c1b]/8';
  const iconColor = hasImage ? 'text-white/85' : 'text-[#191c1b]';
  const labelColor = hasImage ? 'text-white/50' : 'text-[#474747]';

  return (
    <div className="flex items-center gap-4 z-30">
      <button 
        onClick={handleLike}
        className="flex flex-col items-center gap-1 group transition-transform active:scale-90"
      >
        <div className={cn(
          "p-2.5 rounded-full transition-colors",
          iconBg,
          isLiked ? "bg-red-500/15 text-red-400 border-red-400/20" : iconColor
        )}>
          <Heart className={cn("w-5 h-5 transition-all", isLiked && "fill-current")} />
        </div>
        <span className={cn("text-[11px] font-semibold", labelColor)}>
          {article.likes + (localLiked ? 1 : 0)}
        </span>
      </button>

      <button 
        onClick={handleBookmark}
        className="flex flex-col items-center gap-1 group transition-transform active:scale-90"
      >
        <div className={cn(
          "p-2.5 rounded-full transition-colors",
          article.isBookmarked ? "bg-primary/20 text-primary" : cn(iconBg, iconColor)
        )}>
          <Bookmark className={cn("w-5 h-5 transition-all", article.isBookmarked && "fill-current")} />
        </div>
        <span className={cn("text-[11px] font-semibold", labelColor)}>Save</span>
      </button>

      <button 
        onClick={handleShare}
        className="flex flex-col items-center gap-1 group transition-transform active:scale-90"
      >
        <div className={cn("p-2.5 rounded-full transition-colors", iconBg, iconColor)}>
          <Share2 className="w-5 h-5" />
        </div>
        <span className={cn("text-[11px] font-semibold", labelColor)}>Share</span>
      </button>
    </div>
  );
}