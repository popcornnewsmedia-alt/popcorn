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
import { processAndUploadImage } from "./image-processor.js";

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

function articleToRow(a: EnrichedArticle, feedDate: string, stage: 'dev' | 'prod' = 'dev'): Record<string, unknown> {
  return {
    feed_date:          feedDate,
    stage,
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
    source_link:        a.link ?? null,
    image_url:          a.imageUrl ?? null,
    source_image_url:   a.sourceImageUrl ?? null,
    image_width:        a.imageWidth ?? null,
    image_height:       a.imageHeight ?? null,
    image_focal_x:      a.imageFocalX ?? null,
    image_focal_y:      a.imageFocalY ?? null,
    image_safe_w:       a.imageSafeW ?? null,
    image_safe_h:       a.imageSafeH ?? null,
    image_credit:       a.imageCredit ?? null,
    key_points:         a.keyPoints ?? [],
    signal_score:       a.signalScore ?? null,
    wiki_search_query:  a.wikiSearchQuery ?? null,
  };
}

function rowToArticle(row: Record<string, unknown>): EnrichedArticle {
  return {
    id:               Number(row.id) || 0,
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
    link:             row.source_link ? String(row.source_link) : null,
    imageUrl:         row.image_url ? String(row.image_url) : null,
    sourceImageUrl:   row.source_image_url ? String(row.source_image_url) : null,
    imageWidth:       row.image_width ? Number(row.image_width) : undefined,
    imageHeight:      row.image_height ? Number(row.image_height) : undefined,
    imageFocalX:      row.image_focal_x != null ? Number(row.image_focal_x) : undefined,
    imageFocalY:      row.image_focal_y != null ? Number(row.image_focal_y) : undefined,
    imageSafeW:       row.image_safe_w  != null ? Number(row.image_safe_w)  : undefined,
    imageSafeH:       row.image_safe_h  != null ? Number(row.image_safe_h)  : undefined,
    imageCredit:      row.image_credit ? String(row.image_credit) : null,
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

// schemaVersion 2 = articles[].id is the stable Supabase row id.
// schemaVersion 1 (or missing) = legacy synthetic 1..N id, must NOT be trusted
// for saved_articles / comments FK joins.
const LOCAL_FILE_SCHEMA_VERSION = 2;

function saveToLocalFiles(bucket: DailyFeed): void {
  const payload = { schemaVersion: LOCAL_FILE_SCHEMA_VERSION, ...bucket };
  try {
    fs.writeFileSync(feedPath(bucket.date), JSON.stringify(payload, null, 2));
  } catch { /* ignore */ }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (bucket.articles.length > 0) {
      fs.writeFileSync(committedFeedPath(bucket.date), JSON.stringify(payload, null, 2));
    }
  } catch { /* ignore */ }
}

// ─── Supabase persistence (async, fire-and-forget) ────────────────────────────

// Drop optional columns that the Supabase schema may not yet have. Lets us
// ship new fields (e.g. image_focal_x/y, image_safe_w/h) without breaking
// environments that haven't run the ALTER TABLE migration yet.
function stripUnknownColumns(row: Record<string, unknown>): Record<string, unknown> {
  const {
    image_focal_x, image_focal_y, // eslint-disable-line @typescript-eslint/no-unused-vars
    image_safe_w,  image_safe_h,  // eslint-disable-line @typescript-eslint/no-unused-vars
    image_credit,                 // eslint-disable-line @typescript-eslint/no-unused-vars
    source_link,                  // eslint-disable-line @typescript-eslint/no-unused-vars
    ...rest
  } = row;
  return rest;
}

function isMissingColumnError(msg: string | undefined): boolean {
  if (!msg) return false;
  return /image_focal|image_safe|image_credit|source_link|column.*does not exist|schema cache/i.test(msg);
}

/**
 * Process images for an array of articles BEFORE they get written to Supabase.
 * Downloads each source image, resizes to 1080px JPEG, uploads to the
 * `article-images` Storage bucket, and mutates `article.imageUrl` (plus
 * width/height) to point at the Storage public URL.
 *
 * Any image that fails to process keeps its original URL — we never want a
 * slow / broken image to block a curation run. Runs with limited concurrency
 * so we don't hammer source CDNs.
 *
 * NOTE: this only touches the in-memory article objects. It does NOT rewrite
 * any existing DB rows — that happens naturally when the caller inserts the
 * mutated articles via articleToRow().
 */
async function processImagesForArticles(
  articles: EnrichedArticle[],
  feedDate: string,
): Promise<void> {
  // Only articles with a real http(s) imageUrl — skip placeholders and missing.
  const targets = articles.filter(
    (a) =>
      a.imageUrl &&
      typeof a.imageUrl === "string" &&
      /^https?:\/\//.test(a.imageUrl) &&
      !a.imageUrl.startsWith("__NEEDS_OG__") &&
      // Skip articles that are already pointing at our Storage bucket
      // (re-runs of curation on the same day shouldn't re-process).
      !a.imageUrl.includes("/storage/v1/object/public/article-images/"),
  );
  if (targets.length === 0) return;

  console.log(`[image-processor] processing ${targets.length} images → Storage`);

  // Limit concurrency to 4 — sharp is CPU-bound and network fetches can stall,
  // so 4 is a safe sweet spot that keeps the curation run fast without
  // overloading the machine or getting rate-limited by source CDNs.
  const CONCURRENCY = 4;
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (article) => {
        const originalUrl = article.imageUrl!;
        const result = await processAndUploadImage(originalUrl, feedDate);
        if (result) {
          // Preserve the original third-party URL BEFORE overwriting imageUrl
          // with the Supabase Storage URL — enables future backfills at a
          // higher-quality target without re-running Claude enrichment.
          article.sourceImageUrl = originalUrl;
          article.imageUrl = result.url;
          article.imageWidth = result.width;
          article.imageHeight = result.height;
          article.imageCredit = result.credit;
          processed++;
        } else {
          failed++;
        }
      }),
    );
  }

  console.log(
    `[image-processor] ✓ ${processed} uploaded, ${failed} kept original URL`,
  );
}

async function upsertFeedToSupabase(
  articles: EnrichedArticle[],
  feedDate: string,
  targetStage: 'dev' | 'prod' = 'dev'
): Promise<void> {
  if (!process.env.SUPABASE_URL) return;
  if (articles.length === 0) return;

  // STABLE-ID: never DELETE existing rows (that recycles BIGSERIAL ids on every save).
  // Skip-existing-by-title: only INSERT articles that don't already exist in this date.
  // Removals are handled separately by removeArticlesBySupabaseId (DELETE by id).
  const { data: existingRows } = await supabase
    .from("articles")
    .select("title, stage")
    .eq("feed_date", feedDate);
  const existingTitles = new Set(
    (existingRows ?? []).map((r: { title: string }) => r.title),
  );

  const toInsert = articles.filter((a) => !existingTitles.has(a.title));

  // ─── Image processing ───────────────────────────────────────────────────────
  // Run the download → resize → upload pipeline on just the new articles
  // (existing prod rows are excluded above, so they're never touched). Any
  // image that processes successfully gets its `imageUrl` mutated in-place
  // before articleToRow() captures it. This is the ONLY place new articles
  // get their images rewritten — keeps the change surgical.
  await processImagesForArticles(toInsert, feedDate);

  const newRows = toInsert.map((a) => articleToRow(a, feedDate, targetStage));

  if (newRows.length === 0) {
    console.log("[supabase] All articles for", feedDate, "already exist as prod — nothing to insert.");
    return;
  }

  console.log(`[supabase] Inserting ${newRows.length} articles as stage='${targetStage}'`);
  const { error: insErr } = await supabase.from("articles").insert(newRows);
  if (insErr) {
    if (isMissingColumnError(insErr.message)) {
      console.warn(
        "[supabase] focal/safe-box columns missing — retrying without them. " +
        "To enable full image-awareness persistence, run: " +
        "ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_focal_x float8, " +
        "ADD COLUMN IF NOT EXISTS image_focal_y float8, " +
        "ADD COLUMN IF NOT EXISTS image_safe_w float8, " +
        "ADD COLUMN IF NOT EXISTS image_safe_h float8;"
      );
      const safeRows = newRows.map(stripUnknownColumns);
      const { error: retryErr } = await supabase.from("articles").insert(safeRows);
      if (retryErr) console.warn("[supabase] retry insert error:", retryErr.message);
    } else {
      console.warn("[supabase] insert error:", insErr.message);
    }
  }
}

/**
 * Given a list of source links, return a map of link → preserved image data
 * for any article previously published with that link. Used to avoid
 * re-running image selection (and potentially losing the original image)
 * when an article is re-added via /api/curation/add or the pool-add script.
 *
 * Returns an empty map if the source_link column hasn't been created yet
 * (graceful fallback for environments that haven't run the migration).
 */
export interface PreservedImageData {
  imageUrl: string | null;
  sourceImageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageFocalX: number | null;
  imageFocalY: number | null;
  imageSafeW: number | null;
  imageSafeH: number | null;
  imageCredit: string | null;
}

export async function lookupPreservedImagesByLinks(
  links: string[],
): Promise<Map<string, PreservedImageData>> {
  const result = new Map<string, PreservedImageData>();
  if (!process.env.SUPABASE_URL || links.length === 0) return result;

  const filtered = [...new Set(links.filter(Boolean))];
  if (filtered.length === 0) return result;

  const { data, error } = await supabase
    .from("articles")
    .select(
      "source_link,image_url,source_image_url,image_width,image_height,image_focal_x,image_focal_y,image_safe_w,image_safe_h,image_credit",
    )
    .in("source_link", filtered);

  if (error) {
    if (isMissingColumnError(error.message)) {
      console.warn(
        "[preserve-image] source_link column missing — cannot match re-added articles to originals. " +
          "Run: ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_link TEXT; " +
          "CREATE INDEX IF NOT EXISTS idx_articles_source_link ON articles(source_link);",
      );
      return result;
    }
    console.warn("[preserve-image] lookup error:", error.message);
    return result;
  }

  for (const row of data ?? []) {
    const link = (row as { source_link?: string }).source_link;
    if (!link) continue;
    // Prefer the most recent row for the link — the query is ordered by
    // created_at desc in Supabase by default on ties, but we'll pick the
    // first image_url we see since duplicates are fine.
    if (result.has(link)) continue;
    result.set(link, {
      imageUrl: (row as any).image_url ? String((row as any).image_url) : null,
      sourceImageUrl: (row as any).source_image_url
        ? String((row as any).source_image_url)
        : null,
      imageWidth:
        (row as any).image_width != null ? Number((row as any).image_width) : null,
      imageHeight:
        (row as any).image_height != null ? Number((row as any).image_height) : null,
      imageFocalX:
        (row as any).image_focal_x != null ? Number((row as any).image_focal_x) : null,
      imageFocalY:
        (row as any).image_focal_y != null ? Number((row as any).image_focal_y) : null,
      imageSafeW:
        (row as any).image_safe_w != null ? Number((row as any).image_safe_w) : null,
      imageSafeH:
        (row as any).image_safe_h != null ? Number((row as any).image_safe_h) : null,
      imageCredit: (row as any).image_credit
        ? String((row as any).image_credit)
        : null,
    });
  }

  if (result.size > 0) {
    console.log(
      `[preserve-image] Found ${result.size} previously-published article(s) — will reuse original images.`,
    );
  }
  return result;
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
      _feeds.get(date)!.articles.push(rowToArticle(row));
    }

    let totalLoaded = 0;
    for (const [date, bucket] of _feeds.entries()) {
      // Sort by score then interleave to avoid category clustering (same as mergeFeed).
      // IDs are preserved from Supabase — no synthetic reassignment.
      bucket.articles = interleaveByCategory(bucket.articles);
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
        const parsed = JSON.parse(fs.readFileSync(fp, "utf-8")) as DailyFeed & { schemaVersion?: number };
        if (parsed.date === date && Array.isArray(parsed.articles) && parsed.articles.length > 0) {
          // Guard against legacy files (schemaVersion < 2) whose ids are synthetic
          // 1..N — using them would corrupt saved_articles / comments FKs.
          if ((parsed.schemaVersion ?? 1) < LOCAL_FILE_SCHEMA_VERSION) {
            console.warn(
              `[curated] ⚠ Local file ${fp} is schemaVersion=${parsed.schemaVersion ?? 1} (legacy synthetic ids). ` +
                `Setting article.id=0 — saves/comments will fail loudly until Supabase reload succeeds.`,
            );
            for (const a of parsed.articles) (a as EnrichedArticle).id = 0;
          }
          _feeds.set(date, { date: parsed.date, articles: parsed.articles });
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

/**
 * Interleaves articles by category so no two consecutive articles share the same genre.
 * Preserves signal score ordering within each category group.
 * Algorithm: greedy — at each position, pick the highest-signal article whose category
 * was not used in the immediately preceding slot.
 */
function interleaveByCategory(articles: EnrichedArticle[]): EnrichedArticle[] {
  // Sort by signalScore descending as base order
  const sorted = [...articles].sort((a, b) => (b.signalScore ?? 0) - (a.signalScore ?? 0));
  const result: EnrichedArticle[] = [];
  const remaining = [...sorted];

  while (remaining.length > 0) {
    const lastCategory = result.length > 0 ? result[result.length - 1].category : null;
    // Find highest-signal article with a different category
    const idx = remaining.findIndex((a) => a.category !== lastCategory);
    if (idx === -1) {
      // All remaining share the same category — just append in order
      result.push(...remaining.splice(0));
    } else {
      result.push(...remaining.splice(idx, 1));
    }
  }
  return result;
}

export async function mergeFeed(
  newArticles: EnrichedArticle[],
  options: { stage?: 'dev' | 'prod' } = {},
): Promise<number> {
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

  // STABLE-ID: persist to Supabase FIRST so the new rows get assigned BIGSERIAL ids.
  // Then re-source the day from Supabase so in-memory copies carry the stable ids.
  // No mid-state with id=0 is ever observable to /api/news.
  await upsertFeedToSupabase(toAdd, today, options.stage ?? 'dev');
  await reloadDayFromSupabase(today);

  for (const a of toAdd) _allPublishedTitles.add(a.title);
  const bucket = _feeds.get(today);
  console.log(`[curated] Added ${toAdd.length} articles → today has ${bucket?.articles.length ?? 0} stories.`);
  return toAdd.length;
}

/**
 * Re-read a single day from Supabase into _feeds. Used after mergeFeed inserts
 * new rows so the in-memory cache picks up the freshly-assigned BIGSERIAL ids.
 */
async function reloadDayFromSupabase(date: string): Promise<void> {
  if (!process.env.SUPABASE_URL) return;
  const { data: rows, error } = await supabase
    .from("articles")
    .select("*")
    .eq("feed_date", date)
    .order("id", { ascending: true });
  if (error || !rows) {
    console.warn("[curated] reloadDayFromSupabase failed:", error?.message);
    return;
  }
  const articles = (rows as Record<string, unknown>[]).map(rowToArticle);
  _feeds.set(date, { date, articles: interleaveByCategory(articles) });
  saveToLocalFiles(_feeds.get(date)!);
}

export function getPublishedFeed(): EnrichedArticle[] {
  resetIfNewDay();
  // Get day buckets sorted newest-first, interleave within each day
  const dayBuckets = [..._feeds.entries()]
    .sort(([a], [b]) => b.localeCompare(a)); // newest date first
  const ordered: EnrichedArticle[] = [];
  for (const [dateKey, bucket] of dayBuckets) {
    const interleaved = interleaveByCategory(bucket.articles);
    // Tag each article with its feed date so the frontend can group by curation date
    for (const a of interleaved) {
      (a as any).feedDate = dateKey;
    }
    ordered.push(...interleaved);
  }
  // IDs are stable Supabase row ids — preserved across requests/restarts.
  return ordered.map((a) => ({ ...a, imageUrl: cleanImageUrl(a.imageUrl) ?? a.imageUrl }));
}

export function removeArticles(ids: number[]): number {
  if (ids.length === 0) return 0;
  const idSet = new Set(ids);

  // Capture titles of articles we are removing (for _allPublishedTitles cleanup
  // and the legacy title-based Supabase delete fallback). Match by stable id —
  // never by title — so we don't accidentally wipe yesterday's republished
  // story that shares the same headline.
  const removedTitles = new Set<string>();
  let removed = 0;
  for (const [, bucket] of _feeds.entries()) {
    const before = bucket.articles.length;
    for (const a of bucket.articles) {
      if (idSet.has(a.id)) removedTitles.add(a.title);
    }
    bucket.articles = bucket.articles.filter((a) => !idSet.has(a.id));
    removed += before - bucket.articles.length;
    saveToLocalFiles(bucket);
  }

  if (removed === 0) return 0;

  // Remove from all-time titles set
  for (const t of removedTitles) _allPublishedTitles.delete(t);

  // Persist removal to Supabase by id (fire-and-forget). Falls back to titles
  // for callers that hit this path with synthetic ids (shouldn't happen post-
  // stable-id, but keeps backwards compat for any stragglers).
  if (process.env.SUPABASE_URL) {
    void (async () => {
      const { error } = await supabase.from("articles").delete().in("id", ids);
      if (error) console.warn("[curated] Supabase delete by id failed:", error.message);
    })();
  }

  console.log(`[curated] ✓ Removed ${removed} articles.`);
  return removed;
}

/**
 * Remove articles by their stable Supabase IDs.
 * Queries Supabase for titles, then removes from in-memory feeds + Supabase.
 * No server restart needed.
 */
export async function removeArticlesBySupabaseId(
  supabaseIds: number[]
): Promise<{ removed: number; articles: { id: number; title: string; feedDate: string }[] }> {
  if (supabaseIds.length === 0) return { removed: 0, articles: [] };

  // 1. Look up titles + feed_date from Supabase
  const { data: rows, error } = await supabase
    .from("articles")
    .select("id, title, feed_date")
    .in("id", supabaseIds);
  if (error || !rows?.length) return { removed: 0, articles: [] };

  const titlesToRemove = new Set(rows.map((r: any) => String(r.title)));
  const result = rows.map((r: any) => ({
    id: Number(r.id),
    title: String(r.title),
    feedDate: String(r.feed_date),
  }));

  // 2. Remove from in-memory feeds by stable Supabase id (no title fallback —
  //    title matching can wipe yesterday's republished story sharing the same
  //    headline). IDs are unique across days.
  const idSet = new Set(supabaseIds);
  let removed = 0;
  for (const [, bucket] of _feeds.entries()) {
    const before = bucket.articles.length;
    bucket.articles = bucket.articles.filter((a) => !idSet.has(a.id));
    removed += before - bucket.articles.length;
    saveToLocalFiles(bucket);
  }

  // 3. Remove from all-time titles set
  for (const t of titlesToRemove) _allPublishedTitles.delete(t);

  // 4. Delete from Supabase by ID (stable, no cross-date collisions)
  const { error: delErr } = await supabase
    .from("articles")
    .delete()
    .in("id", supabaseIds);
  if (delErr) console.warn("[curated] Supabase delete by ID failed:", delErr.message);

  console.log(`[curated] ✓ Removed ${removed} articles by Supabase ID.`);
  return { removed, articles: result };
}

/**
 * Update an article's image fields in-memory (by title match across all date buckets).
 * Also saves to local files and updates Supabase.
 */
export async function updateArticleImageInMemory(
  supabaseId: number,
  updates: {
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    imageCredit?: string;
    imageFocalX?: number | null;
    imageFocalY?: number | null;
    imageSafeW?: number | null;
    imageSafeH?: number | null;
  }
): Promise<void> {
  // 1. Update in-memory by stable Supabase id (no title lookup needed).
  for (const [, bucket] of _feeds.entries()) {
    let mutated = false;
    for (const article of bucket.articles) {
      if (article.id !== supabaseId) continue;
      article.imageUrl = updates.imageUrl;
      article.imageWidth = updates.imageWidth;
      article.imageHeight = updates.imageHeight;
      if (updates.imageCredit != null) article.imageCredit = updates.imageCredit;
      if (updates.imageFocalX != null) article.imageFocalX = updates.imageFocalX;
      if (updates.imageFocalY != null) article.imageFocalY = updates.imageFocalY;
      if (updates.imageSafeW != null) article.imageSafeW = updates.imageSafeW;
      if (updates.imageSafeH != null) article.imageSafeH = updates.imageSafeH;
      mutated = true;
    }
    if (mutated) saveToLocalFiles(bucket);
  }

  // 3. Update Supabase
  const dbUpdates: Record<string, unknown> = {
    image_url: updates.imageUrl,
    image_width: updates.imageWidth,
    image_height: updates.imageHeight,
  };
  if (updates.imageFocalX != null) dbUpdates.image_focal_x = updates.imageFocalX;
  if (updates.imageFocalY != null) dbUpdates.image_focal_y = updates.imageFocalY;
  if (updates.imageSafeW != null) dbUpdates.image_safe_w = updates.imageSafeW;
  if (updates.imageSafeH != null) dbUpdates.image_safe_h = updates.imageSafeH;

  const { error } = await supabase.from("articles").update(dbUpdates).eq("id", supabaseId);
  if (error) {
    // Retry without focal columns if schema doesn't have them
    if (error.message.includes("column")) {
      delete dbUpdates.image_focal_x;
      delete dbUpdates.image_focal_y;
      delete dbUpdates.image_safe_w;
      delete dbUpdates.image_safe_h;
      await supabase.from("articles").update(dbUpdates).eq("id", supabaseId);
    }
  }
}

/**
 * Update an article's title in-memory + Supabase by stable Supabase id.
 * Mirrors `updateArticleImageInMemory` so headline patches don't require a
 * server restart to land in the mobile feed.
 */
export async function updateArticleTitleInMemory(
  supabaseId: number,
  newTitle: string
): Promise<{ ok: boolean; previousTitle?: string }> {
  let previousTitle: string | undefined;
  for (const [, bucket] of _feeds.entries()) {
    let mutated = false;
    for (const article of bucket.articles) {
      if (article.id !== supabaseId) continue;
      if (previousTitle === undefined) previousTitle = article.title;
      article.title = newTitle;
      mutated = true;
    }
    if (mutated) saveToLocalFiles(bucket);
  }

  const { error } = await supabase
    .from("articles")
    .update({ title: newTitle })
    .eq("id", supabaseId);
  if (error) {
    console.error(`[curated/set-title] supabase error: ${error.message}`);
    return { ok: false, previousTitle };
  }
  return { ok: true, previousTitle };
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

/**
 * Update the imageUrl (and optionally dimensions) for a single article identified
 * by its global feed ID. Mutates in-memory cache, saves to local file, and
 * fire-and-forgets a Supabase update (matched by title).
 * Returns the updated article or null if not found.
 */
export async function updateArticleImage(
  id: number,
  imageUrl: string,
  imageWidth?: number,
  imageHeight?: number,
): Promise<EnrichedArticle | null> {
  // Find the mutable bucket article by stable Supabase id.
  let foundArticle: EnrichedArticle | null = null;
  let foundBucket: { date: string; articles: EnrichedArticle[] } | null = null;
  for (const [, bucket] of _feeds.entries()) {
    const article = bucket.articles.find((a) => a.id === id);
    if (article) { foundArticle = article; foundBucket = bucket; break; }
  }
  if (!foundArticle || !foundBucket) return null;

  // Mutate in memory
  foundArticle.imageUrl    = imageUrl;
  if (imageWidth  !== undefined) foundArticle.imageWidth  = imageWidth;
  if (imageHeight !== undefined) foundArticle.imageHeight = imageHeight;

  // Persist to local backup file
  saveToLocalFiles(foundBucket);

  // Persist to Supabase by id (fire-and-forget).
  if (process.env.SUPABASE_URL) {
    void (async () => {
      const { error } = await supabase
        .from("articles")
        .update({ image_url: imageUrl, image_width: imageWidth ?? null, image_height: imageHeight ?? null })
        .eq("id", id);
      if (error) console.warn("[curated] updateArticleImage Supabase error:", error.message);
    })();
  }

  console.log(`[curated] ✓ Image updated for article id=${id}: ${imageUrl.slice(0, 60)}`);
  return foundArticle;
}

/**
 * Detect focal points for every article in TODAY's feed whose image currently
 * has no focal point, using Claude's vision API. Existing focal points are left
 * alone; articles in other days are not touched. Safe to call repeatedly.
 *
 * Returns the number of articles that received a newly-detected focal point.
 */
export async function backfillFocalPointsForToday(
  options: { force?: boolean } = {}
): Promise<{
  scanned: number;
  updated: number;
  skipped: number;
}> {
  const today = dateStr(0);
  const bucket = _feeds.get(today);
  if (!bucket) return { scanned: 0, updated: 0, skipped: 0 };

  // Lazy-import to avoid circular deps with rss-enricher
  const { detectImageFocalPoint, fetchImageDimensions } = await import("./rss-enricher.js");

  // Pick up anything that's missing focal point OR safe box OR width/height.
  // The safe-box math on the front-end needs dims, so an article with a safe
  // box but no dims still can't make the cover/contain decision.
  // In force mode, re-detect every article that has an image (used after a
  // prompt change to invalidate stale vision results).
  const targets = bucket.articles.filter((a) => {
    if (!a.imageUrl || a.imageUrl.startsWith("__NEEDS_OG__")) return false;
    if (options.force) return true;
    return a.imageFocalX == null || a.imageSafeW == null || !a.imageWidth || !a.imageHeight;
  });
  let updated = 0;
  let skipped = 0;

  console.log(`[focal-backfill] scanning ${targets.length} of ${bucket.articles.length} articles for today (${today})`);

  // Process in small batches. The vision API has a 30k input-tokens-per-minute
  // limit, and each call consumes ~1.5–3k tokens (the image). 3 concurrent is
  // comfortably under the limit while still taking advantage of parallelism.
  const BATCH_SIZE = 3;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (article) => {
        // Fetch dims in parallel with vision call (both only touch the image URL).
        const needsDims  = !article.imageWidth || !article.imageHeight;
        const needsFocal = options.force || article.imageFocalX == null || article.imageSafeW == null;
        const [focal, dims] = await Promise.all([
          needsFocal
            ? detectImageFocalPoint(article.imageUrl!, {
                title: article.title,
                summary: article.summary,
                category: article.category,
              })
            : Promise.resolve(null),
          needsDims ? fetchImageDimensions(article.imageUrl!) : Promise.resolve(null),
        ]);
        let touched = false;
        if (focal) {
          article.imageFocalX = focal.x;
          article.imageFocalY = focal.y;
          article.imageSafeW  = focal.safeW;
          article.imageSafeH  = focal.safeH;
          touched = true;
        }
        if (dims && dims.width > 0 && dims.height > 0) {
          article.imageWidth  = dims.width;
          article.imageHeight = dims.height;
          touched = true;
        }
        if (touched) updated++;
        else skipped++;
      })
    );
    // Small pacing delay between batches keeps us under the per-minute token
    // limit even if earlier calls were large.
    if (i + BATCH_SIZE < targets.length) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  if (updated > 0) {
    saveToLocalFiles(bucket);

    if (process.env.SUPABASE_URL) {
      // Fire-and-forget — update each changed article by title
      void (async () => {
        let warnedMissingColumns = false;
        let stripSafeBox = false;
        for (const article of targets) {
          // Nothing worth persisting if neither focal nor dims changed
          if (article.imageFocalX == null && !article.imageWidth) continue;
          const fullPayload: Record<string, unknown> = {
            image_focal_x: article.imageFocalX ?? null,
            image_focal_y: article.imageFocalY ?? null,
            image_safe_w:  article.imageSafeW ?? null,
            image_safe_h:  article.imageSafeH ?? null,
            image_width:   article.imageWidth ?? null,
            image_height:  article.imageHeight ?? null,
          };
          const payload = stripSafeBox
            ? {
                image_focal_x: fullPayload.image_focal_x,
                image_focal_y: fullPayload.image_focal_y,
                image_width:   fullPayload.image_width,
                image_height:  fullPayload.image_height,
              }
            : fullPayload;
          const { error } = await supabase
            .from("articles")
            .update(payload)
            .eq("title", article.title)
            .eq("feed_date", today);
          if (error) {
            if (isMissingColumnError(error.message)) {
              if (!warnedMissingColumns) {
                console.warn(
                  "[focal-backfill] focal/safe-box columns missing in Supabase — local-only persistence. " +
                  "Run: ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_focal_x float8, " +
                  "ADD COLUMN IF NOT EXISTS image_focal_y float8, " +
                  "ADD COLUMN IF NOT EXISTS image_safe_w float8, " +
                  "ADD COLUMN IF NOT EXISTS image_safe_h float8;"
                );
                warnedMissingColumns = true;
              }
              // If safe-box specifically is missing, retry without those fields
              if (/image_safe/i.test(error.message) && !stripSafeBox) {
                stripSafeBox = true;
                const { error: retry } = await supabase
                  .from("articles")
                  .update({
                    image_focal_x: article.imageFocalX ?? null,
                    image_focal_y: article.imageFocalY ?? null,
                    image_width:   article.imageWidth  ?? null,
                    image_height:  article.imageHeight ?? null,
                  })
                  .eq("title", article.title)
                  .eq("feed_date", today);
                if (retry && !isMissingColumnError(retry.message)) {
                  console.warn("[focal-backfill] retry supabase error:", retry.message);
                }
                continue;
              }
              // Focal columns also missing — bail out of the whole loop
              break;
            }
            console.warn("[focal-backfill] supabase error:", error.message);
          }
        }
      })();
    }
  }

  console.log(`[focal-backfill] ✓ updated=${updated} skipped=${skipped} scanned=${targets.length}`);
  return { scanned: targets.length, updated, skipped };
}

export function resetTodayFeed(): void {
  const today = dateStr(0);
  _feeds.delete(today);
  try { const fp = feedPath(today); if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
  _feeds.set(today, { date: today, articles: [] });
  // Wipe today from Supabase too (fire-and-forget)
  if (process.env.SUPABASE_URL) {
    void (async () => {
      const { error } = await supabase.from("articles").delete().eq("feed_date", today);
      if (error) console.warn("[supabase] reset delete error:", error.message);
    })();
  }
  console.log("[curated] ✓ Today's feed reset.");
}

/**
 * Persist today's feed to local files. Supabase is already up-to-date because
 * mergeFeed inserts new rows directly. Double-writing here would re-trigger
 * the insert path and risk recycling stable ids.
 */
export function saveCommittedFeed(): void {
  resetIfNewDay();
  const today = dateStr(0);
  const bucket = _feeds.get(today)!;
  saveToLocalFiles(bucket);
  console.log(`[curated] ✓ Local feed saved (${bucket.articles.length} articles)`);
}

/** @deprecated Use saveCommittedFeed() — kept for call-site compatibility. */
export function saveDailyFeed(): void { saveCommittedFeed(); }

/** @deprecated No-op — Supabase + local files loaded via loadFromSupabase(). */
export function loadDailyFeed(): void { /* no-op */ }

/** @deprecated No-op — loadFromSupabase() handles all sources. */
export function loadCommittedFeeds(): void { /* no-op */ }

// ─── Promotion helpers ──────────────────────────────────────────────────────

/**
 * Promote all dev-staged articles for a given date to prod in Supabase.
 * Returns the number of articles promoted.
 */
export async function promoteToProduction(feedDate?: string): Promise<number> {
  const date = feedDate ?? dateStr(0);
  if (!process.env.SUPABASE_URL) {
    console.warn("[promote] SUPABASE_URL not set — cannot promote.");
    return 0;
  }

  const { data, error } = await supabase
    .from("articles")
    .update({ stage: "prod" })
    .eq("feed_date", date)
    .eq("stage", "dev")
    .select("id, title");

  if (error) {
    console.error("[promote] Supabase error:", error.message);
    throw new Error(`Promotion failed: ${error.message}`);
  }

  const count = data?.length ?? 0;
  console.log(`[promote] ✓ ${count} articles promoted to prod for ${date}`);
  return count;
}

/**
 * Persist today's feed locally. Supabase is already up-to-date — mergeFeed
 * inserts new rows directly with the requested stage. Kept as the local-file
 * sync entry point for /api/curation/add.
 */
export function saveCommittedFeedAsProd(): void {
  resetIfNewDay();
  const today = dateStr(0);
  const bucket = _feeds.get(today)!;
  saveToLocalFiles(bucket);
  console.log(`[curated] ✓ Local feed saved (${bucket.articles.length} articles)`);
}
