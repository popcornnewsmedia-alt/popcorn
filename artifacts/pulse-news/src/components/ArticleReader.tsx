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
          style={{ background: '#ecf3ef' }}
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

            {/* Green atmospheric content */}
            <div
              style={{
                background: '#ecf3ef',
                backgroundImage: 'radial-gradient(circle at 8% 30%, #1a443066 0%, transparent 50%), radial-gradient(circle at 88% 70%, #2c523e55 0%, transparent 50%)',
                minHeight: '100%',
              }}
            >
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

                {/* Key Points */}
                {article.keyPoints && article.keyPoints.length > 0 && (
                  <div className="mb-8">
                    <h2
                      className="font-['Manrope'] font-bold mb-4 uppercase tracking-widest"
                      style={{ fontSize: '11px', color: 'rgba(0,0,0,0.38)', letterSpacing: '0.10em' }}
                    >
                      Key Points
                    </h2>
                    <ul className="flex flex-col gap-3">
                      {article.keyPoints.map((point, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <span
                            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                            style={{ background: 'rgba(27,122,74,0.12)' }}
                          >
                            <span className="font-['Inter'] font-bold" style={{ fontSize: '10px', color: '#1b7a4a' }}>{i + 1}</span>
                          </span>
                          <p className="font-['Inter'] leading-relaxed flex-1" style={{ fontSize: '15px', color: '#191c1b' }}>{point}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Impact */}
                {article.impact && (
                  <div className="mb-8">
                    <h2
                      className="font-['Manrope'] font-bold mb-3 uppercase tracking-widest"
                      style={{ fontSize: '11px', color: 'rgba(0,0,0,0.38)', letterSpacing: '0.10em' }}
                    >
                      Impact
                    </h2>
                    <div
                      className="rounded-2xl px-5 py-4"
                      style={{ background: 'rgba(27,122,74,0.07)', border: '1px solid rgba(27,122,74,0.14)' }}
                    >
                      <p className="font-['Inter'] leading-relaxed" style={{ fontSize: '15px', color: '#191c1b' }}>{article.impact}</p>
                    </div>
                  </div>
                )}

                {/* Signal / Noise meter */}
                {article.signalScore != null && (
                  <div className="mb-8">
                    <h2
                      className="font-['Manrope'] font-bold mb-3 uppercase tracking-widest"
                      style={{ fontSize: '11px', color: 'rgba(0,0,0,0.38)', letterSpacing: '0.10em' }}
                    >
                      Signal vs Noise
                    </h2>
                    <div
                      className="rounded-2xl px-5 py-4"
                      style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)' }}
                    >
                      <div className="flex justify-between items-center mb-2.5">
                        <span className="font-['Inter'] font-semibold" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.38)' }}>Noise</span>
                        <span
                          className="font-['Manrope'] font-bold"
                          style={{ fontSize: '13px', color: article.signalScore >= 70 ? '#1b7a4a' : article.signalScore >= 45 ? '#191c1b' : 'rgba(0,0,0,0.45)' }}
                        >
                          {article.signalScore >= 70 ? 'High Signal' : article.signalScore >= 45 ? 'Mixed' : 'Low Signal'}
                        </span>
                        <span className="font-['Inter'] font-semibold" style={{ fontSize: '12px', color: 'rgba(0,0,0,0.38)' }}>Signal</span>
                      </div>
                      {/* Track */}
                      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all"
                          style={{
                            width: `${article.signalScore}%`,
                            background: article.signalScore >= 70
                              ? 'linear-gradient(to right, rgba(27,122,74,0.4), #1b7a4a)'
                              : article.signalScore >= 45
                              ? 'linear-gradient(to right, rgba(0,0,0,0.15), rgba(0,0,0,0.4))'
                              : 'linear-gradient(to right, rgba(180,40,40,0.3), rgba(180,40,40,0.6))',
                          }}
                        />
                        {/* Thumb dot */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
                          style={{
                            left: `calc(${article.signalScore}% - 6px)`,
                            background: article.signalScore >= 70 ? '#1b7a4a' : article.signalScore >= 45 ? '#191c1b' : '#b42828',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Full text */}
                <div>
                  <h2
                    className="font-['Manrope'] font-bold mb-4 uppercase tracking-widest"
                    style={{ fontSize: '11px', color: 'rgba(0,0,0,0.38)', letterSpacing: '0.10em' }}
                  >
                    Full Story
                  </h2>
                  <div className="font-['Inter'] leading-relaxed space-y-4" style={{ fontSize: '16px', color: '#191c1b' }}>
                    {article.content.split('\n\n').map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </div>

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
