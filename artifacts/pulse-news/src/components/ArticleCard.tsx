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
      {hasImage ? (
        <>
          {/* Full-bleed image */}
          <img
            src={article.imageUrl!}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover object-top"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {/* Green atmospheric tint */}
          <div
            className="absolute inset-0 z-10"
            style={{ background: 'rgba(15, 46, 30, 0.32)', mixBlendMode: 'multiply' }}
          />
          {/* Bottom gradient for legibility */}
          <div
            className="absolute inset-0 z-10"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.78) 80%, rgba(0,0,0,0.92) 100%)' }}
          />
        </>
      ) : (
        /* No-image fallback: atmospheric green background */
        <div className="absolute inset-0 ink-diffusion-bg" />
      )}

      {/* Spacer */}
      <div className="flex-1 relative z-20" />

      {/* Content — sits directly on the gradient, no box */}
      <div className="relative z-20 px-5 pb-[84px] sm:px-7">

        {/* Tag + source row */}
        <div className="flex items-center gap-3 mb-3">
          <span
            className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest font-['Inter']"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.28)',
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            {article.tag}
          </span>
          <span
            className="font-medium text-xs font-['Inter'] uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.50)' }}
          >
            {article.source}
          </span>
        </div>

        {/* Headline */}
        <h2
          className="text-[clamp(26px,7vw,42px)] font-bold leading-[1.08] mb-5 font-['Manrope'] tracking-tight text-white"
        >
          {article.title}
        </h2>

        {/* Bottom row: date + actions */}
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 text-xs font-medium font-['Inter']"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            <span>{format(new Date(article.publishedAt), 'MMM d')}</span>
            <span className="w-0.5 h-0.5 rounded-full bg-white/35" />
            <span>{article.readTimeMinutes} min read</span>
            <span className="flex items-center gap-1">
              <ChevronUp className="w-3 h-3" />
              Swipe
            </span>
          </div>
          <ActionButtons article={article} hasImage={true} />
        </div>
      </div>
    </div>
  );
}
