import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { isSameDay, startOfDay, subDays } from "date-fns";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleReader } from "@/components/ArticleReader";
import { SplashScreen } from "@/components/SplashScreen";
import { SignUpFlow } from "@/components/SignUpFlow";
import { SignInSheet } from "@/components/SignInSheet";
import { AccountChoiceSheet } from "@/components/AccountChoiceSheet";
import { LegalSheet, type LegalKind } from "@/components/LegalSheet";
import { SettingsSheet } from "@/components/SettingsSheet";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { DateDividerCard } from "@/components/DateDividerCard";
import { DayCompletionCard } from "@/components/DayCompletionCard";
import { GrainBackground } from "@/components/GrainBackground";
import { useInfiniteNewsFeed } from "@/hooks/use-news";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { SavesContext, useSavesRoot } from "@/hooks/use-saves";
import { supabase } from "@/lib/supabase";
import { AlertCircle, RefreshCw } from "lucide-react";
import type { NewsArticle } from "@workspace/api-client-react";
import {
  optimizeImageUrl,
  PopcornRefreshAnim,
  SavedScreen,
  ProfileScreen,
} from "./feed-internals";

type Tab = "feed" | "saved" | "profile";

function dividerIdForDate(d: Date) {
  return `day-divider-${startOfDay(d).getTime()}`;
}

type DayGroup = {
  date: Date;
  id: string;
  articles: NewsArticle[];
};

// Spring curve used for committed horizontal transitions (lands softly on
// the next divider without overshoot).
const HORIZONTAL_SPRING = "transform 340ms cubic-bezier(0.22,1,0.36,1)";

// Threshold: horizontal swipe is only recognised when the active day's
// vertical scrollTop is at or below this (i.e., the user is parked on the
// DateDividerCard — not mid-article).
const DIVIDER_EPS = 10;

export function FeedPageHorizontal() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  // full_name is the display name (used for greetings + the "You" page
  // header). `userHandle` is the public `@username` shown below the name
  // on the profile screen (replacing the old email slot).
  const userName =
    (user?.user_metadata?.full_name as string | undefined)
      ?? user?.email?.split("@")[0]
      ?? null;
  const userHandle = profile?.username ? `@${profile.username}` : null;
  const userAvatar = user?.user_metadata?.avatar_url ?? null;
  const userTopics: string[] = user?.user_metadata?.topics ?? [];

  // Only show the splash animation to signed-out visitors (it's the gate
  // to the LOG IN / CREATE ACCOUNT CTAs). Returning or just-authenticated
  // users skip straight to the feed — no 7.6-second popcorn intro after
  // every Google OAuth redirect or page refresh.
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [readingArticle, setReadingArticle] = useState<NewsArticle | null>(null);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [legalSheet, setLegalSheet] = useState<LegalKind | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readerCommentsOpen, setReaderCommentsOpen] = useState(false);
  const [focusCommentId, setFocusCommentId] = useState<number | null>(null);
  const { items: notifItems, unreadCount, loading: notifLoading, markRead, markAllRead } = useNotifications(user);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Horizontal paging state. Newest-first: idx 0 = today, idx N = oldest loaded.
  const [currentDayIdx, setCurrentDayIdx] = useState(0);

  // Measure the true full-viewport height (same trick as FeedPage).
  const [viewportHeight, setViewportHeight] = useState(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;height:100dvh;pointer-events:none;visibility:hidden';
    document.body.appendChild(d);
    const h = d.offsetHeight;
    d.remove();
    return h > 0 ? h : window.innerHeight;
  });
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout | null = null;
    const measure = () => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:0;height:100dvh;pointer-events:none;visibility:hidden';
      document.body.appendChild(d);
      const h = d.offsetHeight;
      d.remove();
      setViewportHeight(h > 0 ? h : window.innerHeight);
      setViewportWidth(window.innerWidth);
    };
    const throttledMeasure = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(measure, 200);
    };
    window.addEventListener('resize', throttledMeasure);
    return () => {
      window.removeEventListener('resize', throttledMeasure);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, []);

  // ── Pull-to-refresh ─────────────────────────────────────────────────────
  const [pullOffset, setPullOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFinishing, setRefreshFinishing] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const isPulling = useRef(false);

  useEffect(() => {
    if (user) { setChoiceOpen(false); setSignUpOpen(false); setSignInOpen(false); }
  }, [user]);

  // As soon as the Supabase session resolves for an authed user, skip the
  // splash. Covers:
  //   • Returning users refreshing the tab
  //   • Google OAuth redirect landing back on /
  //   • Email-link confirmation landing back on /auth/callback
  //   • Email/password sign-in from the bottom CTA (splash dismisses as soon
  //     as the session materialises instead of waiting for its 7.6s fade)
  useEffect(() => {
    if (!authLoading && user) setShowSplash(false);
  }, [authLoading, user]);

  const isIntroScreen = showSplash || choiceOpen || signUpOpen || signInOpen;

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const isDark = readingArticle || (activeTab === 'feed' && !showSplash);
    const color = isDark ? '#000000' : '#053980';
    if (meta) meta.content = color;
    document.documentElement.style.background = color;
  }, [readingArticle, activeTab, showSplash]);

  const handleSplashDone = useCallback(() => setShowSplash(false), []);

  const openNotifications = useCallback(() => {
    setNotifOpen(true);
    void markAllRead();
  }, [markAllRead]);

  const handleSelectNotification = useCallback(async (n: { id: number; article_id: number; reply_comment_id: number }) => {
    void markRead(n.id);
    setNotifOpen(false);
    const { data } = await supabase
      .from("articles")
      .select("*")
      .eq("id", n.article_id)
      .single();
    if (!data) return;
    setFocusCommentId(n.reply_comment_id);
    setReaderCommentsOpen(true);
    setReadingArticle(data as unknown as NewsArticle);
  }, [markRead]);

  const pickerTouchStartYRef = useRef(0);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, refetch } =
    useInfiniteNewsFeed(undefined);

  useEffect(() => {
    document.body.style.overflow = readingArticle ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [readingArticle]);

  // Saved articles — backed by the `saved_articles` Supabase table so the
  // set syncs between the user's devices. The context this hook returns is
  // also broadcast to every descendant via <SavesContext.Provider> below
  // so ActionButtons / ArticleReader can read + toggle the same Set.
  const saves = useSavesRoot(user);

  // Flat newest-first article list with image URL rewriting (identical to FeedPage).
  // DPR is passed so Supabase / Unsplash / TMDb / Wikipedia / WP URLs are
  // rewritten to variants sized for the device's physical pixel count —
  // cuts payload by ~50–60% on 3x retina vs the default 2400px originals.
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const allArticles = useMemo(
    () => (data?.pages.flatMap((page) => page.articles) ?? []).map((article) => {
      const optimized = optimizeImageUrl(article.imageUrl, dpr);
      return optimized === article.imageUrl
        ? article
        : { ...article, imageUrl: optimized as typeof article.imageUrl };
    }),
    [data, dpr]
  );
  // Saved tab articles: filter directly against the live saves set so the
  // list reflects the current user (the `article.isBookmarked` field from
  // the API stub always returns false).
  const savedArticles = useMemo(
    () => allArticles.filter((a) => saves.savedIds.has(a.id)),
    [allArticles, saves.savedIds]
  );
  const liveReadingArticle = readingArticle
    ? (allArticles.find((a) => a.id === readingArticle.id) ?? readingArticle)
    : null;

  // Group by day (newest day first).
  const dayGroups = useMemo<DayGroup[]>(() => {
    if (allArticles.length === 0) return [];
    const groups: DayGroup[] = [];
    const byKey = new Map<string, DayGroup>();
    for (const article of allArticles) {
      const dateStr = (article as any).feedDate ?? article.publishedAt;
      const divDate = startOfDay(new Date(dateStr));
      const key = divDate.toISOString();
      let g = byKey.get(key);
      if (!g) {
        g = { date: divDate, id: dividerIdForDate(divDate), articles: [] };
        byKey.set(key, g);
        groups.push(g);
      }
      g.articles.push(article);
    }
    // Newest day first
    groups.sort((a, b) => b.date.getTime() - a.date.getTime());
    return groups;
  }, [allArticles]);

  // Clamp currentDayIdx when dayGroups shrinks (shouldn't happen in practice
  // but guards against any race conditions).
  useEffect(() => {
    if (currentDayIdx > Math.max(0, dayGroups.length - 1)) {
      setCurrentDayIdx(Math.max(0, dayGroups.length - 1));
    }
  }, [dayGroups.length, currentDayIdx]);

  // Refs shared with the rAF loop and touch handlers.
  const dayScrollRefs = useRef<(HTMLDivElement | null)[]>([]);
  const railRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dayGroupsRef = useRef<DayGroup[]>(dayGroups);
  useEffect(() => { dayGroupsRef.current = dayGroups; }, [dayGroups]);
  const currentDayIdxRef = useRef(currentDayIdx);
  useEffect(() => { currentDayIdxRef.current = currentDayIdx; }, [currentDayIdx]);
  const viewportWidthRef = useRef(viewportWidth);
  useEffect(() => { viewportWidthRef.current = viewportWidth; }, [viewportWidth]);
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  // Rail transform is managed imperatively so React renders can't fight
  // the ongoing CSS transition. visualDayIdxRef is the source of truth
  // for where the rail is visually parked; currentDayIdx is only flipped
  // after the 340ms spring settles (so the heavy ArticleCard unmount/mount
  // work happens AFTER the animation, not during it).
  const visualDayIdxRef = useRef(currentDayIdx);
  const pendingDayFlipRef = useRef<number | null>(null);

  // ── Rail transform ───────────────────────────────────────────────────────
  // Reverse render order: oldest day on the LEFT, today on the RIGHT. This
  // makes "swipe right → previous day" feel spatially correct (dragging the
  // finger right reveals the older day sliding in from the left edge).
  const currentDomIdx = Math.max(0, dayGroups.length - 1 - currentDayIdx);

  // ── Image preloader (copied structure from FeedPage) ────────────────────
  const decodedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const decodeOrderRef = useRef<string[]>([]);
  const MAX_DECODED_IMAGES = 20;

  const preloadImage = useCallback((url: string | null | undefined, priority: 'high' | 'auto' = 'auto') => {
    if (!url || decodedImagesRef.current.has(url)) return;
    const img = new Image();
    (img as unknown as { fetchPriority?: string }).fetchPriority = priority;
    img.decoding = 'async';
    img.src = url;
    decodedImagesRef.current.set(url, img);
    decodeOrderRef.current.push(url);
    img.decode().catch(() => { decodedImagesRef.current.delete(url); });
    while (decodeOrderRef.current.length > MAX_DECODED_IMAGES) {
      const evict = decodeOrderRef.current.shift();
      if (evict && evict !== url) decodedImagesRef.current.delete(evict);
    }
  }, []);

  // Progress bar fill ref (forwarded to TopBar).
  const feedBarFillRef = useRef<HTMLDivElement>(null);
  const lastProgressRef = useRef(-1);

  const updateProgressBar = useCallback(() => {
    const day = dayGroupsRef.current[currentDayIdxRef.current];
    const fill = feedBarFillRef.current;
    const container = dayScrollRefs.current[currentDayIdxRef.current];
    if (!day || !fill || !container) return;
    const { scrollTop, clientHeight } = container;
    if (clientHeight <= 0) return;
    // Snap children: divider (0), articles (1..N), completion card (N+1).
    // Progress fills divider → last article from 0 → 1, then REVERSES back
    // toward 0 as the user swipes from the last article into the completion
    // card — so the fill visibly drains along with the swipe rather than
    // snapping after landing.
    const articleCount = day.articles.length;
    const denom = articleCount > 0 ? articleCount : 1;
    const fractionalIdx = scrollTop / clientHeight;
    const rawProgress =
      fractionalIdx <= articleCount
        ? fractionalIdx / denom
        : Math.max(0, articleCount + 1 - fractionalIdx);
    const progress = Math.round(Math.max(0, Math.min(1, rawProgress)) * 1000) / 1000;
    if (Math.abs(progress - lastProgressRef.current) > 0.0005) {
      lastProgressRef.current = progress;
      fill.style.transform = `scaleX(${progress})`;
    }
  }, []);

  // In-day card tracking + prefetch. Within the active day, prefetch the
  // next 6 and previous 2 article images. Same algorithm as FeedPage but
  // scoped to the active day's scroller.
  //
  // Driven by a passive `scroll` listener on the active day's container,
  // not a continuous rAF loop. The previous rAF version ran at 60 Hz even
  // when the user was idle, doing two layout reads (scrollTop, clientHeight)
  // + a transform write per frame; on iOS WebKit that pinned the main
  // thread enough to make taps and the keyboard feel sticky. A passive
  // scroll listener does the same DOM reads/writes ONLY when the user is
  // actually scrolling — same behaviour during scroll, zero cost when idle.
  // Re-attaches when the active day changes so it always points at the
  // currently-scrollable container.
  const scrollIndexRef = useRef(-1);
  useEffect(() => {
    const container = dayScrollRefs.current[currentDayIdx];
    if (!container) return;

    const onScroll = () => {
      if (activeTabRef.current !== 'feed') return;
      const day = dayGroupsRef.current[currentDayIdxRef.current];
      if (!day) return;
      const { scrollTop, clientHeight } = container;
      if (clientHeight <= 0) return;

      updateProgressBar();

      const total = day.articles.length + 1;
      const fractionalIdx = scrollTop / clientHeight;
      const roundedIdx = Math.min(Math.max(0, Math.round(fractionalIdx)), total - 1);
      if (roundedIdx !== scrollIndexRef.current) {
        scrollIndexRef.current = roundedIdx;
        // roundedIdx 0 = divider, 1..N = article (roundedIdx - 1)
        const articleIdx = roundedIdx - 1;
        for (let offset = 1; offset <= 6; offset++) {
          const a = day.articles[articleIdx + offset];
          if (a?.imageUrl) preloadImage(a.imageUrl, offset <= 2 ? 'high' : 'auto');
        }
        for (let offset = 1; offset <= 2; offset++) {
          const a = day.articles[articleIdx - offset];
          if (a?.imageUrl) preloadImage(a.imageUrl, 'auto');
        }
      }
    };

    // Sync once on mount / day-change so the progress bar reflects the
    // initial scroll position and first prefetches kick off without
    // having to wait for the first scroll event.
    onScroll();

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [currentDayIdx, dayGroups.length, preloadImage, updateProgressBar]);

  // Day-change side effects: reset active-day scroll tracking, prefetch
  // adjacent days' first images, sync selectedDate pill in the TopBar.
  useEffect(() => {
    scrollIndexRef.current = -1;
    lastProgressRef.current = -1;
    // Prefetch current + adjacent days' first 3 image URLs.
    const nearby = [currentDayIdx - 1, currentDayIdx, currentDayIdx + 1];
    for (const idx of nearby) {
      const day = dayGroups[idx];
      if (!day) continue;
      for (let i = 0; i < Math.min(3, day.articles.length); i++) {
        preloadImage(day.articles[i].imageUrl, idx === currentDayIdx && i < 2 ? 'high' : 'auto');
      }
    }
    // Keep TopBar date pill in sync with the active day.
    const day = dayGroups[currentDayIdx];
    if (day) setSelectedDate(prev => isSameDay(prev, day.date) ? prev : day.date);
  }, [currentDayIdx, dayGroups, preloadImage]);

  // Pagination: load older days when near the end of the loaded range.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (currentDayIdx >= dayGroups.length - 2) fetchNextPage();
  }, [currentDayIdx, dayGroups.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Dynamic min date — mirrors FeedPage.
  const minDate = useMemo(() => {
    if (allArticles.length === 0) return startOfDay(subDays(new Date(), 1));
    const oldest = allArticles.reduce((min, a) => {
      const d = new Date((a as any).feedDate ?? a.publishedAt);
      return d < min ? d : min;
    }, new Date((allArticles[0] as any).feedDate ?? allArticles[0].publishedAt));
    return startOfDay(oldest);
  }, [allArticles]);

  // Dynamic max date — newest feed day actually loaded. Used to clamp the
  // TopBar forward chevron so users can't step past the latest published
  // feed (e.g. before today's edition is out).
  const maxDate = useMemo(() => {
    if (allArticles.length === 0) return startOfDay(new Date());
    const newest = allArticles.reduce((max, a) => {
      const d = new Date((a as any).feedDate ?? a.publishedAt);
      return d > max ? d : max;
    }, new Date((allArticles[0] as any).feedDate ?? allArticles[0].publishedAt));
    return startOfDay(newest);
  }, [allArticles]);

  // ── Rail transition helper ──────────────────────────────────────────────
  // Called to land on a new day. Uses a CSS spring for smoothness, then
  // forces the target day's scroller to scrollTop=0 (always land on divider).
  const landOnDay = useCallback((nextIdx: number) => {
    const rail = railRef.current;
    const clamped = Math.max(0, Math.min(dayGroups.length - 1, nextIdx));
    const domIdx = dayGroups.length - 1 - clamped;
    if (rail) {
      rail.style.transition = HORIZONTAL_SPRING;
      rail.style.transform = `translateX(${-domIdx * viewportWidth}px)`;
    }
    // Update the visual-position ref so the sync useEffect and the touch
    // handler's basePx() both reflect where the rail is (or will be).
    visualDayIdxRef.current = clamped;
    // Force new day's vertical scroll to the divider.
    const target = dayScrollRefs.current[clamped];
    if (target) target.scrollTop = 0;
    // Clear any queued flip from a prior swipe — latest swipe wins.
    if (pendingDayFlipRef.current != null) {
      window.clearTimeout(pendingDayFlipRef.current);
      pendingDayFlipRef.current = null;
    }
    // Defer the React state flip until the spring has fully settled.
    // This lets the GPU-composited transform finish silky-smooth before
    // we do the expensive ArticleCard unmount/mount work.
    if (clamped !== currentDayIdx) {
      pendingDayFlipRef.current = window.setTimeout(() => {
        pendingDayFlipRef.current = null;
        setCurrentDayIdx(clamped);
      }, 360);
    }
  }, [dayGroups.length, viewportWidth, currentDayIdx]);

  // Keep the rail's transform in sync with visualDayIdxRef whenever the
  // data shape or viewport width changes (e.g., a new day is appended by
  // fetchNextPage, or the window resizes). We do this imperatively so a
  // re-render mid-animation never resets a live transition.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const N = dayGroups.length;
    if (N === 0) return;
    // Only snap if no transition is in flight. If a pending flip is queued,
    // landOnDay already set the target transform — don't stomp it.
    if (pendingDayFlipRef.current != null) return;
    const idx = Math.min(visualDayIdxRef.current, N - 1);
    const domIdx = N - 1 - idx;
    rail.style.transition = "";
    rail.style.transform = `translateX(${-domIdx * viewportWidth}px)`;
  }, [dayGroups.length, viewportWidth]);

  // ── Horizontal gesture ──────────────────────────────────────────────────
  // Native non-passive touch listener on the rail viewport so we can
  // preventDefault once horizontal intent is confirmed (otherwise the
  // browser would steal the gesture for vertical scroll or pinch-zoom).
  useEffect(() => {
    const viewport = viewportRef.current;
    const rail = railRef.current;
    if (!viewport || !rail) return;

    let startX = 0;
    let startY = 0;
    let startScrollTop = 0;
    let startTime = 0;
    let dragging = false;
    let axis: 'x' | 'y' | null = null;
    let canSwipeHorizontal = false;

    const basePx = () => {
      // Use the VISUAL day index — during the 340ms post-swipe spring,
      // currentDayIdx hasn't flipped yet but the rail is already at (or
      // animating to) the visual target. Reading from visualDayIdxRef
      // lets a new finger-down take over from a still-animating rail
      // without a visible jump.
      const idx = visualDayIdxRef.current;
      const N = dayGroupsRef.current.length;
      const domIdx = Math.max(0, N - 1 - idx);
      return -domIdx * viewportWidthRef.current;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (activeTabRef.current !== 'feed') return;
      const activeDay = dayScrollRefs.current[visualDayIdxRef.current];
      if (!activeDay) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startScrollTop = activeDay.scrollTop;
      startTime = Date.now();
      dragging = true;
      axis = null;
      canSwipeHorizontal = startScrollTop <= DIVIDER_EPS;
      // Kill any residual transition so live drag is immediate.
      rail.style.transition = "";
    };

    const onMove = (e: TouchEvent) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!axis) {
        // Need ~6px travel to decide.
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (canSwipeHorizontal && Math.abs(dx) > Math.abs(dy) * 1.2) {
          axis = 'x';
        } else {
          axis = 'y';
        }
      }
      if (axis === 'x') {
        e.preventDefault();
        // Edge resistance when swiping beyond the first/last loaded day.
        const idx = visualDayIdxRef.current;
        const N = dayGroupsRef.current.length;
        let finger = dx;
        if ((idx === 0 && dx < 0) || (idx === N - 1 && dx > 0)) {
          finger = dx * 0.35;
        }
        rail.style.transform = `translateX(${basePx() + finger}px)`;
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!dragging) return;
      dragging = false;
      if (axis !== 'x') return;
      const endX = (e.changedTouches[0]?.clientX ?? startX);
      const dx = endX - startX;
      const dt = Math.max(1, Date.now() - startTime);
      const velocity = Math.abs(dx) / dt; // px/ms
      const idx = visualDayIdxRef.current;
      const N = dayGroupsRef.current.length;
      const commit = Math.abs(dx) > 60 || velocity > 0.35;
      let newIdx = idx;
      if (commit) {
        // Finger moved right (dx > 0) → reveal older (previous) day → idx+1 in data order.
        if (dx > 0 && idx < N - 1) newIdx = idx + 1;
        // Finger moved left (dx < 0) → reveal newer (next) day → idx-1 in data order.
        else if (dx < 0 && idx > 0) newIdx = idx - 1;
      }
      landOnDay(newIdx);
    };

    viewport.addEventListener('touchstart', onStart, { passive: true });
    viewport.addEventListener('touchmove', onMove, { passive: false });
    viewport.addEventListener('touchend', onEnd, { passive: true });
    viewport.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      viewport.removeEventListener('touchstart', onStart);
      viewport.removeEventListener('touchmove', onMove as EventListener);
      viewport.removeEventListener('touchend', onEnd);
      viewport.removeEventListener('touchcancel', onEnd);
    };
  }, [landOnDay]);

  // ── Pull-to-refresh ──────────────────────────────────────────────────────
  // Same handlers as FeedPage, but checking the ACTIVE day's scroller.
  const handlePullStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = dayScrollRefs.current[currentDayIdxRef.current];
    if (!container) return;
    if (container.scrollTop > 4) return;
    pullStartY.current = e.touches[0].clientY;
    isPulling.current = false;
  }, [isRefreshing]);

  const handlePullMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === null || isRefreshing) return;
    const container = dayScrollRefs.current[currentDayIdxRef.current];
    if (container && container.scrollTop > 4) {
      pullStartY.current = null;
      setPullOffset(0);
      return;
    }
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta <= 0) { setPullOffset(0); return; }
    if (!isPulling.current && delta < 10) return;
    isPulling.current = true;
    const dampened = Math.sqrt(delta) * 6;
    setPullOffset(Math.min(dampened, 120));
  }, [isRefreshing]);

  const handlePullEnd = useCallback(() => {
    if (pullStartY.current === null) return;
    pullStartY.current = null;
    if (pullOffset > 60 && !isRefreshing) {
      setIsRefreshing(true);
      setPullOffset(96);
      const minDelay = new Promise(r => setTimeout(r, 1800));
      Promise.all([refetch(), minDelay]).finally(() => {
        setRefreshFinishing(true);
        window.setTimeout(() => {
          setIsRefreshing(false);
          setPullOffset(0);
        }, 180);
        window.setTimeout(() => { setRefreshFinishing(false); }, 700);
      });
    } else {
      setPullOffset(0);
    }
    isPulling.current = false;
  }, [pullOffset, isRefreshing, refetch]);

  // ── TopBar date pick ────────────────────────────────────────────────────
  // Set currentDayIdx to the day matching the picked date; always land on
  // that day's divider (scrollTop = 0).
  const handleDatePick = useCallback((date: Date) => {
    const d = startOfDay(date);
    setSelectedDate(d);
    const idx = dayGroups.findIndex(g => isSameDay(g.date, d));
    if (idx !== -1) landOnDay(idx);
  }, [dayGroups, landOnDay]);

  // Tap TopBar title → scroll active day to its divider (top). If already
  // at the top, hop to the next newer day (matches the "tap status bar"
  // convention from FeedPage's handleScrollToDayTop).
  const handleScrollToDayTop = useCallback(() => {
    const active = dayScrollRefs.current[currentDayIdx];
    if (!active) return;
    if (active.scrollTop > 8) {
      active.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (currentDayIdx > 0) landOnDay(currentDayIdx - 1);
  }, [currentDayIdx, landOnDay]);

  // When currentDayIdx changes, the rail re-renders with its new transform.
  // But the transition is only desirable on user commit — set it back to
  // the default spring here (the gesture path overrides to "none" during
  // active finger-drag).
  useEffect(() => {
    const rail = railRef.current;
    if (rail) rail.style.transition = HORIZONTAL_SPRING;
  }, [currentDayIdx]);

  if (status === "pending") {
    return (
      <div className="pn-fullscreen fixed inset-0 overflow-hidden" style={{ background: '#053980' }}>
        <GrainBackground />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="pn-fullscreen fixed inset-0 flex flex-col items-center justify-center p-8 text-center overflow-hidden" style={{ background: '#053980' }}>
        <GrainBackground />
        <AlertCircle className="w-10 h-10 text-red-400 mb-6" />
        <h2 className="font-['Manrope'] font-bold text-2xl mb-3" style={{ color: "#fff1cd" }}>Connection lost</h2>
        <p className="font-['Inter'] mb-8 max-w-xs" style={{ color: "rgba(255,241,205,0.65)" }}>
          We couldn't reach the Pulse network. Check your connection and try again.
        </p>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-6 py-3 rounded-full font-['Inter'] font-semibold text-sm" style={{ background: "#fff1cd", color: "#053980" }}>
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} hasProfileDot={unreadCount > 0} />
      </div>
    );
  }

  const renderOverlayTab = () => {
    if (activeTab === "saved") return <SavedScreen onBrowse={() => setActiveTab("feed")} articles={savedArticles} onReadMore={setReadingArticle} />;
    if (activeTab === "profile") return (
      <ProfileScreen
        onSignIn={() => setSignInOpen(true)}
        onCreateAccount={() => setChoiceOpen(true)}
        onSignOut={async () => {
          // Close any sheets/overlays that might outlive the signed-in
          // session, then flip back to the splash/intro screen (which also
          // hides the BottomNav via `isIntroScreen`). Resetting activeTab
          // too so a future sign-in lands the user on the feed, not the
          // signed-out profile placeholder.
          setSettingsOpen(false);
          setNotifOpen(false);
          setLegalSheet(null);
          await signOut();
          setActiveTab("feed");
          setShowSplash(true);
        }}
        onOpenLegal={setLegalSheet}
        onOpenNotifications={openNotifications}
        onOpenSettings={() => setSettingsOpen(true)}
        unreadCount={unreadCount}
        userName={userName}
        userHandle={userHandle}
        userAvatar={userAvatar}
        topics={userTopics}
      />
    );
    return null;
  };

  // Reverse-order render: oldest day at DOM idx 0, today at DOM idx N-1.
  const renderOrder = dayGroups.length > 0
    ? dayGroups.map((_, i) => dayGroups.length - 1 - i)
    : [];

  return (
    <SavesContext.Provider value={saves}>
    <div className="pn-fullscreen fixed inset-0" style={{ background: '#053980' }}>
      <GrainBackground />

      {showSplash && (
        <SplashScreen
          onDone={handleSplashDone}
          authLoading={authLoading}
          isAuthed={!!user}
          onCreateAccount={() => setChoiceOpen(true)}
          onSignIn={() => setSignInOpen(true)}
          onOpenLegal={setLegalSheet}
        />
      )}
      {activeTab === 'feed' && !isIntroScreen && (
        <TopBar
          selectedDate={selectedDate}
          onDateChange={handleDatePick}
          showDatePicker
          fillRef={feedBarFillRef}
          minDate={minDate}
          maxDate={maxDate}
          pickerOpen={pickerOpen}
          onPickerOpenChange={setPickerOpen}
          onScrollToDayTop={handleScrollToDayTop}
        />
      )}

      {pickerOpen && activeTab === 'feed' && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 38 }}
          onClick={() => setPickerOpen(false)}
          onWheel={(e) => {
            setPickerOpen(false);
            // Wheel within the picker dismiss layer → nudge active day's scroll
            const container = dayScrollRefs.current[currentDayIdxRef.current];
            if (!container) return;
            const currentIndex = Math.round(container.scrollTop / window.innerHeight);
            const targetIndex = e.deltaY > 0 ? currentIndex + 1 : Math.max(0, currentIndex - 1);
            container.scrollTo({ top: targetIndex * window.innerHeight, behavior: 'smooth' });
          }}
          onTouchStart={(e) => { pickerTouchStartYRef.current = e.touches[0].clientY; }}
          onTouchMove={(e) => {
            const dy = pickerTouchStartYRef.current - e.touches[0].clientY;
            if (Math.abs(dy) > 8) {
              setPickerOpen(false);
              const container = dayScrollRefs.current[currentDayIdxRef.current];
              if (!container) return;
              const currentIndex = Math.round(container.scrollTop / window.innerHeight);
              const targetIndex = dy > 0 ? currentIndex + 1 : Math.max(0, currentIndex - 1);
              container.scrollTo({ top: targetIndex * window.innerHeight, behavior: 'smooth' });
            }
          }}
        />
      )}

      {activeTab === 'feed' && (pullOffset > 0 || isRefreshing || refreshFinishing) && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(56px + env(safe-area-inset-top))',
            left: 0,
            right: 0,
            height: pullOffset,
            zIndex: 35,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 10,
            overflow: 'hidden',
            pointerEvents: 'none',
            transition: isPulling.current ? 'none' : 'height 480ms cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div style={{
            opacity: refreshFinishing ? 0 : Math.min(1, pullOffset / 32),
            transform: refreshFinishing
              ? 'scale(1.12) translateY(-3px)'
              : `scale(${Math.max(0.62, Math.min(1, pullOffset / 52))})`,
            transformOrigin: 'center bottom',
            transition: refreshFinishing
              ? 'opacity 420ms cubic-bezier(0.16,1,0.3,1), transform 420ms cubic-bezier(0.34,1.3,0.64,1)'
              : 'transform 180ms cubic-bezier(0.34,1.2,0.64,1), opacity 180ms ease-out',
          }}>
            <PopcornRefreshAnim active={isRefreshing || pullOffset > 35} />
          </div>
        </div>
      )}

      {/* Horizontal rail viewport — always mounted so scroll position is
          preserved when switching tabs. Pull-to-refresh shifts it down. */}
      <div
        ref={viewportRef}
        className="pn-fullscreen"
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
        style={{
          position: 'fixed',
          top: pullOffset,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          display: activeTab === 'feed' ? 'block' : 'none',
          background: '#000',
          transition: isPulling.current ? 'none' : 'top 480ms cubic-bezier(0.16,1,0.3,1)',
          touchAction: 'pan-x pan-y',
        }}
      >
        {dayGroups.length === 0 ? (
          <div className="relative w-full flex flex-col items-center justify-center text-center px-6 overflow-hidden" style={{ height: viewportHeight }}>
            <GrainBackground />
            <h2 className="font-['Manrope'] font-bold text-2xl mb-2" style={{ color: "#fff1cd" }}>
              You're all caught up
            </h2>
            <p className="font-['Manrope'] italic" style={{ color: "rgba(255,241,205,0.65)" }}>
              No more stories right now — check back soon.
            </p>
          </div>
        ) : (
          <div
            ref={railRef}
            style={{
              display: 'flex',
              height: '100%',
              width: `${dayGroups.length * 100}vw`,
              willChange: 'transform',
              // NOTE: `transform` and `transition` are intentionally NOT
              // set here. They are controlled imperatively via refs so
              // that React re-renders during a drag / day-change animation
              // cannot reset them mid-flight (which caused visible hitches
              // on iOS Safari). See landOnDay + the transform-sync useEffect.
            }}
          >
            {renderOrder.map((dataIdx) => {
              const day = dayGroups[dataIdx];
              const isActive = dataIdx === currentDayIdx;
              // Mount articles ONLY for the active day. Each ArticleCard
              // drags in a CommentSheet + GrainBackground + backdrop-filter,
              // so mounting multiple days at once blows past iOS Safari's
              // ~1GB tab memory budget and crashes the PWA with
              // "A problem repeatedly occurred". Inactive days show just
              // their divider — swipes still look right because you land
              // on the new day's divider before its articles come into view.
              const mountArticles = dataIdx === currentDayIdx;
              return (
                <div
                  key={day.id}
                  style={{
                    width: viewportWidth,
                    height: '100%',
                    flexShrink: 0,
                    position: 'relative',
                    // Compositor isolation so swiping the rail never
                    // re-rasterises neighbouring content.
                    transform: 'translateZ(0)',
                    contain: 'layout paint',
                  }}
                >
                  <div
                    ref={(el) => { dayScrollRefs.current[dataIdx] = el; }}
                    className="snap-y snap-mandatory scrollbar-hide"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      // Only the active day is scroll-enabled. Non-active
                      // days keep overflow:hidden to avoid accidental
                      // vertical scroll leaks during horizontal gestures.
                      overflowY: isActive ? 'auto' : 'hidden',
                      overscrollBehavior: 'none',
                      WebkitOverflowScrolling: 'touch',
                      touchAction: 'pan-y',
                    }}
                  >
                    <DateDividerCard
                      date={day.date}
                      dateId={day.id}
                      viewportHeight={viewportHeight}
                      showDayNav
                      hasPrevDay={dataIdx < dayGroups.length - 1 || (dataIdx === dayGroups.length - 1 && hasNextPage)}
                      hasNextDay={dataIdx > 0}
                      dayIndex={dataIdx}
                      daysLoaded={dayGroups.length}
                      prevDate={dataIdx < dayGroups.length - 1 ? dayGroups[dataIdx + 1].date : null}
                      nextDate={dataIdx > 0 ? dayGroups[dataIdx - 1].date : null}
                      onPrev={dataIdx < dayGroups.length - 1 ? () => landOnDay(dataIdx + 1) : undefined}
                      onNext={dataIdx > 0 ? () => landOnDay(dataIdx - 1) : undefined}
                    />
                    {mountArticles && day.articles.map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onReadMore={setReadingArticle}
                        isRead={readIds.has(article.id)}
                        viewportHeight={viewportHeight}
                        renderContent
                        isActive={false}
                      />
                    ))}
                    {mountArticles && (() => {
                      // Prev = chronologically older day = NEXT entry in the
                      // newest-first dayGroups array.
                      const prevIdx = dataIdx + 1;
                      // Next = chronologically newer day = PREVIOUS entry.
                      const nextIdx = dataIdx - 1;
                      const prevAvailable = prevIdx < dayGroups.length;
                      const nextAvailable = nextIdx >= 0;
                      return (
                        <DayCompletionCard
                          date={day.date}
                          id={`day-complete-${day.id}`}
                          viewportHeight={viewportHeight}
                          hasPrevDay={prevAvailable}
                          hasNextDay={nextAvailable}
                          prevDate={prevAvailable ? dayGroups[prevIdx].date : null}
                          nextDate={nextAvailable ? dayGroups[nextIdx].date : null}
                          onGoToPrev={prevAvailable ? () => landOnDay(prevIdx) : undefined}
                          onGoToNext={nextAvailable ? () => landOnDay(nextIdx) : undefined}
                        />
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {renderOverlayTab()}

      {!isIntroScreen && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} hasProfileDot={unreadCount > 0} />}
      <ArticleReader
        article={liveReadingArticle}
        onClose={() => { setReadingArticle(null); setReaderCommentsOpen(false); setFocusCommentId(null); }}
        isRead={liveReadingArticle ? readIds.has(liveReadingArticle.id) : false}
        onMarkRead={() => liveReadingArticle && setReadIds(prev => {
          const next = new Set(prev);
          next.has(liveReadingArticle.id) ? next.delete(liveReadingArticle.id) : next.add(liveReadingArticle.id);
          return next;
        })}
        initialCommentsOpen={readerCommentsOpen}
        focusCommentId={focusCommentId}
        onRequireAuth={() => setSignInOpen(true)}
      />
      <AccountChoiceSheet
        isOpen={choiceOpen}
        onClose={() => setChoiceOpen(false)}
        onCreateManually={() => setSignUpOpen(true)}
      />
      <SignUpFlow
        isOpen={signUpOpen}
        onClose={() => setSignUpOpen(false)}
        onComplete={() => setSignUpOpen(false)}
        onOpenLegal={setLegalSheet}
        onSignInInstead={(email) => { setSignInEmail(email); setSignInOpen(true); }}
      />
      <SignInSheet
        isOpen={signInOpen}
        onClose={() => { setSignInOpen(false); setSignInEmail(""); }}
        onSignUpInstead={() => { setSignInOpen(false); setSignInEmail(""); setSignUpOpen(true); }}
        onOpenLegal={setLegalSheet}
        initialEmail={signInEmail}
      />
      <LegalSheet kind={legalSheet} onClose={() => setLegalSheet(null)} />
      <SettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onAccountDeleted={() => {
          // Mirror the sign-out flow: close any sheets/overlays that might
          // outlive the session, reset to the feed tab, and flip the splash
          // back on so the user lands on the intro/login screen (not the
          // feed) after their account is gone.
          setSettingsOpen(false);
          setNotifOpen(false);
          setLegalSheet(null);
          setActiveTab("feed");
          setShowSplash(true);
        }}
      />
      <NotificationsSheet
        isOpen={notifOpen}
        items={notifItems}
        loading={notifLoading}
        onClose={() => setNotifOpen(false)}
        onSelect={handleSelectNotification}
      />
    </div>
    </SavesContext.Provider>
  );
}
