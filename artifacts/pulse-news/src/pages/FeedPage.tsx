import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { isSameDay, startOfDay } from "date-fns";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleReader } from "@/components/ArticleReader";
import { SplashScreen } from "@/components/SplashScreen";
import { SignUpFlow } from "@/components/SignUpFlow";
import { SignInSheet } from "@/components/SignInSheet";
import { DateDividerCard } from "@/components/DateDividerCard";
import { GrainBackground } from "@/components/GrainBackground";
import { useInfiniteNewsFeed } from "@/hooks/use-news";
import { useIntersection } from "@/hooks/use-intersection";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, AlertCircle, RefreshCw, Bookmark, User, LogOut } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";

type Tab = "feed" | "saved" | "profile";

function dividerIdForDate(d: Date) {
  return `day-divider-${startOfDay(d).getTime()}`;
}


const SAVED_CATEGORY_COLORS: Record<string, string> = {
  Models:   '#a78bfa',
  Research: '#34d399',
  Industry: '#fbbf24',
  Policy:   '#60a5fa',
  Tools:    '#f472b6',
};

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
      <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center px-8 text-center overflow-hidden" style={{ background: "#204a52" }}>
        <GrainBackground />
        <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-2"
            style={{
              background: "rgba(255,243,211,0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
          >
            <Bookmark className="w-9 h-9" style={{ color: "#fff3d3", strokeWidth: 1.6 }} />
          </div>
          <div className="flex flex-col gap-2">
            <h1
              style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "28px", lineHeight: 1.1, color: "#fff3d3", letterSpacing: "0.02em" }}
            >
              Nothing saved yet
            </h1>
            <p
              className="font-['Lora'] italic leading-relaxed"
              style={{ fontSize: "15px", color: "rgba(255,243,211,0.60)" }}
            >
              Bookmark articles as you scroll to build your reading list.
            </p>
          </div>
          <button
            onClick={onBrowse}
            className="mt-3 px-8 py-3 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
            style={{ background: "#fff3d3", color: "#204a52" }}
          >
            Browse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex flex-col" style={{ background: "#204a52" }}>
      <GrainBackground />
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="px-5 pb-4" style={{ paddingTop: 'calc(72px + env(safe-area-inset-top))' }}>
          <h2
            style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "19px", color: "#fff3d3", letterSpacing: "0.02em", lineHeight: 1 }}
          >
            Saved
          </h2>
          <p className="font-['Inter'] mt-0.5" style={{ fontSize: "13px", color: "rgba(255,243,211,0.6)" }}>
            {articles.length} {articles.length === 1 ? "article" : "articles"}
          </p>
          <div style={{ marginTop: "12px", height: "1px", background: "rgba(255,243,211,0.10)" }} />
        </div>

        {/* Article list */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 scrollbar-hide flex flex-col gap-3">
          {articles.map((article, i) => (
            <button
              key={article.id}
              onClick={() => onReadMore(article)}
              className="w-full text-left rounded-2xl overflow-hidden flex gap-0 active:opacity-70"
              style={{
                background: "rgba(255,243,211,0.07)",
                border: "1px solid rgba(255,243,211,0.08)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
                opacity: 0,
                animation: "saved-card-in 0.38s ease forwards",
                animationDelay: `${i * 0.06}s`,
              }}
            >
              {article.imageUrl && (
                <div className="w-28 self-stretch flex-shrink-0">
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0 gap-2">
                {/* Category */}
                <div className="flex items-center gap-1.5">
                  <span style={{
                    display: 'inline-block', width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                    background: SAVED_CATEGORY_COLORS[article.category] ?? 'rgba(255,243,211,0.4)',
                    boxShadow: `0 0 4px 1px ${SAVED_CATEGORY_COLORS[article.category] ?? 'rgba(255,243,211,0.3)'}`,
                  }} />
                  <span
                    style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "9px", color: "rgba(255,243,211,0.55)", letterSpacing: "0.10em", textTransform: "uppercase" }}
                  >
                    {article.tag}
                  </span>
                </div>
                {/* Title */}
                <p
                  className="font-['Manrope'] font-bold leading-snug line-clamp-2"
                  style={{ fontSize: "14px", color: "#fff3d3" }}
                >
                  {article.title}
                </p>
                {/* Source + read time */}
                <p style={{ fontSize: "11px", color: "rgba(255,243,211,0.45)" }}>
                  <span style={{ fontFamily: "'Macabro', 'Anton', sans-serif" }}>{article.source}</span>
                  <span className="font-['Inter']"> · {article.readTimeMinutes} min</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileScreen({
  onSignIn,
  onCreateAccount,
  onSignOut,
  userName,
  userEmail,
  userAvatar,
  topics,
}: {
  onSignIn: () => void;
  onCreateAccount: () => void;
  onSignOut: () => void;
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
  topics: string[];
}) {
  const isLoggedIn = !!userName || !!userEmail;
  const initial = (userName ?? userEmail ?? "?")[0].toUpperCase();

  return (
    <div className="relative h-[100dvh] w-full flex flex-col overflow-hidden" style={{ background: "#204a52" }}>
      <GrainBackground />

      {isLoggedIn ? (
        /* ── Signed-in view ── */
        <div className="relative z-10 flex flex-col h-full pb-24" style={{ paddingTop: 'calc(72px + env(safe-area-inset-top))' }}>

          {/* Avatar + identity */}
          <div className="px-5 flex items-center gap-4 mb-6">
            <div style={{
              width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
              background: "rgba(255,243,211,0.09)",
              border: "1.5px solid rgba(255,243,211,0.22)",
              boxShadow: "0 0 0 5px rgba(255,243,211,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {userAvatar ? (
                <img src={userAvatar} alt={userName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "24px", color: "#fff3d3", lineHeight: 1 }}>
                  {initial}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              {userName && (
                <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "20px", color: "#fff3d3", letterSpacing: "0.02em", lineHeight: 1.1 }} className="truncate">
                  {userName}
                </h1>
              )}
              {userEmail && (
                <p className="font-['Inter'] mt-1 truncate" style={{ fontSize: "12px", color: "rgba(255,243,211,0.45)" }}>
                  {userEmail}
                </p>
              )}
            </div>
          </div>

          {/* Topics */}
          {topics.length > 0 && (
            <div className="px-5 mb-8">
              <div style={{ height: "1px", background: "rgba(255,243,211,0.08)", marginBottom: 16 }} />
              <p style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "10px", color: "rgba(255,243,211,0.38)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                Your Topics
              </p>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <span
                    key={t}
                    className="px-3 py-1.5 font-['Inter'] font-medium"
                    style={{ fontSize: "12px", background: "rgba(255,243,211,0.08)", color: "#fff3d3", borderRadius: 20, border: "1px solid rgba(255,243,211,0.12)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sign out — subtle text link */}
          <div className="mt-auto px-5">
            <div style={{ height: "1px", background: "rgba(255,243,211,0.08)", marginBottom: 16 }} />
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 font-['Inter'] transition-opacity hover:opacity-60 active:opacity-50"
              style={{ fontSize: "12px", color: "rgba(255,243,211,0.38)", letterSpacing: "0.02em" }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      ) : (
        /* ── Signed-out view ── */
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 text-center">
            <div style={{
              width: 80, height: 80, borderRadius: "50%", marginBottom: 24,
              background: "rgba(255,243,211,0.07)",
              border: "1px solid rgba(255,243,211,0.14)",
              boxShadow: "0 0 36px rgba(255,243,211,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <User className="w-8 h-8" style={{ color: "rgba(255,243,211,0.45)", strokeWidth: 1.5 }} />
            </div>

            <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "18px", lineHeight: 1, color: "#fff3d3", letterSpacing: "0.02em", marginBottom: 10 }}>
              Your Profile
            </h1>
            <p className="font-['Manrope'] leading-relaxed" style={{ fontSize: "14px", color: "rgba(255,243,211,0.48)", maxWidth: 260, marginBottom: 28 }}>
              Sign in to personalise your feed and keep your reading history in sync.
            </p>

            <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 280 }}>
              <button
                onClick={onSignIn}
                className="w-full py-3.5 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
                style={{ background: "#fff3d3", color: "#204a52" }}
              >
                Sign in
              </button>
              <button
                onClick={onCreateAccount}
                className="w-full py-3.5 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
                style={{ background: "rgba(255,243,211,0.09)", color: "#fff3d3", border: "1px solid rgba(255,243,211,0.14)" }}
              >
                Create account
              </button>
            </div>
        </div>
      )}
    </div>
  );
}

export function FeedPage() {
  const { user, signOut } = useAuth();
  const userName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? null;
  const userEmail = user?.email ?? null;
  const userAvatar = user?.user_metadata?.avatar_url ?? null;
  const userTopics: string[] = user?.user_metadata?.topics ?? [];

  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [readingArticle, setReadingArticle] = useState<NewsArticle | null>(null);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Close auth modals when the user becomes authenticated (e.g. after Google OAuth redirect)
  useEffect(() => {
    if (user) { setSignUpOpen(false); setSignInOpen(false); }
  }, [user]);

  // Dynamic status bar (theme-color) based on active screen
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) return;
    if (readingArticle) {
      meta.content = '#000000';
    } else if (activeTab === 'feed' && !showSplash) {
      meta.content = '#000000';
    } else {
      meta.content = '#204a52';
    }
  }, [readingArticle, activeTab, showSplash]);

  const handleSplashDone = useCallback(() => setShowSplash(false), []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const pickerTouchStartYRef = useRef(0);

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
      if (lastDayKey !== dayKey) {
        const divDate = startOfDay(new Date(article.publishedAt));
        items.push({ kind: "divider", date: divDate, id: dividerIdForDate(divDate) });
      }
      lastDayKey = dayKey;
      items.push({ kind: "article", article });
    }
    return items;
  }, [allArticles]);

  const [dayProgress, setDayProgress] = useState(0);

  // Prevents scroll-based date updates from overriding an explicit picker selection
  const pickerNavLockRef = useRef(false);

  const handleItemEnter = useCallback((date: Date) => {
    if (!pickerNavLockRef.current) setSelectedDate(startOfDay(date));
  }, []);

  const handleArticleEnter = useCallback((publishedAt: string) => {
    if (!pickerNavLockRef.current) setSelectedDate(startOfDay(new Date(publishedAt)));
  }, []);

  // Scroll-based progress — each card is 100dvh so card index = round(scrollTop / vh)
  const feedItemsRef = useRef(feedItems);
  useEffect(() => { feedItemsRef.current = feedItems; }, [feedItems]);

  const handleFeedScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop } = container;
    lastScrollTopRef.current = scrollTop;
    const cardIndex = Math.round(scrollTop / window.innerHeight);
    const items = feedItemsRef.current;
    if (cardIndex < 0 || cardIndex >= items.length) return;
    const current = items[cardIndex];
    if (current.kind === 'article') {
      const articleDay = startOfDay(new Date(current.article.publishedAt));
      const dayItems = items.filter(
        i => i.kind === 'article' && isSameDay(startOfDay(new Date(i.article.publishedAt)), articleDay)
      );
      const idx = dayItems.findIndex(
        i => i.kind === 'article' && i.article.publishedAt === current.article.publishedAt
      );
      if (dayItems.length > 0 && idx >= 0) setDayProgress((idx + 1) / dayItems.length);
    } else {
      setDayProgress(0);
    }
  }, []);

  // Fire once when feed data loads so bar reflects initial position
  useEffect(() => { handleFeedScroll(); }, [feedItems, handleFeedScroll]);

  const minDate = useMemo(() => {
    if (allArticles.length === 0) return undefined;
    return startOfDay(new Date(Math.min(...allArticles.map(a => new Date(a.publishedAt).getTime()))));
  }, [allArticles]);

  const handleDatePick = useCallback((date: Date) => {
    pickerNavLockRef.current = true;
    setTimeout(() => { pickerNavLockRef.current = false; }, 700);
    setSelectedDate(startOfDay(date));
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
      <div className="relative h-screen w-full overflow-hidden" style={{ background: '#204a52' }}>
        <GrainBackground />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center p-8 text-center overflow-hidden" style={{ background: '#204a52' }}>
        <GrainBackground />
        <AlertCircle className="w-10 h-10 text-red-400 mb-6" />
        <h2 className="font-['Manrope'] font-bold text-2xl mb-3" style={{ color: "#fff3d3" }}>Connection lost</h2>
        <p className="font-['Inter'] mb-8 max-w-xs" style={{ color: "rgba(255,243,211,0.65)" }}>
          We couldn't reach the Pulse network. Check your connection and try again.
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-['Inter'] font-semibold text-sm"
          style={{ background: "#fff3d3", color: "#204a52" }}
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
    if (activeTab === "profile") return (
      <ProfileScreen
        onSignIn={() => setSignInOpen(true)}
        onCreateAccount={() => setSignUpOpen(true)}
        onSignOut={() => signOut()}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        topics={userTopics}
      />
    );
    return null;
  };

  return (
    <div className="h-[100dvh] w-full relative">
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      {activeTab === 'feed' && <TopBar selectedDate={selectedDate} onDateChange={handleDatePick} showDatePicker dayProgress={dayProgress} minDate={minDate} pickerOpen={pickerOpen} onPickerOpenChange={setPickerOpen} />}

      {/* Picker dismiss overlay — lives here so it can forward scroll gestures to the feed */}
      {pickerOpen && activeTab === 'feed' && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 38 }}
          onClick={() => setPickerOpen(false)}
          onWheel={(e) => {
            setPickerOpen(false);
            const container = scrollContainerRef.current;
            if (!container) return;
            const currentIndex = Math.round(container.scrollTop / window.innerHeight);
            const targetIndex = e.deltaY > 0 ? currentIndex + 1 : Math.max(0, currentIndex - 1);
            container.scrollTo({ top: targetIndex * window.innerHeight, behavior: 'smooth' });
          }}
          onTouchStart={(e) => {
            pickerTouchStartYRef.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            const dy = pickerTouchStartYRef.current - e.touches[0].clientY;
            if (Math.abs(dy) > 8) {
              setPickerOpen(false);
              const container = scrollContainerRef.current;
              if (!container) return;
              const currentIndex = Math.round(container.scrollTop / window.innerHeight);
              const targetIndex = dy > 0 ? currentIndex + 1 : Math.max(0, currentIndex - 1);
              container.scrollTo({ top: targetIndex * window.innerHeight, behavior: 'smooth' });
            }
          }}
        />
      )}

      {/* Feed — always mounted so scroll position is preserved when switching tabs */}
      <div
        ref={scrollContainerRef}
        onScroll={handleFeedScroll}
        className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory scrollbar-hide overscroll-y-none"
        style={{ scrollPaddingBottom: "64px", display: activeTab === 'feed' ? 'block' : 'none' }}
      >
        {feedItems.length === 0 ? (
          <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center snap-start snap-always text-center px-6 overflow-hidden">
            <GrainBackground />
            <h2 className="font-['Manrope'] font-bold text-2xl mb-2" style={{ color: "#fff3d3" }}>
              You're all caught up
            </h2>
            <p className="font-['Manrope'] italic" style={{ color: "rgba(255,243,211,0.65)" }}>
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
        onComplete={() => setSignUpOpen(false)}
      />
      <SignInSheet
        isOpen={signInOpen}
        onClose={() => setSignInOpen(false)}
        onSignUpInstead={() => { setSignInOpen(false); setSignUpOpen(true); }}
      />
    </div>
  );
}
