/**
 * Curation helpers — shared utilities for the manual curation API.
 */

import fs from "node:fs";
import path from "node:path";
import type { RawRSSItem } from "./rss-enricher.js";
import { supabase } from "./supabase-client.js";

const DATA_DIR = path.resolve(process.cwd(), "data");

// ─── Uncurated article type ──────────────────────────────────────────────────

export interface UncuratedArticle {
  title: string;
  source: string;
  pubDate: string;
  link: string;
  dedupRank?: number;
  dedupScore?: number;
  stage: string; // "selected" | "rejected_by_claude" | "deduplicated"
  reason?: string;
  _raw?: { description?: string; imageUrl?: string };
}

// ─── Load uncurated articles from JSON ───────────────────────────────────────

export async function loadUncuratedArticles(feedDate: string): Promise<UncuratedArticle[]> {
  // Try local file first (fast path, works during local dev and same-deploy runs)
  const filePath = path.join(DATA_DIR, "uncurated", `uncurated-${feedDate}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const articles = (data.articles ?? []) as UncuratedArticle[];
      if (articles.length > 0) return articles;
    } catch { /* fall through to Supabase */ }
  }
  // Fall back to Supabase (survives Railway redeploys)
  const { data } = await supabase
    .from("shortlist_candidates")
    .select("idx, title, source, description, pub_date, link, image_url, stage, reason, raw_data")
    .eq("feed_date", feedDate)
    .order("idx", { ascending: true });
  if (!data?.length) return [];
  console.log(`[curation] Loaded ${data.length} candidates from Supabase for ${feedDate}`);
  return data.map((row) => ({
    title: row.title,
    source: row.source,
    pubDate: row.pub_date,
    link: row.link,
    stage: row.stage,
    reason: row.reason ?? undefined,
    _raw: row.raw_data
      ? { description: row.raw_data.description, imageUrl: row.raw_data.imageUrl }
      : undefined,
  })) as UncuratedArticle[];
}

// ─── Fetch OG metadata from a URL ────────────────────────────────────────────

export async function fetchOGMeta(url: string): Promise<{ description: string; imageUrl?: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { description: "" };
    const html = await res.text();
    const descMatch = html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    ) ?? html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i
    );
    const imgMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ) ?? html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    );
    return {
      description: descMatch?.[1] ?? "",
      imageUrl: imgMatch?.[1] ?? undefined,
    };
  } catch {
    return { description: "" };
  }
}

// ─── Resolve article from Supabase by ID ─────────────────────────────────────

export async function resolveArticleBySupabaseId(
  id: number
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

// ─── Convert uncurated article to RawRSSItem ─────────────────────────────────

export async function uncuratedToRawItem(article: UncuratedArticle): Promise<RawRSSItem> {
  let description = article._raw?.description ?? "";
  let imageUrl = article._raw?.imageUrl;

  // If no description from _raw, try fetching OG tags
  if (!description && article.link) {
    const og = await fetchOGMeta(article.link);
    description = og.description;
    if (!imageUrl && og.imageUrl) imageUrl = og.imageUrl;
  }

  return {
    title: article.title,
    description,
    link: article.link,
    pubDate: article.pubDate,
    source: article.source,
    imageUrl,
  };
}
