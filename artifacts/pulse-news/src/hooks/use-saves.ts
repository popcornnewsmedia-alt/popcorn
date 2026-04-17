import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * useSaves — per-user saved articles, backed by the `saved_articles` Supabase
 * table. Replaces the old client-only `isBookmarked` which lived in the
 * react-query cache (and therefore never synced between devices).
 *
 * Exposed via a provider + context so the top-level feed page owns the
 * single Supabase query; every ArticleCard / ActionButtons / ArticleReader
 * consumer re-uses that same Set instead of each running its own fetch.
 */
export interface UseSavesResult {
  savedIds: Set<number>;
  isSaved: (articleId: number) => boolean;
  toggleSave: (articleId: number) => Promise<void>;
  /** Manually refresh from the server (e.g. after reconnect / focus). */
  refresh: () => Promise<void>;
  loading: boolean;
}

const EMPTY_SET: Set<number> = new Set();

const SavesContext = createContext<UseSavesResult>({
  savedIds: EMPTY_SET,
  isSaved: () => false,
  toggleSave: async () => {},
  refresh: async () => {},
  loading: false,
});

/** Root hook — call this ONCE in the feed page (single Supabase query),
 *  then expose the result to descendants via `<SavesContext.Provider value={...}>`.
 *  The page can also read it locally to filter the saved-tab list. */
export function useSavesRoot(user: User | null): UseSavesResult {
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  // Ref mirror so `toggleSave` can read the freshest set without listing
  // `savedIds` as a dep (which would rebuild the callback on every flip).
  const savedIdsRef = useRef(savedIds);
  savedIdsRef.current = savedIds;

  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setSavedIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("saved_articles")
        .select("article_id")
        .eq("user_id", userId);
      if (error) {
        console.warn("[useSaves] refresh error", error.message);
        return;
      }
      const next = new Set<number>();
      for (const row of data ?? []) next.add(row.article_id as number);
      setSavedIds(next);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load + reload when the signed-in user changes.
  useEffect(() => { void refresh(); }, [refresh]);

  // Cross-device sync: re-fetch on visibility / focus / reconnect. Realtime
  // would be nicer but polling on focus is enough for a bookmark list.
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

  const toggleSave = useCallback(async (articleId: number) => {
    if (!userId) return;
    const wasSaved = savedIdsRef.current.has(articleId);

    // Optimistic local flip so the icon toggles instantly.
    const applyOptimistic = (saved: boolean) => {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (saved) next.add(articleId); else next.delete(articleId);
        return next;
      });
      const mirror = new Set(savedIdsRef.current);
      if (saved) mirror.add(articleId); else mirror.delete(articleId);
      savedIdsRef.current = mirror;
    };
    applyOptimistic(!wasSaved);

    const { error } = wasSaved
      ? await supabase
          .from("saved_articles")
          .delete()
          .eq("user_id", userId)
          .eq("article_id", articleId)
      : await supabase
          .from("saved_articles")
          .insert({ user_id: userId, article_id: articleId });

    if (error) {
      console.warn("[useSaves] toggle failed — reverting", error.message);
      applyOptimistic(wasSaved);
    }
  }, [userId]);

  const isSaved = useCallback((articleId: number) => savedIds.has(articleId), [savedIds]);

  return { savedIds, isSaved, toggleSave, refresh, loading };
}

/** Exported so the feed page can render `<SavesContext.Provider value={saves}>`
 *  inline (reusing its own `useSavesRoot` result — no extra Supabase query). */
export { SavesContext };

/** Consume the saves set from any descendant of the SavesContext provider. */
export function useSavedArticles(): UseSavesResult {
  return useContext(SavesContext);
}
