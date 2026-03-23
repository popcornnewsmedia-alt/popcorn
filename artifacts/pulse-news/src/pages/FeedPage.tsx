import { useState, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleReader } from "@/components/ArticleReader";
import { useInfiniteNewsFeed } from "@/hooks/use-news";
import { useIntersection } from "@/hooks/use-intersection";
import { Loader2, AlertCircle, RefreshCw, Bookmark, User } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";

type Tab = "feed" | "saved" | "profile";

const FALLBACK_ARTICLE: NewsArticle = {
  id: 9999,
  title: "OpenAI Unveils Breakthrough in Reasoning Models",
  summary: "The latest architecture demonstrates unprecedented capabilities in multi-step logical deduction.",
  content: "",
  category: "Models",
  source: "TechCrunch",
  readTimeMinutes: 5,
  publishedAt: new Date().toISOString(),
  likes: 12453,
  isBookmarked: false,
  gradientStart: "#1a2e2a",
  gradientEnd: "#050a08",
  tag: "BREAKING",
};

export function FeedPage() {
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [readingArticle, setReadingArticle] = useState<NewsArticle | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, refetch } =
    useInfiniteNewsFeed(undefined);

  const { ref: loadMoreRef, isIntersecting } = useIntersection();

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    document.body.style.overflow = readingArticle ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [readingArticle]);

  /* ── Loading ─────────────────────────────────────────── */
  if (status === "pending") {
    return (
      <div className="h-screen w-full bg-background flex flex-col items-center justify-center gap-6">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-primary/60 font-display text-xl font-medium tracking-widest uppercase animate-pulse">
          Curating your feed...
        </p>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────── */
  if (status === "error") {
    return (
      <div className="h-[100dvh] w-full relative overflow-hidden flex flex-col">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mb-8 border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-4">Connection Lost</h2>
          <p className="text-muted-foreground text-lg max-w-md mb-8">
            We couldn't connect to the Pulse network. Please check your connection and try again.
          </p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const articles = data?.pages.flatMap((page) => page.articles) || [];

  /* ── Placeholder screens ─────────────────────────────── */
  const renderTab = () => {
    if (activeTab === "saved") {
      return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-4 text-center px-8">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-2" style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.18)' }}>
            <Bookmark className="w-7 h-7" style={{ color: '#0f2a1a' }} />
          </div>
          <h2 className="text-2xl font-display font-bold text-[#191c1b]">Nothing saved yet</h2>
          <p className="text-[#474747]/60 font-['Inter']">Bookmark articles from your feed to read them later.</p>
        </div>
      );
    }
    if (activeTab === "profile") {
      return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-4 text-center px-8">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-2" style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.18)' }}>
            <User className="w-7 h-7" style={{ color: '#0f2a1a' }} />
          </div>
          <h2 className="text-2xl font-display font-bold text-[#191c1b]">Your Profile</h2>
          <p className="text-[#474747]/60 font-['Inter']">Sign in to personalise your feed and sync your activity.</p>
        </div>
      );
    }

    /* ── Feed tab ──────────────────────────────────────── */
    return (
      <div
        className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory scrollbar-hide overscroll-y-none"
        style={{ scrollPaddingBottom: "64px" }}
      >
        {articles.length === 0 ? (
          <div className="h-[100dvh] w-full flex flex-col items-center justify-center snap-start snap-always text-center px-6">
            <h2 className="text-3xl font-display font-bold text-foreground mb-4">You're all caught up.</h2>
            <p className="text-muted-foreground text-lg">No more stories right now.</p>
          </div>
        ) : (
          articles.map((article) => (
            <ArticleCard key={article.id} article={article} onReadMore={setReadingArticle} />
          ))
        )}

        {hasNextPage && (
          <div ref={loadMoreRef} className="h-[20vh] w-full flex items-center justify-center snap-start">
            <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[100dvh] w-full relative">
      {/* Green atmospheric background for non-feed tabs */}
      {activeTab !== "feed" && <div className="absolute inset-0 ink-diffusion-bg" style={{ background: '#ecf3ef' }} />}

      {renderTab()}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      <ArticleReader article={readingArticle} onClose={() => setReadingArticle(null)} />
    </div>
  );
}
