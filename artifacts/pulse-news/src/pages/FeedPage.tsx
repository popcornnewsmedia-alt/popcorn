import { useState, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleReader } from "@/components/ArticleReader";
import { SplashScreen } from "@/components/SplashScreen";
import { SignUpFlow } from "@/components/SignUpFlow";
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

/* Shared atmospheric background for non-feed screens */
function GreenAtmosphere() {
  return (
    <div
      className="absolute inset-0 -z-0"
      style={{ background: '#ecf3ef' }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 15% 20%, rgba(26,68,48,0.32) 0%, transparent 48%),
            radial-gradient(circle at 82% 75%, rgba(44,82,62,0.26) 0%, transparent 48%),
            radial-gradient(circle at 50% 50%, rgba(26,68,48,0.10) 0%, transparent 65%)
          `,
          filter: 'blur(48px)',
        }}
      />
    </div>
  );
}

/* Saved empty state */
function SavedScreen({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center px-8 text-center overflow-hidden">
      <GreenAtmosphere />
      <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs">
        {/* Glass orb */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-2"
          style={{
            background: 'rgba(255,255,255,0.45)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(26,68,48,0.16)',
          }}
        >
          <Bookmark className="w-9 h-9" style={{ color: '#0f2a1a', strokeWidth: 1.6 }} />
        </div>

        <div className="flex flex-col gap-2">
          <h1
            className="font-['Manrope'] font-bold tracking-tight"
            style={{ fontSize: '28px', lineHeight: 1.1, color: '#000' }}
          >
            Nothing saved yet
          </h1>
          <p
            className="font-['Manrope'] italic leading-relaxed"
            style={{ fontSize: '16px', color: 'rgba(0,0,0,0.45)' }}
          >
            Bookmark articles as you scroll to build your reading list.
          </p>
        </div>

        <button
          onClick={onBrowse}
          className="mt-3 px-8 py-3 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
          style={{ background: '#000000', color: '#ffffff' }}
        >
          Browse
        </button>
      </div>
    </div>
  );
}

/* Profile empty state */
function ProfileScreen({ onSignIn, userName }: { onSignIn: () => void; userName: string | null }) {
  return (
    <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center px-8 text-center overflow-hidden">
      <GreenAtmosphere />
      <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs">
        {/* Glass orb */}
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-2"
          style={{
            background: userName ? '#000' : 'rgba(255,255,255,0.45)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(26,68,48,0.16)',
          }}
        >
          {userName ? (
            <span className="font-['Manrope'] font-bold text-white" style={{ fontSize: '28px' }}>
              {userName[0].toUpperCase()}
            </span>
          ) : (
            <User className="w-9 h-9" style={{ color: '#0f2a1a', strokeWidth: 1.6 }} />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h1
            className="font-['Manrope'] font-bold tracking-tight"
            style={{ fontSize: '28px', lineHeight: 1.1, color: '#000' }}
          >
            {userName ? `Hi, ${userName}.` : "Your Profile"}
          </h1>
          <p
            className="font-['Manrope'] italic leading-relaxed"
            style={{ fontSize: '16px', color: 'rgba(0,0,0,0.45)' }}
          >
            {userName
              ? "Your feed is personalised and your reading history is syncing."
              : "Sign in to personalise your feed and keep your reading history in sync."}
          </p>
        </div>

        {!userName && (
          <button
            onClick={onSignIn}
            className="mt-3 px-8 py-3 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
            style={{ background: '#000000', color: '#ffffff' }}
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}

export function FeedPage() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [readingArticle, setReadingArticle] = useState<NewsArticle | null>(null);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

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

  /* Loading */
  if (status === "pending") {
    return (
      <div className="relative h-screen w-full flex flex-col items-center justify-center gap-5 overflow-hidden">
        <GreenAtmosphere />
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#000000' }} />
        <p
          className="font-['Inter'] font-semibold uppercase tracking-widest animate-pulse"
          style={{ fontSize: '11px', color: 'rgba(0,0,0,0.40)' }}
        >
          Curating your feed
        </p>
      </div>
    );
  }

  /* Error */
  if (status === "error") {
    return (
      <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center p-8 text-center overflow-hidden">
        <GreenAtmosphere />
        <AlertCircle className="w-10 h-10 text-red-500 mb-6" />
        <h2 className="font-['Manrope'] font-bold text-2xl text-[#0f2a1a] mb-3">Connection lost</h2>
        <p className="font-['Inter'] text-[#1a4430]/55 mb-8 max-w-xs">We couldn't reach the Pulse network. Check your connection and try again.</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-['Inter'] font-semibold text-sm"
          style={{ background: '#0f2a1a', color: '#ecf3ef' }}
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  const articles = data?.pages.flatMap((page) => page.articles) || [];

  const renderTab = () => {
    if (activeTab === "saved") return <SavedScreen onBrowse={() => setActiveTab("feed")} />;
    if (activeTab === "profile") return <ProfileScreen onSignIn={() => setSignUpOpen(true)} userName={userName} />;

    return (
      <div
        className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory scrollbar-hide overscroll-y-none"
        style={{ scrollPaddingBottom: "64px" }}
      >
        {articles.length === 0 ? (
          <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center snap-start snap-always text-center px-6 overflow-hidden">
            <GreenAtmosphere />
            <h2 className="font-['Manrope'] font-bold text-2xl text-[#0f2a1a] mb-2">You're all caught up</h2>
            <p className="font-['Manrope'] italic text-[#1a4430]/55">No more stories right now — check back soon.</p>
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
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <TopBar />
      {renderTab()}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      <ArticleReader article={readingArticle} onClose={() => setReadingArticle(null)} />
      <SignUpFlow
        isOpen={signUpOpen}
        onClose={() => setSignUpOpen(false)}
        onComplete={(name) => { setUserName(name); setSignUpOpen(false); }}
      />
    </div>
  );
}
