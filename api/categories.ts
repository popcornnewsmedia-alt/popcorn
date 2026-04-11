import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, isProd, sevenDaysAgo } from "./_lib/supabase";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  let query = supabase
    .from("articles")
    .select("category")
    .gte("feed_date", sevenDaysAgo());

  if (isProd()) query = query.eq("stage", "prod");

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const categories = [
    ...new Set((data ?? []).map((r) => r.category as string)),
  ]
    .filter(Boolean)
    .sort();

  res.json({ categories });
}
