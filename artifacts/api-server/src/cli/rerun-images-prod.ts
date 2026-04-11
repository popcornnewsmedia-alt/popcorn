/**
 * rerun-images-prod.ts
 *
 * Re-runs the image selection engine for every article in today's feed in
 * Supabase and writes the updated image columns back to the DB (image_url,
 * image_width, image_height, image_focal_x/y, image_safe_w/h).
 *
 * Workflow:
 *   1. Read article URLs from artifacts/api-server/data/feed-<DATE>.json
 *   2. Query rows from Supabase for feed_date=<DATE> (all stages)
 *   3. Match rows to feed entries by title
 *   4. Back up the existing image columns to
 *      artifacts/api-server/data/backup-images-<DATE>-<TS>.json
 *   5. For each row call selectBestImageForRerun(article, articleUrl, existingImageUrl)
 *      (focal-point detection stays ENABLED)
 *   6. Update the row in Supabase with the winning image
 *
 * Usage:
 *   node artifacts/api-server/dist/cli/rerun-images-prod.mjs              # today
 *   node artifacts/api-server/dist/cli/rerun-images-prod.mjs 2026-04-11   # specific date
 *
 * Optional flags (must come after the date):
 *   --dry                 Print what would change without touching Supabase
 *   --only="title1,t2"    Limit to titles containing any of these substrings
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY in .env
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { selectBestImageForRerun, type EnrichedArticle } from "../lib/rss-enricher.js";

// ── Load .env from repo root ───────────────────────────────────────────────
function loadEnv() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), "../../../.env"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      // Overwrite if missing OR empty (shells may export empty defaults).
      const existing = process.env[key];
      if (existing === undefined || existing === "") process.env[key] = val;
    }
    return p;
  }
  return null;
}

const envPath = loadEnv();
if (envPath) console.log(`[env] loaded from ${envPath}`);

// ── Parse args ──────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const dateArg = rawArgs.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const isDry   = rawArgs.includes("--dry");
const onlyArg = rawArgs.find((a) => a.startsWith("--only="));
const onlyFilters = onlyArg
  ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  : null;

const date = dateArg ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`❌ Date must be YYYY-MM-DD, got: ${date}`);
  process.exit(1);
}

// ── Verify env ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("⚠️  ANTHROPIC_API_KEY not set — focal-point detection will be skipped.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Helpers ─────────────────────────────────────────────────────────────────
function shortUrl(u: string | null | undefined): string {
  if (!u) return "(none)";
  try {
    const url = new URL(u);
    return `${url.hostname}${url.pathname}`.slice(0, 80);
  } catch {
    return u.slice(0, 80);
  }
}

function resolveArticleUrl(a: Record<string, unknown>): string {
  const candidates = [
    a.link as string | undefined,
    (a as { _raw?: { link?: string } })._raw?.link,
    (a as { originalLink?: string }).originalLink,
  ].filter((x): x is string => typeof x === "string" && x.length > 0);
  return candidates[0] ?? "";
}

// ── Load feed JSON (for article URLs only) ──────────────────────────────────
const feedPath = resolve(process.cwd(), `artifacts/api-server/data/feed-${date}.json`);
if (!existsSync(feedPath)) {
  console.error(`❌ Feed file not found: ${feedPath}`);
  process.exit(1);
}
interface FeedJson { articles: Array<Record<string, unknown>>; }
const feedJson = JSON.parse(readFileSync(feedPath, "utf8")) as FeedJson | Array<Record<string, unknown>>;
const feedArticles: Array<Record<string, unknown>> = Array.isArray(feedJson)
  ? feedJson
  : feedJson.articles ?? [];

const urlByTitle = new Map<string, string>();
for (const a of feedArticles) {
  const title = String(a.title ?? "");
  if (title) urlByTitle.set(title, resolveArticleUrl(a));
}
console.log(`[feed] loaded ${feedArticles.length} articles from feed-${date}.json`);

// ── Query rows from Supabase ────────────────────────────────────────────────
console.log(`\n🔍 Querying Supabase for articles on ${date}…\n`);

const { data: rows, error: selErr } = await supabase
  .from("articles")
  .select("*")
  .eq("feed_date", date)
  .order("id", { ascending: true });

if (selErr) {
  console.error(`❌ Supabase query failed: ${selErr.message}`);
  process.exit(1);
}
if (!rows || rows.length === 0) {
  console.error(`ℹ️  No articles found in DB for ${date}. Nothing to rerun.`);
  process.exit(0);
}

let targetRows = rows;
if (onlyFilters) {
  targetRows = rows.filter((r) => {
    const title = String(r.title ?? "").toLowerCase();
    return onlyFilters.some((f) => title.includes(f));
  });
  console.log(`[filter] --only matched ${targetRows.length}/${rows.length} rows`);
}

console.log(`Found ${targetRows.length} article row(s) to rerun.\n`);

// ── Back up current image columns ───────────────────────────────────────────
if (!isDry) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(process.cwd(), "artifacts/api-server/data");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = resolve(backupDir, `backup-images-${date}-${ts}.json`);
  const backup = targetRows.map((r) => ({
    id:             r.id,
    title:          r.title,
    image_url:      r.image_url,
    image_width:    r.image_width,
    image_height:   r.image_height,
    image_focal_x:  r.image_focal_x,
    image_focal_y:  r.image_focal_y,
    image_safe_w:   r.image_safe_w,
    image_safe_h:   r.image_safe_h,
  }));
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`💾 Backup written: ${backupPath}\n`);
}

// ── Convert a DB row → EnrichedArticle (subset selectBestImage needs) ───────
function rowToEnriched(row: Record<string, unknown>): EnrichedArticle {
  return {
    id:               Number(row.id ?? 0),
    title:            String(row.title ?? ""),
    summary:          String(row.summary ?? ""),
    content:          String(row.content ?? ""),
    category:         String(row.category ?? "Internet"),
    source:           String(row.source ?? ""),
    readTimeMinutes:  Number(row.read_time_minutes ?? 3),
    publishedAt:      String(row.published_at ?? new Date().toISOString()),
    likes:            Number(row.likes ?? 0),
    isBookmarked:     false,
    gradientStart:    String(row.gradient_start ?? "#080e24"),
    gradientEnd:      String(row.gradient_end ?? "#0e2a5a"),
    tag:              String(row.tag ?? "FEATURE"),
    imageUrl:         row.image_url ? String(row.image_url) : null,
    imageWidth:       row.image_width  != null ? Number(row.image_width)  : null,
    imageHeight:      row.image_height != null ? Number(row.image_height) : null,
    imageFocalX:      row.image_focal_x != null ? Number(row.image_focal_x) : null,
    imageFocalY:      row.image_focal_y != null ? Number(row.image_focal_y) : null,
    imageSafeW:       row.image_safe_w  != null ? Number(row.image_safe_w)  : null,
    imageSafeH:       row.image_safe_h  != null ? Number(row.image_safe_h)  : null,
    keyPoints:        Array.isArray(row.key_points) ? row.key_points as string[] : [],
    signalScore:      row.signal_score != null ? Number(row.signal_score) : null,
    wikiSearchQuery:  row.wiki_search_query ? String(row.wiki_search_query) : undefined,
  };
}

// ── Main loop ───────────────────────────────────────────────────────────────
interface Summary {
  id: number;
  title: string;
  oldUrl: string;
  oldDims: string;
  newUrl: string;
  newDims: string;
  winnerSource: string;
  intent: string;
  changed: boolean;
  skipped?: string;
}
const summaries: Summary[] = [];

for (let i = 0; i < targetRows.length; i++) {
  const row = targetRows[i];
  const title = String(row.title ?? "");
  const id = Number(row.id);
  const articleUrl = urlByTitle.get(title) ?? "";
  const enriched = rowToEnriched(row);
  const oldUrl = enriched.imageUrl ?? "";
  const oldW = enriched.imageWidth ?? 0;
  const oldH = enriched.imageHeight ?? 0;
  const oldDims = oldW && oldH ? `${oldW}×${oldH}` : "(unknown)";

  console.log(`[${i + 1}/${targetRows.length}] ${title.slice(0, 70)}`);
  if (!articleUrl) {
    console.log(`   (no article URL — OG / YouTube-embed skipped; RSS seed + other sources still compete)`);
  }

  try {
    const result = await selectBestImageForRerun(enriched, articleUrl, oldUrl || null);
    const newUrl = result.url;
    const newW = result.width ?? 0;
    const newH = result.height ?? 0;
    const newDims = newW && newH ? `${newW}×${newH}` : "(unknown)";
    const changed = newUrl !== oldUrl;

    console.log(`   intent=${result.debug?.intent} ${result.debug?.sceneSpecific ? "scene" : "portrait"} → ${result.debug?.winnerSource}`);
    console.log(`   old: ${oldDims.padEnd(11)} ${shortUrl(oldUrl)}`);
    console.log(`   new: ${newDims.padEnd(11)} ${shortUrl(newUrl)}`);
    console.log(`   top: ${result.debug?.top3}`);

    if (!isDry && changed) {
      const updates: Record<string, unknown> = {
        image_url:      newUrl,
        image_width:    result.width  ?? null,
        image_height:   result.height ?? null,
        image_focal_x:  result.focalX ?? null,
        image_focal_y:  result.focalY ?? null,
        image_safe_w:   result.safeW  ?? null,
        image_safe_h:   result.safeH  ?? null,
      };
      const { error: updErr } = await supabase.from("articles").update(updates).eq("id", id);
      if (updErr) {
        console.log(`   ❌ Supabase update failed: ${updErr.message}`);
      } else {
        console.log(`   ✅ Supabase row ${id} updated`);
      }
    } else if (isDry && changed) {
      console.log(`   [dry] would update row ${id}`);
    } else {
      console.log(`   ✓ unchanged (keeping current image)`);
    }
    console.log();

    summaries.push({
      id, title, oldUrl, oldDims, newUrl, newDims,
      winnerSource: result.debug?.winnerSource ?? "?",
      intent:       result.debug?.intent ?? "?",
      changed,
    });
  } catch (err) {
    console.log(`   ❌ error: ${(err as Error).message}\n`);
    summaries.push({
      id, title, oldUrl, oldDims, newUrl: oldUrl, newDims: oldDims,
      winnerSource: "?", intent: "?", changed: false, skipped: "error",
    });
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
const changed = summaries.filter((s) => s.changed);
const skipped = summaries.filter((s) => s.skipped);

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`SUMMARY — ${changed.length}/${summaries.length} images ${isDry ? "would change" : "changed"} (${skipped.length} skipped)`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

for (const s of changed) {
  console.log(`🔄 ${s.title.slice(0, 70)}`);
  console.log(`   intent=${s.intent} → ${s.winnerSource}`);
  console.log(`   old: ${s.oldDims.padEnd(11)} ${shortUrl(s.oldUrl)}`);
  console.log(`   new: ${s.newDims.padEnd(11)} ${shortUrl(s.newUrl)}`);
  console.log();
}
if (skipped.length > 0) {
  console.log(`─ skipped ─`);
  for (const s of skipped) {
    console.log(`  • [${s.skipped}] ${s.title.slice(0, 70)}`);
  }
}

if (isDry) {
  console.log(`\n[dry] no DB writes performed. Remove --dry to actually apply changes.`);
} else {
  console.log(`\n✅ Done. Reload popcornmedia.org / the dev preview to see results.`);
}
