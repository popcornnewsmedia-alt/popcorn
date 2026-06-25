import type { NewsArticle } from "@workspace/api-client-react";

/**
 * Fetches a single article by id for the shared-article web route (/a/:id).
 *
 * Hits the same-origin Vercel function (GET /api/news/:id), which reads from
 * Supabase with the service role — so it resolves any article and works for a
 * logged-out visitor opening a shared link. Returns null if the article
 * doesn't exist or the request fails.
 */
export async function fetchArticleById(id: number): Promise<NewsArticle | null> {
  try {
    const res = await fetch(`/api/news/${id}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { article?: NewsArticle };
    return json.article ?? null;
  } catch {
    return null;
  }
}
