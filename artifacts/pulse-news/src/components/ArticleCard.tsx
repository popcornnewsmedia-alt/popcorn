import { format } from "date-fns";
import { ChevronUp } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";
import { ActionButtons } from "./ActionButtons";

interface ArticleCardProps {
  article: NewsArticle;
  onReadMore: (article: NewsArticle) => void;
}

export function ArticleCard({ article, onReadMore }: ArticleCardProps) {
  return (
    <div
      className="h-[100dvh] w-full snap-start snap-always relative overflow-hidden flex flex-col cursor-pointer"
      onClick={() => onReadMore(article)}
    >
      {/* Glass content panel — sits in the lower portion, leaves top open for atmosphere */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-[76px] sm:px-6">
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/30 shadow-[0_8px_32px_rgba(25,28,27,0.08)]">

          {/* Tag + Source */}
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-[#191c1b] text-[#e5e2e1] rounded-full text-[10px] font-bold uppercase tracking-widest font-['Inter']">
              {article.tag}
            </span>
            <span className="text-[#474747]/70 font-medium text-xs font-['Inter'] uppercase tracking-widest">
              {article.source}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl sm:text-5xl font-bold leading-[1.08] text-[#191c1b] mb-4 font-['Manrope'] tracking-tight">
            {article.title}
          </h2>

          {/* Summary */}
          <p className="text-sm sm:text-base text-[#474747] leading-relaxed line-clamp-2 font-['Inter'] mb-5">
            {article.summary}
          </p>

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs font-medium text-[#474747]/60 font-['Inter']">
              <span>{format(new Date(article.publishedAt), 'MMM d')}</span>
              <span className="w-0.5 h-0.5 rounded-full bg-[#474747]/40" />
              <span>{article.readTimeMinutes} min read</span>
              <span className="flex items-center gap-1">
                <ChevronUp className="w-3 h-3" />
                Swipe
              </span>
            </div>
            <ActionButtons article={article} />
          </div>
        </div>
      </div>
    </div>
  );
}
