import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Calendar, Check, Bookmark } from "lucide-react";
import { format } from "date-fns";
import type { NewsArticle } from "@workspace/api-client-react";
import { useBookmarkArticle } from "@/hooks/use-news";

interface ArticleReaderProps {
  article: NewsArticle | null;
  onClose: () => void;
  isRead?: boolean;
  onMarkRead?: () => void;
}

export function ArticleReader({ article, onClose, isRead = false, onMarkRead }: ArticleReaderProps) {
  const { mutate: bookmarkMutation } = useBookmarkArticle();

  return (
    <AnimatePresence>
      {article && (
        <motion.div
          initial={{ y: "100%", opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0.5 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.y > 100 || info.velocity.y > 500) onClose();
          }}
          className="fixed inset-0 z-50 flex flex-col"
          style={{
            background: '#f3f6f4',
          }}
        >
          {/* Floating header — overlaid on the image */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3">
            <span
              className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest font-['Inter']"
              style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(12px)', color: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.16)' }}
            >
              {article.tag}
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(12px)', color: 'white', border: '1px solid rgba(255,255,255,0.16)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">

            {/* Hero image */}
            {article.imageUrl && (
              <div className="relative h-72 sm:h-80 flex-shrink-0">
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  className="w-full h-full object-cover object-top"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0) 40%, rgba(236,243,239,0) 70%, rgba(236,243,239,1) 100%)' }}
                />
              </div>
            )}

            {/* Content area — transparent so outer atmospheric blobs show through */}
            <div style={{ minHeight: '100%' }}>
              <div className="max-w-2xl mx-auto px-6 py-8 sm:px-10 pb-16">

                {/* Source + metadata */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium mb-6 font-['Inter']" style={{ color: 'rgba(71,71,71,0.60)' }}>
                  <span className="font-bold text-sm" style={{ color: '#191c1b' }}>{article.source}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(article.publishedAt), 'MMMM d, yyyy')}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {article.readTimeMinutes} min read
                  </span>
                </div>

                {/* Headline */}
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold leading-[1.08] text-[#191c1b] mb-5 tracking-tight">
                  {article.title}
                </h1>

                {/* Summary lede */}
                <p className="text-lg sm:text-xl text-[#474747] leading-relaxed mb-10 font-display italic border-b border-[#191c1b]/10 pb-8">
                  {article.summary}
                </p>

                {/* Importance meter */}
                {article.signalScore != null && (
                  <div className="mb-8">
                    <h2
                      className="font-['Manrope'] font-bold mb-3 uppercase tracking-widest"
                      style={{ fontSize: '13px', color: '#191c1b', letterSpacing: '0.10em', textDecoration: 'underline', textUnderlineOffset: '4px' }}
                    >
                      Importance
                    </h2>
                    <div
                      className="rounded-2xl px-5 py-4"
                      style={{ background: 'rgba(27,122,74,0.06)', border: '1px solid #191c1b' }}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-['Inter'] font-medium" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.38)' }}>Noise</span>
                        <span
                          className="font-['Manrope'] font-bold px-3 py-0.5 rounded-full"
                          style={{
                            fontSize: '12px',
                            background: article.signalScore >= 70 ? 'rgba(27,122,74,0.12)' : article.signalScore >= 45 ? 'rgba(0,0,0,0.06)' : 'rgba(180,40,40,0.08)',
                            color: article.signalScore >= 70 ? '#1b7a4a' : article.signalScore >= 45 ? '#191c1b' : '#b42828',
                          }}
                        >
                          {article.signalScore >= 70 ? 'High Signal' : article.signalScore >= 45 ? 'Mixed' : 'Low Signal'}
                        </span>
                        <span className="font-['Inter'] font-medium" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.38)' }}>Signal</span>
                      </div>
                      <div className="relative rounded-full" style={{ height: 8, background: 'rgba(27,122,74,0.10)' }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${article.signalScore}%`,
                            background: article.signalScore >= 70
                              ? 'linear-gradient(to right, #a8d5be, #1b7a4a)'
                              : article.signalScore >= 45
                              ? 'linear-gradient(to right, #c8ddd2, #5a8a6a)'
                              : 'linear-gradient(to right, rgba(180,40,40,0.25), rgba(180,40,40,0.55))',
                          }}
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                          style={{
                            width: 14, height: 14,
                            left: `calc(${article.signalScore}% - 7px)`,
                            background: article.signalScore >= 70 ? '#1b7a4a' : article.signalScore >= 45 ? '#5a8a6a' : '#b42828',
                            boxShadow: '0 1px 6px rgba(27,122,74,0.35)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Key Points */}
                {article.keyPoints && article.keyPoints.length > 0 && (
                  <div className="mb-8">
                    <h2
                      className="font-['Manrope'] font-bold mb-4 uppercase tracking-widest"
                      style={{ fontSize: '13px', color: '#191c1b', letterSpacing: '0.10em', textDecoration: 'underline', textUnderlineOffset: '4px' }}
                    >
                      Key Points
                    </h2>
                    <ul className="flex flex-col gap-3">
                      {article.keyPoints.map((point, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <span
                            className="flex-shrink-0 mt-[7px]"
                            style={{ width: 6, height: 6, borderRadius: '50%', background: '#191c1b', flexShrink: 0 }}
                          />
                          <p className="font-['Inter'] leading-relaxed flex-1" style={{ fontSize: '15px', color: '#191c1b' }}>{point}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Story */}
                <div className="mb-8">
                  <h2
                    className="font-['Manrope'] font-bold mb-4 uppercase tracking-widest"
                    style={{ fontSize: '13px', color: '#191c1b', letterSpacing: '0.10em', textDecoration: 'underline', textUnderlineOffset: '4px' }}
                  >
                    Story
                  </h2>
                  <div className="font-['Inter'] leading-relaxed space-y-4" style={{ fontSize: '16px', color: '#191c1b' }}>
                    {article.content.split('\n\n').map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </div>

                {/* Impact */}
                {article.impact && (
                  <div className="mb-8">
                    <h2
                      className="font-['Manrope'] font-bold mb-4 uppercase tracking-widest"
                      style={{ fontSize: '13px', color: '#191c1b', letterSpacing: '0.10em', textDecoration: 'underline', textUnderlineOffset: '4px' }}
                    >
                      Impact
                    </h2>
                    <div
                      className="pl-4"
                      style={{ borderLeft: '3px solid #1b7a4a' }}
                    >
                      <p className="font-['Inter'] leading-relaxed" style={{ fontSize: '15px', color: '#191c1b' }}>{article.impact}</p>
                    </div>
                  </div>
                )}

                <div className="mt-16 pt-8 border-t border-[#c6c6c6]/30 flex items-center justify-center gap-3">
                  {/* Mark as Read / Unmark */}
                  <button
                    onClick={() => { onMarkRead?.(); onClose(); }}
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-['Inter'] font-semibold text-sm transition-all"
                    style={{
                      background: isRead ? '#1b7a4a' : '#191c1b',
                      color: '#fff',
                    }}
                  >
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                    {isRead ? 'Unmark as Read' : 'Mark as Read'}
                  </button>

                  {/* Save / Unsave — icon only */}
                  <button
                    onClick={() => article && bookmarkMutation(article.id)}
                    className="flex items-center justify-center w-11 h-11 rounded-full transition-all"
                    style={{
                      background: article?.isBookmarked ? '#191c1b' : 'transparent',
                      border: '1.5px solid rgba(0,0,0,0.15)',
                    }}
                  >
                    <Bookmark
                      style={{
                        width: 18, height: 18,
                        fill: article?.isBookmarked ? 'white' : 'none',
                        color: article?.isBookmarked ? 'white' : 'rgba(0,0,0,0.55)',
                      }}
                    />
                  </button>
                </div>

              </div>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
