/**
 * Curated store — manages the rolling 7-day published feed for Popcorn.
 *
 * Storage layers (in priority order):
 *   1. Supabase `articles` table — primary, survives deploys and machine changes
 *   2. data/feed-YYYY-MM-DD.json — local backup, kept in sync on every write
 *   3. /tmp/popcorn-curated-*.json — ephemeral dev convenience
 *
 * On startup, `loadFromSupabase()` is called to populate the in-memory cache.
 * All reads are served from memory (fast). Writes go to memory + Supabase + local files.
 */

import fs from "node:fs";
import path from "node:path";
import type { EnrichedArticle } from "./rss-enricher.js";
import { supabase } from "./supabase-client.js";

const DATA_DIR = path.resolve(process.cwd(), "data");

// ─── Image URL cleaner ────────────────────────────────────────────────────────

function cleanImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);

    if (u.hostname.includes("dexerto.com")) {
      u.searchParams.delete("quality");
      u.searchParams.delete("format");
      if (u.searchParams.has("width")) u.searchParams.set("width", "1200");
      return u.toString();
    }

    // Guardian CDN requires a signed token — returns 401 everywhere else. Drop it.
    if (u.hostname.includes("guim.co.uk")) return null;

    if (u.searchParams.has("w")) {
      const w = parseInt(u.searchParams.get("w") ?? "0", 10);
      if (w > 0 && w < 1200) u.searchParams.set("w", "1200");
    }
    if (u.searchParams.has("width")) {
      const w = parseInt(u.searchParams.get("width") ?? "0", 10);
      if (w > 0 && w < 1200) u.searchParams.set("width", "1200");
    }
    if (u.searchParams.has("quality")) {
      const q = parseInt(u.searchParams.get("quality") ?? "100", 10);
      if (q < 85) u.searchParams.delete("quality");
    }
    return u.toString();
  } catch {
    return url;
  }
}

// ─── DB ↔ EnrichedArticle mappers ─────────────────────────────────────────────

function articleToRow(a: EnrichedArticle, feedDate: string): Record<string, unknown> {
  return {
    feed_date:          feedDate,
    title:              a.title,
    summary:            a.summary,
    content:            a.content,
    category:           a.category,
    source:             a.source,
    read_time_minutes:  a.readTimeMinutes,
    published_at:       a.publishedAt,
    likes:              a.likes,
    gradient_start:     a.gradientStart,
    gradient_end:       a.gradientEnd,
    tag:                a.tag,
    image_url:          a.imageUrl ?? null,
    image_width:        a.imageWidth ?? null,
    image_height:       a.imageHeight ?? null,
    key_points:         a.keyPoints ?? [],
    signal_score:       a.signalScore ?? null,
    wiki_search_query:  a.wikiSearchQuery ?? null,
  };
}

function rowToArticle(row: Record<string, unknown>, id: number): EnrichedArticle {
  return {
    id,
    title:            String(row.title ?? ""),
    summary:          String(row.summary ?? ""),
    content:          String(row.content ?? ""),
    category:         String(row.category ?? "Internet"),
    source:           String(row.source ?? ""),
    readTimeMinutes:  Number(row.read_time_minutes) || 3,
    publishedAt:      String(row.published_at ?? new Date().toISOString()),
    likes:            Number(row.likes) || 1000,
    isBookmarked:     false,
    gradientStart:    String(row.gradient_start ?? "#080e24"),
    gradientEnd:      String(row.gradient_end ?? "#0e2a5a"),
    tag:              String(row.tag ?? "FEATURE"),
    imageUrl:         row.image_url ? String(row.image_url) : null,
    imageWidth:       row.image_width ? Number(row.image_width) : undefined,
    imageHeight:      row.image_height ? Number(row.image_height) : undefined,
    keyPoints:        Array.isArray(row.key_points) ? row.key_points as string[] : [],
    signalScore:      row.signal_score != null ? Number(row.signal_score) : null,
    wikiSearchQuery:  row.wiki_search_query ? String(row.wiki_search_query) : undefined,
  };
}

// ─── In-memory state ──────────────────────────────────────────────────────────

interface DailyFeed { date: string; articles: EnrichedArticle[]; }

const _feeds = new Map<string, DailyFeed>();

// All-time published titles — used for historical cross-day dedup.
// Populated from Supabase on startup, updated on every publish.
const _allPublishedTitles = new Set<string>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateStr(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function feedPath(date: string): string {
  return path.join("/tmp", `popcorn-curated-${date}.json`);
}

function committedFeedPath(date: string): string {
  return path.join(DATA_DIR, `feed-${date}.json`);
}

function saveToLocalFiles(bucket: DailyFeed): void {
  try {
    fs.writeFileSync(feedPath(bucket.date), JSON.stringify(bucket, null, 2));
  } catch { /* ignore */ }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (bucket.articles.length > 0) {
      fs.writeFileSync(committedFeedPath(bucket.date), JSON.stringify(bucket, null, 2));
    }
  } catch { /* ignore */ }
}

// ─── Supabase persistence (async, fire-and-forget) ────────────────────────────

async function upsertFeedToSupabase(articles: EnrichedArticle[], feedDate: string): Promise<void> {
  if (!process.env.SUPABASE_URL) return;
  // Delete the day's existing rows, then re-insert fresh
  const { error: delErr } = await supabase.from("articles").delete().eq("feed_date", feedDate);
  if (delErr) { console.warn("[supabase] delete error:", delErr.message); return; }
  if (articles.length === 0) return;
  const rows = articles.map((a) => articleToRow(a, feedDate));
  const { error: insErr } = await supabase.from("articles").insert(rows);
  if (insErr) console.warn("[supabase] insert error:", insErr.message);
}

async function deleteFromSupabase(titles: string[]): Promise<void> {
  if (!process.env.SUPABASE_URL || titles.length === 0) return;
  const { error } = await supabase.from("articles").delete().in("title", titles);
  if (error) console.warn("[supabase] delete error:", error.message);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load the last 7 days of articles from Supabase into memory.
 * Also loads ALL historical titles for cross-day dedup.
 * Call once on server startup (replaces loadDailyFeed + loadCommittedFeeds).
 */
export async function loadFromSupabase(): Promise<void> {
  if (!process.env.SUPABASE_URL) {
    // Fall back to local files if Supabase isn't configured
    _loadFromLocalFiles();
    return;
  }

  try {
    // Last 7 days into _feeds
    const cutoff = dateStr(6);
    const { data: rows, error } = await supabase
      .from("articles")
      .select("*")
      .gte("feed_date", cutoff)
      .order("published_at", { ascending: false });

    if (error) throw error;

    _feeds.clear();
    for (const row of (rows ?? []) as Record<string, unknown>[]) {
      const date = String(row.feed_date ?? "").slice(0, 10);
      if (!_feeds.has(date)) _feeds.set(date, { date, articles: [] });
      _feeds.get(date)!.articles.push(rowToArticle(row, 0)); // id reassigned by getPublishedFeed
    }

    let totalLoaded = 0;
    for (const [date, bucket] of _feeds.entries()) {
      // Sort within bucket and re-index
      bucket.articles.sort((a, b) => (b.signalScore ?? 0) - (a.signalScore ?? 0));
      bucket.articles = bucket.articles.map((a, i) => ({ ...a, id: i + 1 }));
      totalLoaded += bucket.articles.length;
      console.log(`[curated] ✓ Loaded ${bucket.articles.length} articles from Supabase (${date})`);
    }
    if (totalLoaded === 0) {
      console.log("[curated] No articles in Supabase yet — will try local files.");
      _loadFromLocalFiles();
    }

    // All-time titles for historical dedup
    const { data: titleRows, error: titleErr } = await supabase
      .from("articles")
      .select("title");
    if (titleErr) throw titleErr;
    _allPublishedTitles.clear();
    for (const row of (titleRows ?? []) as { title: string }[]) {
      _allPublishedTitles.add(row.title);
    }
    console.log(`[curated] ✓ ${_allPublishedTitles.size} total historical titles loaded for dedup.`);
  } catch (e) {
    console.warn("[curated] Supabase load failed, falling back to local files:", (e as Error).message);
    _loadFromLocalFiles();
  }
}

/** Internal: populate _feeds from local JSON files (fallback path). */
function _loadFromLocalFiles(): void {
  _feeds.clear();
  for (let i = 0; i < 7; i++) {
    const date = dateStr(i);
    // Try /tmp first, then data/
    for (const fp of [feedPath(date), committedFeedPath(date)]) {
      if (!fs.existsSync(fp)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(fp, "utf-8")) as DailyFeed;
        if (parsed.date === date && Array.isArray(parsed.articles) && parsed.articles.length > 0) {
          _feeds.set(date, parsed);
          for (const a of parsed.articles) _allPublishedTitles.add(a.title);
          console.log(`[curated] ✓ Loaded ${parsed.articles.length} articles from local file (${date})`);
          break;
        }
      } catch { /* ignore */ }
    }
  }
  // Scan all historical data/ files for dedup titles
  if (fs.existsSync(DATA_DIR)) {
    for (const file of fs.readdirSync(DATA_DIR)) {
      if (!/^feed-\d{4}-\d{2}-\d{2}\.json$/.test(file)) continue;
      const date = file.replace("feed-", "").replace(".json", "");
      if (_feeds.has(date)) continue;
      try {
        const parsed = JSON.parse(
          fs.readFileSync(path.join(DATA_DIR, file), "utf-8")
        ) as { articles: EnrichedArticle[] };
        for (const a of parsed.articles ?? []) _allPublishedTitles.add(a.title);
      } catch { /* ignore */ }
    }
  }
}

export function resetIfNewDay(): void {
  const today = dateStr(0);
  if (!_feeds.has(today)) _feeds.set(today, { date: today, articles: [] });
  for (const key of _feeds.keys()) {
    const age = Math.round((Date.now() - new Date(key).getTime()) / 86_400_000);
    if (age >= 7) _feeds.delete(key);
  }
}

export function mergeFeed(newArticles: EnrichedArticle[]): number {
  resetIfNewDay();
  const today = dateStr(0);
  const existingTitles = new Set(
    [..._feeds.values()]
      .flatMap((f) => f.articles)
      .map((a) => a.title.toLowerCase().replace(/[^a-z0-9]/g, ""))
  );
  const toAdd = newArticles.filter(
    (a) => !existingTitles.has(a.title.toLowerCase().replace(/[^a-z0-9]/g, ""))
  );
  if (toAdd.length === 0) {
    console.log("[curated] No new articles to add — feed unchanged.");
    return 0;
  }
  const bucket = _feeds.get(today)!;
  bucket.articles = [...bucket.articles, ...toAdd]
    .sort((a, b) => (b.signalScore ?? 0) - (a.signalScore ?? 0))
    .map((a, i) => ({ ...a, id: i + 1 }));
  // Update all-time title set
  for (const a of toAdd) _allPublishedTitles.add(a.title);
  console.log(`[curated] Added ${toAdd.length} articles → today has ${bucket.articles.length} stories.`);
  return toAdd.length;
}

export function getPublishedFeed(): EnrichedArticle[] {
  resetIfNewDay();
  return [..._feeds.values()]
    .flatMap((f) => f.articles)
    .sort((a, b) => {
      const dayA = new Date(a.publishedAt).setHours(0, 0, 0, 0);
      const dayB = new Date(b.publishedAt).setHours(0, 0, 0, 0);
      if (dayB !== dayA) return dayB - dayA;
      return (b.signalScore ?? 0) - (a.signalScore ?? 0);
    })
    .map((a, i) => ({ ...a, id: i + 1, imageUrl: cleanImageUrl(a.imageUrl) ?? a.imageUrl }));
}

export function removeArticles(ids: number[]): number {
  const globalFeed = getPublishedFeed();
  const titlesToRemove = new Set(
    globalFeed.filter((a) => ids.includes(a.id)).map((a) => a.title)
  );
  if (titlesToRemove.size === 0) return 0;

  let removed = 0;
  for (const [, bucket] of _feeds.entries()) {
    const before = bucket.articles.length;
    bucket.articles = bucket.articles
      .filter((a) => !titlesToRemove.has(a.title))
      .map((a, i) => ({ ...a, id: i + 1 }));
    removed += before - bucket.articles.length;
    saveToLocalFiles(bucket);
  }

  // Remove from all-time titles set
  for (const t of titlesToRemove) _allPublishedTitles.delete(t);

  // Persist removal to Supabase (fire-and-forget)
  deleteFromSupabase([...titlesToRemove]).catch((e) =>
    console.warn("[curated] Supabase delete failed:", (e as Error).message)
  );

  console.log(`[curated] ✓ Removed ${removed} articles.`);
  return removed;
}

/** Dedup refs for the current 7-day window (used in shortlist workflow). */
export function getPublishedRefs(): { title: string; link: string }[] {
  resetIfNewDay();
  return [..._feeds.values()].flatMap((f) => f.articles).map((a) => ({ title: a.title, link: "" }));
}

/**
 * All-time published title refs for cross-day historical dedup.
 * Reads from the in-memory Set populated at startup — no file/DB scan needed.
 */
export function getAllPublishedRefs(): { title: string; link: string }[] {
  return [..._allPublishedTitles].map((title) => ({ title, link: "" }));
}

export function resetTodayFeed(): void {
  const today = dateStr(0);
  _feeds.delete(today);
  try { const fp = feedPath(today); if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
  _feeds.set(today, { date: today, articles: [] });
  // Wipe today from Supabase too (fire-and-forget)
  if (process.env.SUPABASE_URL) {
    supabase.from("articles").delete().eq("feed_date", today)
      .then(({ error }) => { if (error) console.warn("[supabase] reset delete error:", error.message); })
      .catch(() => {});
  }
  console.log("[curated] ✓ Today's feed reset.");
}

/** Persist today's feed to local files + Supabase. */
export function saveCommittedFeed(): void {
  resetIfNewDay();
  const today = dateStr(0);
  const bucket = _feeds.get(today)!;
  // Local file backup
  saveToLocalFiles(bucket);
  console.log(`[curated] ✓ Local feed saved (${bucket.articles.length} articles)`);
  // Supabase (fire-and-forget)
  upsertFeedToSupabase(bucket.articles, today).catch((e) =>
    console.warn("[curated] Supabase sync failed:", (e as Error).message)
  );
}

/** @deprecated Use saveCommittedFeed() — kept for call-site compatibility. */
export function saveDailyFeed(): void { saveCommittedFeed(); }

/** @deprecated No-op — Supabase + local files loaded via loadFromSupabase(). */
export function loadDailyFeed(): void { /* no-op */ }

/** @deprecated No-op — loadFromSupabase() handles all sources. */
export function loadCommittedFeeds(): void { /* no-op */ }
