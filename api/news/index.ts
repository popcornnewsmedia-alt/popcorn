import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, mapRow, isProd, sevenDaysAgo } from "../_lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const page     = Math.max(1, Number(req.query.page)  || 1);
  const limit    = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const category = req.query.category as string | undefined;

  let query = supabase
    .from("articles")
    .select("*", { count: "exact" })
    .gte("feed_date", sevenDaysAgo())
    .order("published_at", { ascending: false })
    .order("signal_score",  { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (isProd()) query = query.eq("stage", "prod");
  if (category) query = query.eq("category", category);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({
    articles: (data ?? []).map(mapRow),
    total:    count  ?? 0,
    page,
    limit,
    hasMore:  (count ?? 0) > page * limit,
  });
}
