/**
 * Pool add — manually select specific items from the pool and enrich /
 * publish them to Supabase (dev stage). Used for human overrides after
 * pool-finalize has run, or for catch-up additions.
 *
 * Usage:
 *   cd artifacts/api-server
 *   set -a && . ../../.env && set +a
 *   node --import tsx scripts/pool-add.ts \
 *     --feed-date=2026-04-18 \
 *     --potential-idx=9,10,14,17,18,21,30,57,108,168 \
 *     [--title-contains=nutella,other-substring]   # add items by title substring (case-insensitive)
 *     [--dry-run]
 *
 * --potential-idx numbers are 1-based indices into the pool's potentials,
 * sorted by score descending (same ordering used by the review doc).
 */

import fs from "node:fs";
import path from "node:path";
import {
  enrichSelectedItems,
  type RawRSSItem,
} from "../src/lib/rss-enricher.js";
import {
  loadFromSupabase,
  lookupPreservedImagesByLinks,
  mergeFeed,
  saveCommittedFeed,
} from "../src/lib/curated-store.js";

interface PoolItem {
  id: string;
  url: string;
  title: string;
  source: string;
  pubDate: string;
  description: string;
  rawImageUrl?: string;
  fetchedInRun: number;
  score: number;
  verdict: "potential" | "rejected" | "published";
  reasoning: string;
  clusterId: string;
  clusterSize: number;
  clusterSources: string[];
  publishedReasoning?: string;
}

interface Pool {
  feedDate: string;
  dayStart: string;
  fetches: unknown[];
  items: PoolItem[];
}

// ── Args ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const p = args.find((a) => a.startsWith(`--${name}=`));
  return p ? p.slice(name.length + 3) : undefined;
}
function flag(name: string): boolean {
  return args.includes(`--${name}`);
}

const feedDate = arg("feed-date");
if (!feedDate) {
  console.error("Missing --feed-date=YYYY-MM-DD");
  process.exit(1);
}

const potentialIdxArg = arg("potential-idx") ?? "";
const titleContainsArg = arg("title-contains") ?? "";
const dryRun = flag("dry-run");

const potentialIdx = potentialIdxArg
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => parseInt(s, 10))
  .filter((n) => Number.isFinite(n));

const titleContains = titleContainsArg
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => s.toLowerCase());

if (potentialIdx.length === 0 && titleContains.length === 0) {
  console.error("Provide at least one of --potential-idx or --title-contains");
  process.exit(1);
}

const poolPath = path.join(process.cwd(), "data", "pool", `pool-${feedDate}.json`);
if (!fs.existsSync(poolPath)) {
  console.error(`Pool file not found: ${poolPath}`);
  process.exit(1);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // CRITICAL: load existing Supabase state first. Without this, saveCommittedFeed's
  // DELETE-then-INSERT pattern for stage='dev' rows will wipe any previously-published
  // articles for this feed_date because they're not in the fresh script's in-memory _feeds.
  console.log("[pool-add] loading existing Supabase state...");
  await loadFromSupabase();

  const pool = JSON.parse(fs.readFileSync(poolPath, "utf8")) as Pool;

  // Build the same sorted-potentials list the review doc uses
  const allSorted = [...pool.items].sort((a, b) => b.score - a.score);
  const potentials = allSorted.filter((i) => i.verdict === "potential");

  const picked: PoolItem[] = [];
  const seenIds = new Set<string>();

  for (const idx of potentialIdx) {
    const it = potentials[idx - 1];
    if (!it) {
      console.warn(`[pool-add] potential-idx ${idx} OUT OF RANGE (max ${potentials.length}) — skipping`);
      continue;
    }
    if (seenIds.has(it.id)) continue;
    seenIds.add(it.id);
    picked.push(it);
  }

  for (const frag of titleContains) {
    const matches = pool.items.filter((i) => i.title.toLowerCase().includes(frag));
    if (matches.length === 0) {
      console.warn(`[pool-add] title-contains "${frag}" matched NOTHING — skipping`);
      continue;
    }
    if (matches.length > 1) {
      console.warn(`[pool-add] title-contains "${frag}" matched ${matches.length} items — picking highest score`);
    }
    const best = matches.sort((a, b) => b.score - a.score)[0];
    if (seenIds.has(best.id)) continue;
    seenIds.add(best.id);
    picked.push(best);
  }

  if (picked.length === 0) {
    console.error("[pool-add] no items picked — exiting");
    process.exit(1);
  }

  console.log(`[pool-add] picked ${picked.length} items:`);
  picked.forEach((p, i) => {
    console.log(`  ${i + 1}. score=${p.score} verdict=${p.verdict} [${p.source}] — ${p.title}`);
  });

  if (dryRun) {
    console.log("[pool-add] --dry-run: exiting without enriching / publishing");
    return;
  }

  // Enrich
  console.log(`[pool-add] enriching ${picked.length} items (content + images)...`);
  const rawItems: RawRSSItem[] = picked.map((p) => ({
    title: p.title,
    link: p.url,
    pubDate: p.pubDate,
    description: p.description,
    source: p.source,
    image: p.rawImageUrl,
  }));

  // Preserve original images for any previously-published re-adds.
  const preservedImages = await lookupPreservedImagesByLinks(
    rawItems.map((r) => r.link).filter((l): l is string => !!l),
  );

  const enriched = await enrichSelectedItems(rawItems, true);
  console.log(`[pool-add] enriched ${enriched.length} items`);

  if (enriched.length === 0) {
    console.error("[pool-add] enrichment returned 0 items — exiting without writing");
    process.exit(1);
  }

  let preservedCount = 0;
  for (const article of enriched) {
    if (!article.link) continue;
    const preserved = preservedImages.get(article.link);
    if (!preserved || !preserved.imageUrl) continue;
    article.imageUrl = preserved.imageUrl;
    article.sourceImageUrl = preserved.sourceImageUrl;
    article.imageWidth = preserved.imageWidth;
    article.imageHeight = preserved.imageHeight;
    article.imageFocalX = preserved.imageFocalX;
    article.imageFocalY = preserved.imageFocalY;
    article.imageSafeW = preserved.imageSafeW;
    article.imageSafeH = preserved.imageSafeH;
    article.imageCredit = preserved.imageCredit;
    preservedCount++;
  }
  if (preservedCount > 0) {
    console.log(`[pool-add] preserved original image for ${preservedCount} re-added article(s)`);
  }

  // Merge + persist (dev stage by default)
  const added = mergeFeed(enriched);
  console.log(`[pool-add] mergeFeed added ${added} articles to today's bucket`);

  saveCommittedFeed();
  console.log("[pool-add] ✓ saved to Supabase (dev stage) + local feed file");

  // Mark as published in the pool JSON
  for (const p of picked) {
    const poolItem = pool.items.find((i) => i.id === p.id);
    if (poolItem) {
      poolItem.verdict = "published";
      poolItem.publishedReasoning = "manually added via pool-add";
    }
  }
  fs.writeFileSync(poolPath, JSON.stringify(pool, null, 2) + "\n");
  console.log(`[pool-add] updated pool file — marked ${picked.length} items as published`);
}

main().catch((e) => {
  console.error("[pool-add] fatal:", e);
  process.exit(1);
});
