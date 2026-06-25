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
   * The like count to DISPLAY for an article: the server's count plus the
   * viewer's own optimistic adjustment, so a tap bumps the number instantly.
   * The adjustment is dropped on the next feed fetch (clearLikeDeltas), where
   * the server count becomes authoritative — so it never double-counts.
   */
  likeCountFor: (article: { id: number; likes: number }) => number;
  /** Clears all optimistic count adjustments. Call when fresh feed data
   *  arrives (the server count then already includes the viewer's likes). */
  clearLikeDeltas: () => void;
}

const EMPTY_SET: Set<number> = new Set();

const LikesContext = createContext<UseLikesResult>({
  likedIds: EMPTY_SET,
  isLiked: () => false,
  toggleLike: async () => {},
  refresh: async () => {},
  loading: false,
  likeCountFor: (a) => a.likes,
  clearLikeDeltas: () => {},
});

/** Root hook — call this ONCE in the page (single Supabase query), then
 *  expose the result to descendants via `<LikesContext.Provider value={...}>`.
 *  The page can also read it locally to filter the Likes-tab list. */
export function useLikesRoot(user: User | null): UseLikesResult {
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  // Per-article optimistic count adjustment (+1 like / -1 unlike) layered on
  // top of the server's count, so a tap moves the number immediately. Cleared
  // on the next feed fetch, when the server count already reflects the change.
  const [likeDeltas, setLikeDeltas] = useState<Map<number, number>>(new Map());
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

  // Adjust the optimistic count for an article by +1 / -1 (or undo on revert).
  const bumpDelta = useCallback((articleId: number, by: number) => {
    setLikeDeltas((prev) => {
      const next = new Map(prev);
      next.set(articleId, (next.get(articleId) ?? 0) + by);
      return next;
    });
  }, []);

  const toggleLike = useCallback(async (articleId: number) => {
    if (!userId) return;
    const wasLiked = likedIdsRef.current.has(articleId);

    // Optimistic local flip so the heart fills instantly.
    const applyOptimistic = (liked: boolean) => {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(articleId); else next.delete(articleId);
        return next;
      });
      const mirror = new Set(likedIdsRef.current);
      if (liked) mirror.add(articleId); else mirror.delete(articleId);
      likedIdsRef.current = mirror;
    };
    const dir = wasLiked ? -1 : 1; // unlike removes one, like adds one
    applyOptimistic(!wasLiked);
    bumpDelta(articleId, dir);

    const { error } = wasLiked
      ? await supabase
          .from("user_likes")
          .delete()
          .eq("user_id", userId)
          .eq("article_id", articleId)
      : await supabase
          .from("user_likes")
          .insert({ user_id: userId, article_id: articleId });

    if (error) {
      console.warn("[useLikes] toggle failed — reverting", error.message);
      applyOptimistic(wasLiked);
      bumpDelta(articleId, -dir);
    }
  }, [userId, bumpDelta]);

  const isLiked = useCallback((articleId: number) => likedIds.has(articleId), [likedIds]);

  const likeCountFor = useCallback(
    (article: { id: number; likes: number }) =>
      Math.max(0, (article.likes ?? 0) + (likeDeltas.get(article.id) ?? 0)),
    [likeDeltas],
  );

  const clearLikeDeltas = useCallback(() => {
    setLikeDeltas((prev) => (prev.size === 0 ? prev : new Map()));
  }, []);

  return { likedIds, isLiked, toggleLike, refresh, loading, likeCountFor, clearLikeDeltas };
}

/** Exported so the page can render `<LikesContext.Provider value={likes}>`
 *  inline (reusing its own `useLikesRoot` result — no extra Supabase query). */
export { LikesContext };

/** Consume the likes set from any descendant of the LikesContext provider. */
export function useLikedArticles(): UseLikesResult {
  return useContext(LikesContext);
}
