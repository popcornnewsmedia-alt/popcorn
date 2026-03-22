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
      {/* Background Gradient */}
      <div 
        className="absolute inset-0 z-0 transition-colors duration-700" 
        style={{ 
          background: `linear-gradient(160deg, ${article.gradientStart} 0%, ${article.gradientEnd} 100%)` 
        }} 
      />
      
      {/* Texture Overlay (Optional subtle noise) */}
      <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />

      {/* Dark fade at bottom for text readability */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-20 flex-1 flex flex-col justify-end p-6 pb-24 sm:pb-32 sm:px-12 md:px-20 max-w-5xl mx-auto w-full">
        
        {/* Meta & Tag */}
        <div className="flex items-center gap-3 mb-6">
          <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-md text-xs font-mono font-bold uppercase tracking-widest text-white border border-white/10 shadow-lg">
            {article.tag}
          </span>
          <span className="text-white/60 font-semibold text-sm drop-shadow-md">
            {article.source}
          </span>
        </div>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold leading-[1.1] text-white text-shadow-md mb-4">
          {article.title}
        </h2>

        {/* Summary */}
        <p className="text-lg sm:text-xl text-white/80 leading-relaxed line-clamp-3 font-medium text-shadow-sm max-w-3xl">
          {article.summary}
        </p>

        {/* Bottom Bar: Info + Actions */}
        <div className="mt-8 flex flex-row items-end justify-between">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 text-sm font-semibold text-white/60 drop-shadow-md">
              <span>{format(new Date(article.publishedAt), 'MMM d')}</span>
              <span className="w-1 h-1 rounded-full bg-white/40" />
              <span>{article.readTimeMinutes} min read</span>
            </div>
            
            <div className="flex items-center gap-2 text-white/50 text-sm font-medium animate-pulse">
              <ChevronUp className="w-4 h-4" />
              <span>Tap to read</span>
            </div>
          </div>

          {/* Action Buttons (Like, Bookmark, Share) */}
          <ActionButtons article={article} />
        </div>
      </div>
    </div>
  );
}
