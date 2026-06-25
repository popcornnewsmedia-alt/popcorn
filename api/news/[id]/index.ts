import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, mapRow } from "../../_lib/supabase";
import { getLikeCountsByArticle } from "../../_lib/like-counts";

/**
 * GET /api/news/:id — a single article by id.
 *
 * Reads straight from Supabase with the service role, so it resolves ANY
 * article (not just the current in-memory feed window) and works for
 * logged-out visitors opening a shared link. Used by the shared-article web
 * route (/a/:id).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Not found" });

  // Seed + real likes, consistent with the feed endpoint.
  const article = mapRow(data);
  const likeCounts = await getLikeCountsByArticle();
  article.likes = ((article.likes as number) ?? 0) + (likeCounts.get(article.id as number) ?? 0);

  res.json({ article });
}
