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
    <div className="h-[100dvh] w-full snap-start snap-always relative overflow-hidden flex flex-col cursor-pointer" onClick={() => onReadMore(article)}>
      {/* Content positioned in lower ~65% of card, glass panel */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-8 sm:px-8">
        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-[0_20px_40px_rgba(25,28,27,0.06)] border border-white/40">
          {/* Tag + Source row */}
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-[#191c1b] text-[#e5e2e1] rounded-full text-[10px] font-bold uppercase tracking-widest font-['Inter']">
              {article.tag}
            </span>
            <span className="text-[#474747] font-semibold text-sm font-['Inter'] uppercase tracking-widest">
              {article.source}
            </span>
          </div>
          
          {/* Headline */}
          <h2 className="text-4xl sm:text-5xl font-bold leading-[1.1] text-[#191c1b] mb-4 font-['Manrope'] tracking-tight">
            {article.title}
          </h2>
          
          {/* Summary */}
          <p className="text-base sm:text-lg text-[#474747] leading-relaxed line-clamp-3 font-['Inter'] mb-6">
            {article.summary}
          </p>
          
          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm font-medium text-[#474747] font-['Inter']">
              <span>{format(new Date(article.publishedAt), 'MMM d')}</span>
              <span className="w-1 h-1 rounded-full bg-[#474747]/40" />
              <span>{article.readTimeMinutes} min read</span>
              <div className="flex items-center gap-1 text-[#474747]/60 text-xs">
                <ChevronUp className="w-3 h-3" />
                <span>Swipe</span>
              </div>
            </div>
            <ActionButtons article={article} />
          </div>
        </div>
      </div>
    </div>
  );
}