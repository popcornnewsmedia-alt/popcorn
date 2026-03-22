import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";
import type { NewsArticle } from "@workspace/api-client-react";

interface ArticleReaderProps {
  article: NewsArticle | null;
  onClose: () => void;
}

export function ArticleReader({ article, onClose }: ArticleReaderProps) {
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
          onDragEnd={(e, info) => {
            if (info.offset.y > 100 || info.velocity.y > 500) {
              onClose();
            }
          }}
          className="fixed inset-0 z-50 flex flex-col bg-background"
          style={{
            backgroundImage: `linear-gradient(to bottom, ${article.gradientStart}22, ${article.gradientEnd}11)`
          }}
        >
          {/* Header Bar */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 bg-background/80 backdrop-blur-xl border-b border-white/5 pt-safe">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-widest text-primary/60">
                {article.tag}
              </span>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-foreground transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="max-w-3xl mx-auto px-6 py-10 sm:px-12 sm:py-16">
              
              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground mb-8">
                <span className="text-primary">{article.source}</span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(article.publishedAt), 'MMMM d, yyyy')}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {article.readTimeMinutes} min read
                </span>
              </div>

              {/* Title & Summary */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold leading-[1.1] text-foreground mb-6">
                {article.title}
              </h1>
              <p className="text-xl sm:text-2xl text-foreground/70 leading-relaxed mb-12 font-display italic">
                {article.summary}
              </p>

              {/* Fake Content for Demo purposes if content is missing, otherwise render real content */}
              <div className="prose prose-invert prose-lg max-w-none">
                {article.content ? (
                  <div dangerouslySetSection={{ __html: article.content }} />
                ) : (
                  <>
                    <p>
                      The artificial intelligence landscape continues to evolve at a breakneck pace. 
                      In recent developments, industry leaders have unveiled new architectures that 
                      dramatically reduce compute requirements while maintaining, and in some cases 
                      exceeding, state-of-the-art performance.
                    </p>
                    <h2>The Shift Toward Efficiency</h2>
                    <p>
                      Historically, the prevailing wisdom in model scaling was straightforward: more 
                      parameters and more data reliably led to better performance. However, as 
                      computational costs soar and physical constraints on data centers become 
                      apparent, researchers are finding innovative ways to achieve intelligence.
                    </p>
                    <blockquote>
                      "We are moving from the era of brute-force scaling to an era of algorithmic 
                      elegance. The next major breakthroughs will come from how we structure networks, 
                      not just how large we can build them."
                    </blockquote>
                    <p>
                      Early benchmarks suggest these new methods could reduce training costs by up 
                      to 40%, potentially democratizing access to high-tier AI capabilities. Startups 
                      and independent researchers may soon be able to deploy models that previously 
                      required massive corporate backing.
                    </p>
                    <h3>Regulatory Implications</h3>
                    <p>
                      As these highly capable, lightweight models approach deployment, policymakers 
                      are accelerating their efforts to establish coherent frameworks for AI safety. 
                      The focus is shifting from simply monitoring massive data centers to establishing 
                      robust evaluation criteria for models that could potentially run on edge devices.
                    </p>
                  </>
                )}
              </div>
              
              <div className="mt-16 pt-8 border-t border-white/10 flex justify-center">
                <button 
                  onClick={onClose}
                  className="px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors font-semibold text-white"
                >
                  Finished Reading
                </button>
              </div>

            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
