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

                {/* Body content */}
                <div className="prose prose-lg max-w-none text-[#191c1b]">
                  {article.content ? (
                    <div dangerouslySetInnerHTML={{ __html: article.content }} />
                  ) : (
                    <>
                      <p>The artificial intelligence landscape continues to evolve at a breakneck pace. In recent developments, industry leaders have unveiled new architectures that dramatically reduce compute requirements while maintaining, and in some cases exceeding, state-of-the-art performance.</p>
                      <h2>The Shift Toward Efficiency</h2>
                      <p>Historically, the prevailing wisdom in model scaling was straightforward: more parameters and more data reliably led to better performance. However, as computational costs soar and physical constraints on data centers become apparent, researchers are finding innovative ways to achieve intelligence.</p>
                      <blockquote>"We are moving from the era of brute-force scaling to an era of algorithmic elegance. The next major breakthroughs will come from how we structure networks, not just how large we can build them."</blockquote>
                    </>
                  )}
                </div>

                <div className="mt-16 pt-8 border-t border-[#c6c6c6]/30 flex items-center justify-center gap-3">
                  {/* Mark as Read */}
                  <button
                    onClick={() => { onMarkRead?.(); onClose(); }}
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-['Inter'] font-semibold text-sm transition-all"
                    style={{
                      background: isRead ? '#1b7a4a' : '#191c1b',
                      color: '#fff',
                    }}
                  >
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                    {isRead ? 'Marked as Read' : 'Mark as Read'}
                  </button>

                  {/* Save for Later */}
                  <button
                    onClick={() => article && bookmarkMutation(article.id)}
                    className="flex items-center gap-2 px-6 py-3 rounded-full font-['Inter'] font-semibold text-sm transition-all"
                    style={{
                      background: article?.isBookmarked ? 'rgba(0,0,0,0.08)' : 'transparent',
                      border: '1.5px solid rgba(0,0,0,0.18)',
                      color: article?.isBookmarked ? '#1b7a4a' : '#191c1b',
                    }}
                  >
                    <Bookmark
                      className="w-4 h-4"
                      style={{ fill: article?.isBookmarked ? '#1b7a4a' : 'none', color: article?.isBookmarked ? '#1b7a4a' : '#191c1b' }}
                    />
                    {article?.isBookmarked ? 'Saved' : 'Save for Later'}
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
