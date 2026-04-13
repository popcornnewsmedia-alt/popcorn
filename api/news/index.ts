import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, mapRow, sevenDaysAgo } from "../_lib/supabase";

/**
 * Interleaves articles by category so no two consecutive articles share the same genre.
 * Preserves signal score ordering within each category group.
 * Algorithm: greedy — at each position, pick the highest-signal article whose category
 * was not used in the immediately preceding slot.
 */
function interleaveByCategory<T extends { category?: unknown; signal_score?: unknown }>(articles: T[]): T[] {
  const sorted = [...articles].sort(
    (a, b) => ((b.signal_score as number) ?? 0) - ((a.signal_score as number) ?? 0)
  );
  const result: T[] = [];
  const remaining = [...sorted];

  while (remaining.length > 0) {
    const lastCategory = result.length > 0 ? (result[result.length - 1] as any).category : null;
    const idx = remaining.findIndex((a) => (a as any).category !== lastCategory);
    if (idx === -1) {
      result.push(...remaining.splice(0));
    } else {
      result.push(...remaining.splice(idx, 1));
    }
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const page     = Math.max(1, Number(req.query.page)  || 1);
  const limit    = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const category = req.query.category as string | undefined;

  // Fetch ALL articles for the feed window so we can interleave across the full set,
  // then paginate the interleaved result.
  let query = supabase
    .from("articles")
    .select("*", { count: "exact" })
    .gte("feed_date", sevenDaysAgo())
    .eq("stage", "prod")
    .order("feed_date", { ascending: false })
    .order("signal_score", { ascending: false });

  if (category) query = query.eq("category", category);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const rows = data ?? [];

  // Group by feed_date, interleave within each day, then concatenate
  const dayMap = new Map<string, typeof rows>();
  for (const row of rows) {
    const date = String((row as any).feed_date ?? "").slice(0, 10);
    if (!dayMap.has(date)) dayMap.set(date, []);
    dayMap.get(date)!.push(row);
  }
  const sortedDays = [...dayMap.keys()].sort((a, b) => b.localeCompare(a));
  const interleaved: typeof rows = [];
  for (const day of sortedDays) {
    interleaved.push(...interleaveByCategory(dayMap.get(day)!));
  }

  // Paginate the interleaved result
  const start = (page - 1) * limit;
  const paged = interleaved.slice(start, start + limit);

  res.json({
    articles: paged.map(mapRow),
    total:    count ?? 0,
    page,
    limit,
    hasMore:  (count ?? 0) > page * limit,
  });
}
