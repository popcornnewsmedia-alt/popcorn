/**
 * dry-run-images.ts
 *
 * CLI that re-runs the image selection engine for every article in a feed
 * file and prints a before/after comparison — WITHOUT touching Supabase,
 * local JSON files, or running the Vision focal-point detection.
 *
 * Usage:
 *   node dist/cli/dry-run-images.mjs 2026-04-11
 *
 * Reads artifacts/api-server/data/feed-<DATE>.json and writes nothing.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { selectBestImageForDryRun, type EnrichedArticle } from "../lib/rss-enricher.js";

// ── Load .env from repo root so API keys are available ──────────────────────
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
      if (!(key in process.env)) process.env[key] = val;
    }
    return p;
  }
  return null;
}

const envPath = loadEnv();
if (envPath) console.log(`[env] loaded from ${envPath}`);

// ── Parse args ──────────────────────────────────────────────────────────────
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`❌ Date must be YYYY-MM-DD, got: ${date}`);
  process.exit(1);
}

// Where the feed files live (relative to repo root)
const feedPath = resolve(process.cwd(), `artifacts/api-server/data/feed-${date}.json`);
if (!existsSync(feedPath)) {
  console.error(`❌ Feed file not found: ${feedPath}`);
  process.exit(1);
}

const feedRaw = readFileSync(feedPath, "utf8");
const feedJson = JSON.parse(feedRaw) as EnrichedArticle[] | { articles: EnrichedArticle[] };
const articles: EnrichedArticle[] = Array.isArray(feedJson) ? feedJson : feedJson.articles ?? [];

console.log(`\n🔍 Dry-running image selection for ${articles.length} articles in feed-${date}.json\n`);
console.log("NO changes will be written to Supabase or local files.\n");

// ── Helpers ─────────────────────────────────────────────────────────────────
function shortUrl(u: string | null | undefined): string {
  if (!u) return "(none)";
  try {
    const url = new URL(u);
    return `${url.hostname}${url.pathname}`.slice(0, 70);
  } catch {
    return u.slice(0, 70);
  }
}

function resolveArticleUrl(a: EnrichedArticle & Record<string, unknown>): string {
  // The enricher stores the source URL in different places depending on
  // when it was saved. Try them all.
  const candidates = [
    a.link as string | undefined,
    (a as { _raw?: { link?: string } })._raw?.link,
    (a as { originalLink?: string }).originalLink,
  ].filter((x): x is string => typeof x === "string" && x.length > 0);
  return candidates[0] ?? "";
}

// ── Run the dry-run sequentially to keep logs readable ──────────────────────
interface Result {
  title: string;
  category: string;
  oldUrl: string;
  oldDims: string;
  newUrl: string;
  newDims: string;
  intent: string;
  sceneSpecific: boolean;
  winnerSource: string;
  top3: string;
  changed: boolean;
}

const results: Result[] = [];

for (let i = 0; i < articles.length; i++) {
  const a = articles[i];
  const articleUrl = resolveArticleUrl(a as EnrichedArticle & Record<string, unknown>);

  const oldUrl  = a.imageUrl ?? "";
  const oldW    = a.imageWidth ?? 0;
  const oldH    = a.imageHeight ?? 0;
  const oldDims = oldW && oldH ? `${oldW}×${oldH}` : "(unknown)";

  try {
    const result = await selectBestImageForDryRun(a, articleUrl, a.imageUrl ?? null);
    const newW = result.width ?? 0;
    const newH = result.height ?? 0;
    const newDims = newW && newH ? `${newW}×${newH}` : "(unknown)";
    const changed = result.url !== oldUrl;

    results.push({
      title: a.title,
      category: a.category,
      oldUrl,
      oldDims,
      newUrl: result.url,
      newDims,
      intent:        result.debug?.intent ?? "?",
      sceneSpecific: result.debug?.sceneSpecific ?? false,
      winnerSource:  result.debug?.winnerSource ?? "?",
      top3:          result.debug?.top3 ?? "",
      changed,
    });

    const mark = changed ? "🔄" : "✓";
    console.log(`${mark} [${i + 1}/${articles.length}] ${a.title.slice(0, 60)}`);
    console.log(`   intent=${result.debug?.intent} ${result.debug?.sceneSpecific ? "scene" : "portrait"}`);
    console.log(`   old: ${oldDims.padEnd(11)} ${shortUrl(oldUrl)}`);
    console.log(`   new: ${newDims.padEnd(11)} ${shortUrl(result.url)}  [${result.debug?.winnerSource}]`);
    console.log(`   top: ${result.debug?.top3}`);
    console.log();
  } catch (err) {
    console.error(`❌ [${i + 1}/${articles.length}] ${a.title}: ${(err as Error).message}`);
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
const changed = results.filter((r) => r.changed);
console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`SUMMARY — ${changed.length}/${results.length} images would change`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

for (const r of changed) {
  console.log(`🔄 ${r.title.slice(0, 70)}`);
  console.log(`   intent=${r.intent} ${r.sceneSpecific ? "scene" : "portrait"} → ${r.winnerSource}`);
  console.log(`   old: ${r.oldDims.padEnd(11)} ${shortUrl(r.oldUrl)}`);
  console.log(`   new: ${r.newDims.padEnd(11)} ${shortUrl(r.newUrl)}`);
  console.log();
}
