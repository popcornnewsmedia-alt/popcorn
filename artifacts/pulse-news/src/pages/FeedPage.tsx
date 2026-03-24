import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { isSameDay, startOfDay } from "date-fns";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleReader } from "@/components/ArticleReader";
import { SplashScreen } from "@/components/SplashScreen";
import { SignUpFlow } from "@/components/SignUpFlow";
import { DateDividerCard } from "@/components/DateDividerCard";
import { useInfiniteNewsFeed } from "@/hooks/use-news";
import { useIntersection } from "@/hooks/use-intersection";
import { Loader2, AlertCircle, RefreshCw, Bookmark, User } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";

type Tab = "feed" | "saved" | "profile";

function dividerIdForDate(d: Date) {
  return `day-divider-${startOfDay(d).getTime()}`;
}

function GreenAtmosphere() {
  return (
    <div className="absolute inset-0 -z-0" style={{ background: "#ecf3ef" }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 15% 20%, rgba(26,68,48,0.32) 0%, transparent 48%),
            radial-gradient(circle at 82% 75%, rgba(44,82,62,0.26) 0%, transparent 48%),
            radial-gradient(circle at 50% 50%, rgba(26,68,48,0.10) 0%, transparent 65%)
          `,
          filter: "blur(48px)",
        }}
      />
    </div>
  );
}

function SavedScreen({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center px-8 text-center overflow-hidden">
      <GreenAtmosphere />
      <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-2"
          style={{
            background: "rgba(255,255,255,0.45)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(26,68,48,0.16)",
          }}
        >
          <Bookmark className="w-9 h-9" style={{ color: "#0f2a1a", strokeWidth: 1.6 }} />
        </div>
        <div className="flex flex-col gap-2">
          <h1
            className="font-['Manrope'] font-bold tracking-tight"
            style={{ fontSize: "28px", lineHeight: 1.1, color: "#000" }}
          >
            Nothing saved yet
          </h1>
          <p
            className="font-['Manrope'] italic leading-relaxed"
            style={{ fontSize: "16px", color: "rgba(0,0,0,0.45)" }}
          >
            Bookmark articles as you scroll to build your reading list.
          </p>
        </div>
        <button
          onClick={onBrowse}
          className="mt-3 px-8 py-3 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
          style={{ background: "#000000", color: "#ffffff" }}
        >
          Browse
        </button>
      </div>
    </div>
  );
}

function ProfileScreen({ onSignIn, userName }: { onSignIn: () => void; userName: string | null }) {
  return (
    <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center px-8 text-center overflow-hidden">
      <GreenAtmosphere />
      <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-2"
          style={{
            background: userName ? "#000" : "rgba(255,255,255,0.45)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(26,68,48,0.16)",
          }}
        >
          {userName ? (
            <span className="font-['Manrope'] font-bold text-white" style={{ fontSize: "28px" }}>
              {userName[0].toUpperCase()}
            </span>
          ) : (
            <User className="w-9 h-9" style={{ color: "#0f2a1a", strokeWidth: 1.6 }} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h1
            className="font-['Manrope'] font-bold tracking-tight"
            style={{ fontSize: "28px", lineHeight: 1.1, color: "#000" }}
          >
            {userName ? `Hi, ${userName}.` : "Your Profile"}
          </h1>
          <p
            className="font-['Manrope'] italic leading-relaxed"
            style={{ fontSize: "16px", color: "rgba(0,0,0,0.45)" }}
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
            style={{ background: "#000000", color: "#ffffff" }}
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
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const allArticles = data?.pages.flatMap((page) => page.articles) ?? [];

  type FeedItem =
    | { kind: "article"; article: NewsArticle }
    | { kind: "divider"; date: Date; id: string };

  const feedItems = useMemo<FeedItem[]>(() => {
    if (allArticles.length === 0) return [];
    const items: FeedItem[] = [];
    let lastDayKey: string | null = null;
    for (const article of allArticles) {
      const dayKey = startOfDay(new Date(article.publishedAt)).toISOString();
      if (lastDayKey !== null && lastDayKey !== dayKey) {
        const divDate = startOfDay(new Date(article.publishedAt));
        items.push({ kind: "divider", date: divDate, id: dividerIdForDate(divDate) });
      }
      lastDayKey = dayKey;
      items.push({ kind: "article", article });
    }
    return items;
  }, [allArticles]);

  const handleItemEnter = useCallback((date: Date) => {
    setSelectedDate(startOfDay(date));
  }, []);

  const handleArticleEnter = useCallback((publishedAt: string) => {
    handleItemEnter(new Date(publishedAt));
  }, [handleItemEnter]);

  const handleDatePick = useCallback((date: Date) => {
    if (isSameDay(date, startOfDay(new Date()))) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const id = dividerIdForDate(date);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      const firstMatch = allArticles.find(a => isSameDay(new Date(a.publishedAt), date));
      if (firstMatch) {
        const articleEl = document.getElementById(`article-${firstMatch.id}`);
        articleEl?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [allArticles]);

  if (status === "pending") {
    return (
      <div className="relative h-screen w-full flex flex-col items-center justify-center gap-5 overflow-hidden">
        <GreenAtmosphere />
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#000000" }} />
        <p
          className="font-['Inter'] font-semibold uppercase tracking-widest animate-pulse"
          style={{ fontSize: "11px", color: "rgba(0,0,0,0.40)" }}
        >
          Curating your feed
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center p-8 text-center overflow-hidden">
        <GreenAtmosphere />
        <AlertCircle className="w-10 h-10 text-red-500 mb-6" />
        <h2 className="font-['Manrope'] font-bold text-2xl text-[#0f2a1a] mb-3">Connection lost</h2>
        <p className="font-['Inter'] text-[#1a4430]/55 mb-8 max-w-xs">
          We couldn't reach the Pulse network. Check your connection and try again.
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-['Inter'] font-semibold text-sm"
          style={{ background: "#0f2a1a", color: "#ecf3ef" }}
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  const renderTab = () => {
    if (activeTab === "saved") return <SavedScreen onBrowse={() => setActiveTab("feed")} />;
    if (activeTab === "profile") return <ProfileScreen onSignIn={() => setSignUpOpen(true)} userName={userName} />;

    return (
      <div
        ref={scrollContainerRef}
        className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory scrollbar-hide overscroll-y-none"
        style={{ scrollPaddingBottom: "64px" }}
      >
        {feedItems.length === 0 ? (
          <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center snap-start snap-always text-center px-6 overflow-hidden">
            <GreenAtmosphere />
            <h2 className="font-['Manrope'] font-bold text-2xl mb-2" style={{ color: "#000" }}>
              You're all caught up
            </h2>
            <p className="font-['Manrope'] italic" style={{ color: "rgba(0,0,0,0.45)" }}>
              No more stories right now — check back soon.
            </p>
          </div>
        ) : (
          feedItems.map((item) =>
            item.kind === "divider" ? (
              <DateDividerCard
                key={item.id}
                date={item.date}
                dateId={item.id}
                onEnter={handleItemEnter}
              />
            ) : (
              <ArticleCard
                key={item.article.id}
                article={item.article}
                onReadMore={setReadingArticle}
                onEnter={handleArticleEnter}
              />
            )
          )
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
      <TopBar selectedDate={selectedDate} onDateChange={handleDatePick} />
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
