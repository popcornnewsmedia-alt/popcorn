/**
 * Real like counts — aggregates the per-user `user_likes` table into a
 * per-article total, so the feed can display `seed + real likes`.
 *
 * The displayed like count for an article is its seed (a fixed starter value
 * stored on the article row) PLUS the number of real users who have liked it.
 * Real likes live in `user_likes` (one row per user per article), which is the
 * source of truth and is what makes likes additive across users and devices.
 *
 * Counts are cached briefly so a single feed load (which fires several
 * paginated requests) doesn't re-scan the table each time. The short TTL means
 * a manual feed refresh a few seconds later reflects new likes — no realtime
 * subscription required.
 */

import { supabase } from "./supabase-client.js";

let _cache: { at: number; counts: Map<number, number> } | null = null;
const TTL_MS = 5_000;

/**
 * Returns a map of article id → number of real likes (from `user_likes`).
 * Articles with no real likes are simply absent from the map.
 */
export async function getLikeCountsByArticle(): Promise<Map<number, number>> {
  const now = Date.now();
  if (_cache && now - _cache.at < TTL_MS) return _cache.counts;

  const counts = new Map<number, number>();
  if (!process.env.SUPABASE_URL) {
    _cache = { at: now, counts };
    return counts;
  }

  try {
    const PAGE = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("user_likes")
        .select("article_id")
        .range(from, from + PAGE - 1);
      if (error) {
        console.warn("[likes] count query error:", error.message);
        break;
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const id = Number((row as { article_id: number }).article_id);
        if (!Number.isFinite(id)) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
  } catch (e) {
    console.warn("[likes] count query threw:", (e as Error).message);
  }

  _cache = { at: now, counts };
  return counts;
}

/** Force the next call to re-query (e.g. right after a known like change). */
export function invalidateLikeCounts(): void {
  _cache = null;
}
