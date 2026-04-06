import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { isSameDay, startOfDay, subDays } from "date-fns";
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
import { useAuth } from "@/hooks/use-auth";
import { Loader2, AlertCircle, RefreshCw, Bookmark, User, LogOut } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";

type Tab = "feed" | "saved" | "profile";

function dividerIdForDate(d: Date) {
  return `day-divider-${startOfDay(d).getTime()}`;
}


const CATEGORY_COLORS: Record<string, string> = {
  'Music':        '#e879f9',
  'Film & TV':    '#60a5fa',
  'Gaming':       '#a3e635',
  'Fashion':      '#f472b6',
  'Culture':      '#fb923c',
  'Sports':       '#34d399',
  'Science':      '#22d3ee',
  'AI':           '#818cf8',
  'Social Media': '#fbbf24',
  'Technology':   '#2dd4bf',
  'Internet':     '#60a5fa',
  'World':        '#6ee7b7',
  'Industry':     '#94a3b8',
  'Books':        '#f59e0b',
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
      <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center px-8 text-center overflow-hidden" style={{ background: "#053980" }}>
        <GrainBackground />
        <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-2"
            style={{
              background: "rgba(255,241,205,0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,241,205,0.22)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
          >
            <Bookmark className="w-8 h-8" style={{ color: "#fff1cd", strokeWidth: 1.6 }} />
          </div>
          <div className="flex flex-col gap-2">
            <h1
              style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "18px", lineHeight: 1.1, color: "#fff1cd", letterSpacing: "0.02em" }}
            >
              Nothing saved yet
            </h1>
            <p
              className="font-['Manrope'] leading-relaxed"
              style={{ fontSize: "14px", color: "rgba(255,241,205,0.48)" }}
            >
              Bookmark articles as you scroll to build your reading list.
            </p>
          </div>
          <button
            onClick={onBrowse}
            className="mt-3 px-8 py-3 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
            style={{ background: "#fff1cd", color: "#053980" }}
          >
            Browse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex flex-col" style={{ background: "#053980" }}>
      <GrainBackground />
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="px-5 pb-4" style={{ paddingTop: 'calc(72px + env(safe-area-inset-top))' }}>
          <h2
            style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "19px", color: "#fff1cd", letterSpacing: "0.02em", lineHeight: 1 }}
          >
            Saved
          </h2>
          <p className="font-['Inter'] mt-0.5" style={{ fontSize: "13px", color: "rgba(255,241,205,0.6)" }}>
            {articles.length} {articles.length === 1 ? "article" : "articles"}
          </p>
          <div style={{ marginTop: "12px", height: "1px", background: "rgba(255,241,205,0.10)" }} />
        </div>

        {/* Article list */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 scrollbar-hide flex flex-col gap-3">
          {articles.map((article, i) => (
            <button
              key={article.id}
              onClick={() => onReadMore(article)}
              className="w-full text-left rounded-2xl overflow-hidden flex gap-0 active:opacity-70"
              style={{
                background: "rgba(255,241,205,0.07)",
                border: "1px solid rgba(255,241,205,0.08)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
                opacity: 0,
                animation: "saved-card-in 0.38s ease forwards",
                animationDelay: `${i * 0.06}s`,
              }}
            >
              {article.imageUrl && (
                <div className="w-28 self-stretch flex-shrink-0 relative overflow-hidden">
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
                  />
                </div>
              )}
              <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0 gap-2">
                {/* Category + source pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="flex items-center gap-1"
                    style={{ background: 'rgba(255,241,205,0.10)', border: '1px solid rgba(255,241,205,0.16)', borderRadius: 999, paddingLeft: 5, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}
                  >
                    <span style={{
                      display: 'inline-block', width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                      background: CATEGORY_COLORS[article.category] ?? 'rgba(255,241,205,0.4)',
                      boxShadow: `0 0 4px 1px ${CATEGORY_COLORS[article.category] ?? 'rgba(255,241,205,0.3)'}`,
                    }} />
                    <span style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "8px", color: "rgba(255,241,205,0.85)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
                      {article.category}
                    </span>
                  </span>
                  <span
                    style={{ background: 'rgba(255,241,205,0.07)', border: '1px solid rgba(255,241,205,0.12)', borderRadius: 999, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "8px", color: "rgba(255,241,205,0.50)", letterSpacing: "0.08em" }}
                  >
                    {article.source}
                  </span>
                </div>
                {/* Title */}
                <p
                  className="font-['Manrope'] font-bold leading-snug line-clamp-2"
                  style={{ fontSize: "14px", color: "#fff1cd" }}
                >
                  {article.title}
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
    <div className="relative h-[100dvh] w-full flex flex-col overflow-hidden" style={{ background: "#053980" }}>
      <GrainBackground />

      {isLoggedIn ? (
        /* ── Signed-in view ── */
        <div className="relative z-10 flex flex-col h-full pb-24" style={{ paddingTop: 'calc(72px + env(safe-area-inset-top))' }}>

          {/* Avatar + identity */}
          <div className="px-5 flex items-center gap-4 mb-6">
            <div style={{
              width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
              background: "rgba(255,241,205,0.09)",
              border: "1.5px solid rgba(255,241,205,0.22)",
              boxShadow: "0 0 0 5px rgba(255,241,205,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {userAvatar ? (
                <img src={userAvatar} alt={userName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "24px", color: "#fff1cd", lineHeight: 1 }}>
                  {initial}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              {userName && (
                <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "20px", color: "#fff1cd", letterSpacing: "0.02em", lineHeight: 1.1 }} className="truncate">
                  {userName}
                </h1>
              )}
              {userEmail && (
                <p className="font-['Inter'] mt-1 truncate" style={{ fontSize: "12px", color: "rgba(255,241,205,0.45)" }}>
                  {userEmail}
                </p>
              )}
            </div>
          </div>

          {/* Topics */}
          {topics.length > 0 && (
            <div className="px-5 mb-8">
              <div style={{ height: "1px", background: "rgba(255,241,205,0.08)", marginBottom: 16 }} />
              <p style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "10px", color: "rgba(255,241,205,0.38)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                Your Topics
              </p>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <span
                    key={t}
                    className="px-3 py-1.5 font-['Inter'] font-medium"
                    style={{ fontSize: "12px", background: "rgba(255,241,205,0.08)", color: "#fff1cd", borderRadius: 20, border: "1px solid rgba(255,241,205,0.12)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sign out — subtle text link */}
          <div className="mt-auto px-5">
            <div style={{ height: "1px", background: "rgba(255,241,205,0.08)", marginBottom: 16 }} />
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 font-['Inter'] transition-opacity hover:opacity-60 active:opacity-50"
              style={{ fontSize: "12px", color: "rgba(255,241,205,0.38)", letterSpacing: "0.02em" }}
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
              background: "rgba(255,241,205,0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,241,205,0.22)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <User className="w-8 h-8" style={{ color: "#fff1cd", strokeWidth: 1.5 }} />
            </div>

            <h1 style={{ fontFamily: "'Macabro', 'Anton', sans-serif", fontSize: "18px", lineHeight: 1, color: "#fff1cd", letterSpacing: "0.02em", marginBottom: 10 }}>
              Your Profile
            </h1>
            <p className="font-['Manrope'] leading-relaxed" style={{ fontSize: "14px", color: "rgba(255,241,205,0.48)", maxWidth: 260, marginBottom: 28 }}>
              Sign in to personalise your feed and keep your reading history in sync.
            </p>

            <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 280 }}>
              <button
                onClick={onSignIn}
                className="w-full py-3.5 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
                style={{ background: "#fff1cd", color: "#053980" }}
              >
                Sign in
              </button>
              <button
                onClick={onCreateAccount}
                className="w-full py-3.5 rounded-full font-['Inter'] font-semibold text-sm tracking-wide transition-opacity hover:opacity-85"
                style={{ background: "rgba(255,241,205,0.09)", color: "#fff1cd", border: "1px solid rgba(255,241,205,0.14)" }}
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
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // Single source of truth for viewport height — avoids dvh/svh/100% inheritance
  // ambiguity on mobile browsers where chrome show/hide changes the visual viewport.
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  useEffect(() => {
    const update = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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
      meta.content = '#053980';
    }
  }, [readingArticle, activeTab, showSplash]);

  const handleSplashDone = useCallback(() => setShowSplash(false), []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pickerTouchStartYRef = useRef(0);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, refetch } =
    useInfiniteNewsFeed(undefined);


  useEffect(() => {
    document.body.style.overflow = readingArticle ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [readingArticle]);

  // Memoised so `feedItems` useMemo only recomputes when React Query actually
  // fetches new data — not on every render (flatMap always returns a new array).
  const allArticles = useMemo(
    () => data?.pages.flatMap((page) => page.articles) ?? [],
    [data]
  );
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

  // Ref forwarded to TopBar's fill div — mutated directly by the rAF loop, never by React
  const feedBarFillRef = useRef<HTMLDivElement>(null);

  // Prevents scroll-based date updates from overriding an explicit picker selection
  const pickerNavLockRef = useRef(false);

  // ── Task 1: Pure DOM rAF loop ────────────────────────────────────────────────
  // Reads scrollTop / (scrollHeight - clientHeight) on every animation frame and
  // writes scaleX() to the fill div. Zero React involvement — no state, no renders.
  // transform is compositor-only: no layout, no paint.
  // Refs are accessed fresh each frame (not captured at mount) so the loop still
  // works even if the first render was the pending-state early-return — where
  // scrollContainerRef and feedBarFillRef are both null at effect-run time.
  useEffect(() => {
    let rafId: number;
    const loop = () => {
      const container = scrollContainerRef.current;
      const fill = feedBarFillRef.current;
      if (container && fill) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const max = scrollHeight - clientHeight;
        fill.style.transform = `scaleX(${max > 0 ? scrollTop / max : 0})`;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []); // purely DOM — no React deps

  // ── Card tracking: scroll-end listener ───────────────────────────────────────
  // IntersectionObserver is unreliable for this purpose on iOS Safari when the
  // browser uses off-thread composited scrolling for snap containers.  A simple
  // scroll-end listener (with debounce fallback for older iOS) is reliable.
  // feedItemsLengthRef avoids re-registering the listener when pagination fires.
  const feedItemsLengthRef = useRef(feedItems.length);
  useEffect(() => { feedItemsLengthRef.current = feedItems.length; }, [feedItems.length]);

  useEffect(() => {
    // status in deps so this re-runs once the scroll container is in the DOM.
    // With [] deps the effect would capture container=null during the 'pending'
    // early-return and never attach the listener.
    if (status !== 'success') return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const update = () => {
      const idx = Math.round(container.scrollTop / window.innerHeight);
      setCurrentCardIndex(prev => {
        const next = Math.min(Math.max(0, idx), feedItemsLengthRef.current - 1);
        return next === prev ? prev : next;
      });
    };
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => { clearTimeout(timer); timer = setTimeout(update, 80); };
    update(); // sync with initial scroll position (may be non-zero after navigation)
    container.addEventListener('scrollend', update, { passive: true });
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scrollend', update);
      container.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [status]); // re-runs when feed transitions from pending → success

  // ── Task 2: Date sync on card change ─────────────────────────────────────────
  // Uses functional updater with isSameDay guard so React bails out when the
  // date hasn't actually changed — prevents re-renders on same-day Date objects.
  useEffect(() => {
    if (pickerNavLockRef.current) return;
    const item = feedItems[currentCardIndex];
    let newDate: Date | null = null;
    if (item?.kind === 'article') newDate = startOfDay(new Date(item.article.publishedAt));
    else if (item?.kind === 'divider') newDate = item.date;
    if (newDate) setSelectedDate(prev => isSameDay(prev, newDate!) ? prev : newDate!);
  }, [currentCardIndex, feedItems]);

  // ── Task 3: <link rel="preload"> for the next card ───────────────────────────
  // Injects a native preload hint so the browser fetches+decodes the next image
  // at network priority without any JS Image() objects that Safari ignores.
  useEffect(() => {
    const next = feedItems[currentCardIndex + 1];
    const url = next?.kind === 'article' ? next.article.imageUrl : null;
    if (!url) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
    return () => { if (document.head.contains(link)) document.head.removeChild(link); };
  }, [currentCardIndex, feedItems]);

  // ── Pagination: fetch next page when 5 cards from the end ───────────────────
  // The scroll-based fetchNextPage trigger was removed in the IO refactor;
  // this replaces it using currentCardIndex so yesterday's articles still load.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (currentCardIndex >= feedItems.length - 5) {
      fetchNextPage();
    }
  }, [currentCardIndex, feedItems.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Always cap navigation at yesterday — we only keep today + yesterday
  const minDate = useMemo(() => startOfDay(subDays(new Date(), 1)), []);

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
      <div className="relative h-screen w-full overflow-hidden" style={{ background: '#053980' }}>
        <GrainBackground />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center p-8 text-center overflow-hidden" style={{ background: '#053980' }}>
        <GrainBackground />
        <AlertCircle className="w-10 h-10 text-red-400 mb-6" />
        <h2 className="font-['Manrope'] font-bold text-2xl mb-3" style={{ color: "#fff1cd" }}>Connection lost</h2>
        <p className="font-['Inter'] mb-8 max-w-xs" style={{ color: "rgba(255,241,205,0.65)" }}>
          We couldn't reach the Pulse network. Check your connection and try again.
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-['Inter'] font-semibold text-sm"
          style={{ background: "#fff1cd", color: "#053980" }}
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
      {activeTab === 'feed' && <TopBar selectedDate={selectedDate} onDateChange={handleDatePick} showDatePicker fillRef={feedBarFillRef} minDate={minDate} pickerOpen={pickerOpen} onPickerOpenChange={setPickerOpen} />}

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

      {/* Feed — position:fixed inset:0 guarantees true full visual-viewport on all mobile browsers.
           Always mounted so scroll position is preserved when switching tabs. */}
      <div
        ref={scrollContainerRef}
        className="snap-y snap-mandatory scrollbar-hide"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: viewportHeight,
          overflowY: 'auto',
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
          display: activeTab === 'feed' ? 'block' : 'none',
        }}
      >
        {feedItems.length === 0 ? (
          <div className="relative w-full flex flex-col items-center justify-center snap-start snap-always text-center px-6 overflow-hidden" style={{ height: viewportHeight }}>
            <GrainBackground />
            <h2 className="font-['Manrope'] font-bold text-2xl mb-2" style={{ color: "#fff1cd" }}>
              You're all caught up
            </h2>
            <p className="font-['Manrope'] italic" style={{ color: "rgba(255,241,205,0.65)" }}>
              No more stories right now — check back soon.
            </p>
          </div>
        ) : (
          feedItems.map((item, index) => {
            // Strict 3-card window: previous (-1), current (0), next (+1).
            // Everything else is a same-height empty div — no image tags,
            // no decode work, minimal memory footprint for iOS WebViews.
            const renderContent = Math.abs(index - currentCardIndex) <= 1;
            const isActive = index === currentCardIndex;
            return item.kind === "divider" ? (
              <DateDividerCard
                key={item.id}
                date={item.date}
                dateId={item.id}
                viewportHeight={viewportHeight}
              />
            ) : (
              <ArticleCard
                key={item.article.id}
                article={item.article}
                onReadMore={setReadingArticle}
                isRead={readIds.has(item.article.id)}
                viewportHeight={viewportHeight}
                renderContent={renderContent}
                isActive={isActive}
              />
            );
          })
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
