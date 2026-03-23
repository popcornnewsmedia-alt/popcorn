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
      {/* Full-bleed article image */}
      {hasImage && (
        <>
          <img
            src={article.imageUrl!}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover object-top"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {/* Green atmospheric tint — preserves the brand palette */}
          <div
            className="absolute inset-0 z-10"
            style={{ background: 'rgba(15, 46, 30, 0.38)', mixBlendMode: 'multiply' }}
          />
          {/* Bottom gradient for legibility */}
          <div
            className="absolute inset-0 z-10"
            style={{ background: 'linear-gradient(to bottom, rgba(10,36,22,0) 0%, rgba(10,36,22,0.10) 35%, rgba(10,36,22,0.52) 60%, rgba(10,36,22,0.82) 85%, rgba(10,36,22,0.94) 100%)' }}
          />
          {/* Soft green diffusion bloom at the very top */}
          <div
            className="absolute top-0 inset-x-0 h-40 z-10"
            style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(44,82,62,0.55) 0%, transparent 70%)' }}
          />
        </>
      )}

      {/* Spacer */}
      <div className="flex-1 relative z-20" />

      {/* Glass content panel */}
      <div className="relative z-20 px-4 pb-[76px] sm:px-6">
        <div
          className="rounded-2xl p-6 sm:p-8 border shadow-[0_8px_48px_rgba(10,36,22,0.28)]"
          style={hasImage ? {
            background: 'rgba(12, 44, 28, 0.52)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderColor: 'rgba(86, 160, 112, 0.22)',
          } : {
            background: 'rgba(236, 243, 239, 0.62)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderColor: 'rgba(255,255,255,0.50)',
          }}
        >
          {/* Tag + Source */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest font-['Inter']"
              style={hasImage ? {
                background: 'rgba(86, 185, 130, 0.18)',
                border: '1px solid rgba(86, 185, 130, 0.40)',
                color: '#86efac',
              } : {
                background: '#1a4430',
                color: '#86efac',
              }}
            >
              {article.tag}
            </span>
            <span
              className="font-medium text-xs font-['Inter'] uppercase tracking-widest"
              style={{ color: hasImage ? 'rgba(180,220,198,0.65)' : 'rgba(71,71,71,0.65)' }}
            >
              {article.source}
            </span>
          </div>

          {/* Headline */}
          <h2
            className="text-[clamp(28px,7vw,40px)] font-bold leading-[1.08] mb-4 font-['Manrope'] tracking-tight"
            style={{ color: hasImage ? '#e8f5ee' : '#191c1b' }}
          >
            {article.title}
          </h2>

          {/* Summary */}
          <p
            className="text-sm sm:text-base leading-relaxed line-clamp-2 font-['Inter'] mb-5"
            style={{ color: hasImage ? 'rgba(196,228,210,0.75)' : '#474747' }}
          >
            {article.summary}
          </p>

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 text-xs font-medium font-['Inter']"
              style={{ color: hasImage ? 'rgba(160,210,180,0.50)' : 'rgba(71,71,71,0.55)' }}
            >
              <span>{format(new Date(article.publishedAt), 'MMM d')}</span>
              <span className="w-0.5 h-0.5 rounded-full" style={{ background: hasImage ? 'rgba(160,210,180,0.40)' : 'rgba(71,71,71,0.35)' }} />
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
