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
      {/* Top-left dark blob */}
      <div className="blob-a absolute rounded-full" style={{
        width: '420px', height: '420px',
        top: '-80px', left: '-100px',
        background: 'radial-gradient(circle, rgba(26,68,48,0.55) 0%, transparent 70%)',
        filter: 'blur(56px)',
      }} />
      {/* Bottom-right dark blob */}
      <div className="blob-b absolute rounded-full" style={{
        width: '380px', height: '380px',
        bottom: '-60px', right: '-80px',
        background: 'radial-gradient(circle, rgba(44,82,62,0.48) 0%, transparent 70%)',
        filter: 'blur(52px)',
      }} />
      {/* Mid accent blob */}
      <div className="absolute rounded-full" style={{
        width: '280px', height: '280px',
        top: '40%', left: '55%',
        background: 'radial-gradient(circle, rgba(82,183,136,0.30) 0%, transparent 70%)',
        filter: 'blur(48px)',
      }} />
    </div>
  );
}

function SavedScreen({
  onBrowse,
  articles,
  onReadMore,
}: {
  onBrowse: () => void;
  articles: NewsArticle[];
  onReadMore: (article: NewsArticle) => void;
}) {
  if (articles.length === 0) {
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

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex flex-col" style={{ background: "#ecf3ef" }}>
      <GreenAtmosphere />
      <div className="relative z-10 flex flex-col h-full">
        <div className="px-5 pt-[72px] pb-3">
          <h2
            className="font-['Manrope'] font-bold"
            style={{ fontSize: "22px", color: "#000" }}
          >
            Saved
          </h2>
          <p className="font-['Inter'] mt-0.5" style={{ fontSize: "13px", color: "rgba(0,0,0,0.4)" }}>
            {articles.length} {articles.length === 1 ? "article" : "articles"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-24 scrollbar-hide flex flex-col gap-3">
          {articles.map((article) => (
            <button
              key={article.id}
              onClick={() => onReadMore(article)}
              className="w-full text-left rounded-2xl overflow-hidden flex gap-0 transition-opacity active:opacity-75"
              style={{
                background: "rgba(255,255,255,0.55)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
              }}
            >
              {article.imageUrl && (
                <div className="w-24 h-24 flex-shrink-0">
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                <div className="flex flex-col gap-1">
                  <span
                    className="font-['Inter'] font-semibold uppercase tracking-widest"
                    style={{ fontSize: "9px", color: "rgba(0,0,0,0.38)" }}
                  >
                    {article.tag}
                  </span>
                  <p
                    className="font-['Manrope'] font-bold leading-snug line-clamp-2"
                    style={{ fontSize: "14px", color: "#000" }}
                  >
                    {article.title}
                  </p>
                </div>
                <p
                  className="font-['Inter'] mt-1"
                  style={{ fontSize: "11px", color: "rgba(0,0,0,0.38)" }}
                >
                  {article.source} · {article.readTimeMinutes} min
                </p>
              </div>
            </button>
          ))}
        </div>
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
  const [readIds, setReadIds] = useState<Set<number>>(new Set());

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
  const savedArticles = allArticles.filter((a) => a.isBookmarked);
  const liveReadingArticle = readingArticle
    ? (allArticles.find((a) => a.id === readingArticle.id) ?? readingArticle)
    : null;

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

  const [dayProgress, setDayProgress] = useState(0);

  // Keep a stable ref to allArticles so callbacks don't need to change reference
  const allArticlesRef = useRef(allArticles);
  useEffect(() => { allArticlesRef.current = allArticles; }, [allArticles]);

  const handleItemEnter = useCallback((date: Date) => {
    setSelectedDate(startOfDay(date));
    setDayProgress(0); // reset bar when a day-divider scrolls in
  }, []);

  const handleArticleEnter = useCallback((publishedAt: string) => {
    const articleDate = new Date(publishedAt);
    setSelectedDate(startOfDay(articleDate));
    // calculate position within this day using the ref (stable callback)
    const currentDay = startOfDay(articleDate);
    const articles = allArticlesRef.current;
    const dayArticles = articles.filter(a =>
      isSameDay(startOfDay(new Date(a.publishedAt)), currentDay)
    );
    const idx = dayArticles.findIndex(a => a.publishedAt === publishedAt);
    if (dayArticles.length > 0 && idx >= 0) {
      setDayProgress((idx + 1) / dayArticles.length);
    }
  }, []); // stable — reads allArticles via ref

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

  const renderOverlayTab = () => {
    if (activeTab === "saved") return <SavedScreen onBrowse={() => setActiveTab("feed")} articles={savedArticles} onReadMore={setReadingArticle} />;
    if (activeTab === "profile") return <ProfileScreen onSignIn={() => setSignUpOpen(true)} userName={userName} />;
    return null;
  };

  return (
    <div className="h-[100dvh] w-full relative">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      {activeTab === 'feed' && <TopBar selectedDate={selectedDate} onDateChange={handleDatePick} showDatePicker />}

      {/* Day progress bar — liquid green fill, sits flush under the top bar */}
      {activeTab === 'feed' && (
        <div
          className="fixed inset-x-0 overflow-hidden"
          style={{ top: '48px', height: '3px', background: 'rgba(255,255,255,0.12)', zIndex: 39 }}
        >
          <div
            style={{
              height: '100%',
              width: `${dayProgress * 100}%`,
              background: 'linear-gradient(90deg, #2d8a58 0%, #52b788 50%, #b7e4c7 100%)',
              transition: 'width 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              minWidth: dayProgress > 0 ? '6px' : '0px',
            }}
          />
        </div>
      )}

      {/* Feed — always mounted so scroll position is preserved when switching tabs */}
      <div
        ref={scrollContainerRef}
        className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory scrollbar-hide overscroll-y-none"
        style={{ scrollPaddingBottom: "64px", display: activeTab === 'feed' ? 'block' : 'none' }}
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
                isRead={readIds.has(item.article.id)}
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

      {/* Overlay screens for other tabs */}
      {renderOverlayTab()}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      <ArticleReader
        article={liveReadingArticle}
        onClose={() => setReadingArticle(null)}
        isRead={liveReadingArticle ? readIds.has(liveReadingArticle.id) : false}
        onMarkRead={() => liveReadingArticle && setReadIds(prev => {
          const next = new Set(prev);
          next.has(liveReadingArticle.id) ? next.delete(liveReadingArticle.id) : next.add(liveReadingArticle.id);
          return next;
        })}
      />
      <SignUpFlow
        isOpen={signUpOpen}
        onClose={() => setSignUpOpen(false)}
        onComplete={(name) => { setUserName(name); setSignUpOpen(false); }}
      />
    </div>
  );
}
