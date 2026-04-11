import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, sevenDaysAgo } from "./_lib/supabase";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  let query = supabase
    .from("articles")
    .select("*", { count: "exact", head: true })
    .gte("feed_date", sevenDaysAgo());

  // Always gate on stage='prod'
  query = query.eq("stage", "prod");

  const { count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ isLive: true, articleCount: count ?? 0 });
}
