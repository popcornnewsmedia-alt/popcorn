import { format } from "date-fns";
import { ChevronUp } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";
import { ActionButtons } from "./ActionButtons";

interface ArticleCardProps {
  article: NewsArticle;
  onReadMore: (article: NewsArticle) => void;
}

export function ArticleCard({ article, onReadMore }: ArticleCardProps) {
  const hasImage = !!article.imageUrl;

  return (
    <div
      className="h-[100dvh] w-full snap-start snap-always relative overflow-hidden flex flex-col cursor-pointer"
      onClick={() => onReadMore(article)}
    >
      {/* Full-bleed article image (when available) */}
      {hasImage && (
        <>
          <img
            src={article.imageUrl!}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover object-top"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {/* Dark gradient overlay for legibility */}
          <div className="absolute inset-0 z-10" style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.28) 52%, rgba(0,0,0,0.65) 72%, rgba(0,0,0,0.82) 100%)'
          }} />
        </>
      )}

      {/* Spacer — pushes card to the bottom */}
      <div className="flex-1 relative z-20" />

      {/* Glass content panel */}
      <div className={`relative z-20 px-4 pb-[76px] sm:px-6 ${hasImage ? '' : 'pb-[76px]'}`}>
        <div
          className={`rounded-2xl p-6 sm:p-8 border shadow-[0_8px_32px_rgba(25,28,27,0.10)] ${
            hasImage
              ? 'border-white/20'
              : 'glass-panel border-white/30'
          }`}
          style={hasImage ? {
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          } : undefined}
        >
          {/* Tag + Source */}
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest font-['Inter'] ${
              hasImage
                ? 'bg-white/18 border border-white/25 text-white/90'
                : 'bg-[#191c1b] text-[#e5e2e1]'
            }`}>
              {article.tag}
            </span>
            <span className={`font-medium text-xs font-['Inter'] uppercase tracking-widest ${
              hasImage ? 'text-white/55' : 'text-[#474747]/70'
            }`}>
              {article.source}
            </span>
          </div>

          {/* Headline */}
          <h2 className={`text-[clamp(28px,7vw,40px)] font-bold leading-[1.08] mb-4 font-['Manrope'] tracking-tight ${
            hasImage ? 'text-white' : 'text-[#191c1b]'
          }`}>
            {article.title}
          </h2>

          {/* Summary */}
          <p className={`text-sm sm:text-base leading-relaxed line-clamp-2 font-['Inter'] mb-5 ${
            hasImage ? 'text-white/70' : 'text-[#474747]'
          }`}>
            {article.summary}
          </p>

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 text-xs font-medium font-['Inter'] ${
              hasImage ? 'text-white/45' : 'text-[#474747]/60'
            }`}>
              <span>{format(new Date(article.publishedAt), 'MMM d')}</span>
              <span className={`w-0.5 h-0.5 rounded-full ${hasImage ? 'bg-white/40' : 'bg-[#474747]/40'}`} />
              <span>{article.readTimeMinutes} min read</span>
              <span className="flex items-center gap-1">
                <ChevronUp className="w-3 h-3" />
                Swipe
              </span>
            </div>
            <ActionButtons article={article} hasImage={hasImage} />
          </div>
        </div>
      </div>
    </div>
  );
}
