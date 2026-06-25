import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * useLikes — per-user article likes, backed by the `user_likes` Supabase
 * table. Replaces the old client-only `localLiked` useState which lived in
 * each component (ActionButtons, ArticleReader, DragSocial) independently and
 * therefore never agreed with itself, never persisted, and never synced
 * between devices.
 *
 * Exposed via a provider + context so the top-level page owns the single
 * Supabase query; every ArticleCard / ActionButtons / ArticleReader consumer
 * re-uses that same Set instead of each running its own fetch. Mirrors
 * `use-saves.ts` exactly.
 */
export interface UseLikesResult {
  likedIds: Set<number>;
  isLiked: (articleId: number) => boolean;
  toggleLike: (articleId: number) => Promise<void>;
  /** Manually refresh from the server (e.g. after reconnect / focus). */
  refresh: () => Promise<void>;
  loading: boolean;
  /**
   * The like count to DISPLAY for an article. After the viewer toggles, the
   * `toggle_article_like` RPC returns the authoritative total and we store it
   * as an override so the number is correct immediately. Falls back to the
   * feed's `article.likes` when there's no override. Overrides are dropped on
   * a manual feed refresh (clearLikeCounts) so cross-account likes show.
   */
  likeCountFor: (article: { id: number; likes: number }) => number;
  /** Drops all per-article count overrides. Call on a manual feed refresh so
   *  the freshly-fetched server counts (incl. other accounts) take over. */
  clearLikeCounts: () => void;
}

const EMPTY_SET: Set<number> = new Set();

const LikesContext = createContext<UseLikesResult>({
  likedIds: EMPTY_SET,
  isLiked: () => false,
  toggleLike: async () => {},
  refresh: async () => {},
  loading: false,
  likeCountFor: (a) => a.likes,
  clearLikeCounts: () => {},
});

/** Root hook — call this ONCE in the page (single Supabase query), then
 *  expose the result to descendants via `<LikesContext.Provider value={...}>`.
 *  The page can also read it locally to filter the Likes-tab list. */
export function useLikesRoot(user: User | null): UseLikesResult {
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  // Per-article authoritative like count returned by the toggle RPC, shown in
  // place of the (possibly stale) feed count until the next manual refresh.
  const [countOverrides, setCountOverrides] = useState<Map<number, number>>(new Map());
  // Ref mirror so `toggleLike` can read the freshest set without listing
  // `likedIds` as a dep (which would rebuild the callback on every flip).
  const likedIdsRef = useRef(likedIds);
  likedIdsRef.current = likedIds;

  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setLikedIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_likes")
        .select("article_id")
        .eq("user_id", userId);
      if (error) {
        console.warn("[useLikes] refresh error", error.message);
        return;
      }
      const next = new Set<number>();
      for (const row of data ?? []) next.add(row.article_id as number);
      setLikedIds(next);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load + reload when the signed-in user changes.
  useEffect(() => { void refresh(); }, [refresh]);

  // Realtime: a like on ANY device updates `articles.real_likes`, which fires a
  // postgres UPDATE here. We layer the fresh total (seed + real_likes) over the
  // feed's count so likes cross devices live — the same mechanism comment votes
  // use. No user filter: article counts are public, every client wants them.
  useEffect(() => {
    const ch = supabase
      .channel("likes:articles")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "articles" },
        (payload) => {
          const row = payload.new as { id?: number; likes?: number | string; real_likes?: number | string };
          if (row?.id == null) return;
          const total = (Number(row.likes) || 0) + (Number(row.real_likes) || 0);
          setCountOverrides((prev) => {
            const next = new Map(prev);
            next.set(Number(row.id), total);
            return next;
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  // Cross-device sync: re-fetch on visibility / focus / reconnect. Realtime
  // would be nicer but polling on focus is enough for a likes list.
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onOnline = () => { void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId, refresh]);

  // Flip the heart locally (instant), with a mirror update for the ref.
  const applyHeart = useCallback((articleId: number, liked: boolean) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (liked) next.add(articleId); else next.delete(articleId);
      return next;
    });
    const mirror = new Set(likedIdsRef.current);
    if (liked) mirror.add(articleId); else mirror.delete(articleId);
    likedIdsRef.current = mirror;
  }, []);

  const toggleLike = useCallback(async (articleId: number) => {
    if (!userId) return;
    const wasLiked = likedIdsRef.current.has(articleId);

    // Flip the heart immediately for snappy feedback; the count snaps to the
    // RPC's authoritative total a moment later.
    applyHeart(articleId, !wasLiked);

    // One atomic server call does the like/unlike AND returns the true count —
    // mirrors `cast_vote` for comments. SECURITY DEFINER, so the write always
    // lands regardless of row-level-security policies on user_likes.
    const { data, error } = await supabase.rpc("toggle_article_like", {
      p_article_id: articleId,
    });

    if (error) {
      console.warn("[useLikes] toggle_article_like failed — reverting", error.message);
      applyHeart(articleId, wasLiked);
      return;
    }

    // Table-returning RPC → array of one row { likes, liked }.
    const row = (Array.isArray(data) ? data[0] : data) as
      | { likes: number | string; liked: boolean }
      | undefined;
    if (!row) return;

    // Reconcile both the heart and the displayed count with the server truth.
    applyHeart(articleId, !!row.liked);
    setCountOverrides((prev) => {
      const next = new Map(prev);
      next.set(articleId, Number(row.likes) || 0);
      return next;
    });
  }, [userId, applyHeart]);

  const isLiked = useCallback((articleId: number) => likedIds.has(articleId), [likedIds]);

  const likeCountFor = useCallback(
    (article: { id: number; likes: number }) =>
      countOverrides.has(article.id)
        ? (countOverrides.get(article.id) as number)
        : (article.likes ?? 0),
    [countOverrides],
  );

  const clearLikeCounts = useCallback(() => {
    setCountOverrides((prev) => (prev.size === 0 ? prev : new Map()));
  }, []);

  return { likedIds, isLiked, toggleLike, refresh, loading, likeCountFor, clearLikeCounts };
}

/** Exported so the page can render `<LikesContext.Provider value={likes}>`
 *  inline (reusing its own `useLikesRoot` result — no extra Supabase query). */
export { LikesContext };

/** Consume the likes set from any descendant of the LikesContext provider. */
export function useLikedArticles(): UseLikesResult {
  return useContext(LikesContext);
}
