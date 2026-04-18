/**
 * Pool fetch — fetches RSS items within a time window, scores each with
 * Claude, and appends them to a per-feed-date pool JSON file. Designed to
 * be run 5× a day (either manually for catch-up or via Claude Routines on
 * a cron schedule). Each run is a fetch "slot" that covers the period
 * between the last fetch and "now".
 *
 * The accumulating pool becomes the input for pool-finalize.ts at the end
 * of the 24h window (7:30pm BKK), which runs final dedup + selection +
 * image enrichment and writes the human-facing review doc.
 *
 * Usage:
 *   cd artifacts/api-server
 *   node --env-file=../../.env --import tsx scripts/pool-fetch.ts \
 *     --start="2026-04-17T19:30:00+07:00" \
 *     --end="2026-04-18T00:30:00+07:00" \
 *     [--feed-date=2026-04-18]  # defaults to the BKK calendar date of --end
 *     [--dry-run]               # score + dedup but don't write pool file
 *
 * Pool file shape lives at: data/pool/pool-YYYY-MM-DD.json
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import {
  RSS_FEEDS,
  fetchFeed,
  type RawRSSItem,
} from "../src/lib/rss-enricher.js";

// ── Types ──────────────────────────────────────────────────────────────────

interface PoolItem {
  /** sha1 of canonical URL — stable, used for dedup against prior fetches */
  id: string;
  url: string;
  title: string;
  source: string;
  pubDate: string;          // ISO
  description: string;
  rawImageUrl?: string;
  /** Which fetch run (1-5) first discovered this item */
  fetchedInRun: number;
  /** Claude's score 0-100 */
  score: number;
  /** "potential" = may publish; "rejected" = noise/low-signal */
  verdict: "potential" | "rejected";
  /** One-line editorial reasoning from Claude */
  reasoning: string;
  /** Cluster of near-identical stories (title fuzz + host+path). Members share an id. */
  clusterId: string;
  /** Number of items in this cluster (incremented as later fetches add dupes) */
  clusterSize: number;
  /** Sources that covered this story (deduped) */
  clusterSources: string[];
}

interface FetchRecord {
  n: number;
  windowStart: string;
  windowEnd: string;
  ranAt: string;
  itemsRawFromFeeds: number;     // raw items returned by RSS, before window filter
  itemsInWindow: number;          // after pubDate filter
  itemsAdded: number;             // new items added to pool this run
  dedupMerges: number;            // existing clusters this run merged into
}

interface Pool {
  feedDate: string;                    // YYYY-MM-DD (BKK calendar date)
  dayStart: string;                    // ISO — when the 24h window started (7:30pm BKK previous day)
  fetches: FetchRecord[];
  items: PoolItem[];
}

// ── Args ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const startArg = arg("start");
const endArg = arg("end");
const dryRun = args.includes("--dry-run");

if (!startArg || !endArg) {
  console.error("Usage: pool-fetch.ts --start=ISO --end=ISO [--feed-date=YYYY-MM-DD] [--dry-run]");
  process.exit(1);
}

const windowStart = new Date(startArg);
const windowEnd = new Date(endArg);
if (isNaN(windowStart.getTime()) || isNaN(windowEnd.getTime())) {
  console.error("Invalid --start or --end date");
  process.exit(1);
}

// Feed date = BKK calendar date of windowEnd (falls back: if --feed-date given, use it)
const feedDate = arg("feed-date") ?? bkkDateString(windowEnd);

const poolPath = path.join(
  process.cwd(),
  "data",
  "pool",
  `pool-${feedDate}.json`
);

console.log(`[pool-fetch] window ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);
console.log(`[pool-fetch] feedDate=${feedDate} poolPath=${poolPath}`);

// ── Helpers ────────────────────────────────────────────────────────────────

function bkkDateString(d: Date): string {
  // Convert to BKK (UTC+7) and take the YYYY-MM-DD
  const shifted = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function sha1(s: string): string {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);
}

function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    // Strip common tracking params
    const strip = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "mc_cid", "mc_eid", "ref"];
    strip.forEach((k) => u.searchParams.delete(k));
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-set Jaccard similarity on normalized titles */
function titleSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeTitle(a).split(" ").filter((w) => w.length >= 3));
  const tb = new Set(normalizeTitle(b).split(" ").filter((w) => w.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((w) => { if (tb.has(w)) inter++; });
  const union = ta.size + tb.size - inter;
  return inter / union;
}

// ── Load or init pool ──────────────────────────────────────────────────────

function loadPool(): Pool {
  if (fs.existsSync(poolPath)) {
    const raw = fs.readFileSync(poolPath, "utf8");
    return JSON.parse(raw) as Pool;
  }
  return {
    feedDate,
    dayStart: windowStart.toISOString(),
    fetches: [],
    items: [],
  };
}

function savePool(pool: Pool): void {
  fs.mkdirSync(path.dirname(poolPath), { recursive: true });
  fs.writeFileSync(poolPath, JSON.stringify(pool, null, 2) + "\n");
}

// ── Claude scoring ─────────────────────────────────────────────────────────

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

interface ScoredResponse {
  idx: number;
  score: number;
  verdict: "potential" | "rejected";
  reasoning: string;
}

async function scoreBatch(
  batch: Array<{ title: string; source: string; description: string }>
): Promise<ScoredResponse[]> {
  const numbered = batch
    .map((it, i) => `${i + 1}. [${it.source}] "${it.title}" — ${it.description.slice(0, 200)}`)
    .join("\n");

  const prompt = `You are curating a pop-culture news feed aimed at a culturally-literate millennial audience. The feed mixes Power (politics+culture crossover), Tech (meaningful tech+society), Culture (music/film/fashion), Internet (distinctive viral), and Human (scaled drama). Daily cut is 10-15 stories.

SCORE each item 0-100 on how strong a candidate it is for today's feed, and classify as "potential" (score ≥ 50) or "rejected" (score < 50).

KEEP (high score):
- Narrative reversals with real stakes (e.g. drug trial fails, study overturns consensus)
- Power/tech/control stories with societal impact
- Unexpected celebrity crossovers / human stories with cultural weight
- Distinctive internet culture (novel, shareable, conversation-worthy)
- Major IP / franchise moments (GOT, Marvel, Bond, major music releases)
- Fandom-driven real-world behavior, scaled human drama
- MASS-RECOGNITION BRAND MOMENTS (score high, often 70+): a globally-recognised consumer brand (Nutella, IKEA, McDonald's, Lego, Coca-Cola, Disney, Nike, Apple, Starbucks, Tesla, etc.) doing something new — new flavor, new product, weird collab, unusual move. Near-automatic keeps even if the story itself reads "light" — mass recognition = mass shareability.
- DEBUNKING / NARRATIVE REVERSAL ON POPULAR BELIEFS (score high): research that overturns a widely-held internet belief (manifestation, habit stacking, popular diets, TikTok/social advice). Highly shareable precisely BECAUSE many believe it.
- DELIGHT + ABSURDITY (score 65-80): weird brand mashups, luxury absurdism, politician-with-a-prior-life, oddly-specific consumer moments. These are the feed's TEXTURE, not noise. Do not over-penalise for being "light" — familiarity, absurdity, or emotional resonance are legitimate reasons to earn a spot.
- CELEBRITY INCIDENTS with real-world stakes (public attack, arrest, public meltdown, breakup with concrete details).
- LEGACY LEGEND MOMENTS (score high): iconic living figures (McCartney, Ringo, Stevie Wonder, Dylan, Paul Simon, Madonna, Springsteen, Dolly Parton level) doing something new, collaborating, or breaking long silences — even short announcements are mass-resonant.

REJECT (low score):
- Routine industry PR / press releases with no cultural hook
- Pure crypto / finance unless directly tied to culture
- Deep B2B enterprise SaaS / developer tooling
- Local crime not scaled
- Low-signal viral-of-the-day with no staying power
- Trailer announcements UNLESS it's a major property
- Pure stock tips / investment advice
- Sports scores without cultural crossover
- Pure US/UK legislative process (bills, committee votes, party manoeuvres, senators you've never heard of making predictions) — unless it involves a globally-recognised household name (Trump, Obama, Musk-as-political-actor, AOC, Sanders) OR has direct culture/tech/daily-life consequences a non-political reader would feel immediately
- Inside-the-Beltway politics and lobbying stories without a cultural hook

Respond with JSON only, an array, one entry per input item:
[{"idx":1,"score":78,"verdict":"potential","reasoning":"short one-liner"},...]

Items:
${numbered}`;

  const body = JSON.stringify({
    model: "claude-opus-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY!,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c.toString()));
        res.on("end", () => {
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`score HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
          } else {
            try {
              const json = JSON.parse(data);
              const text = json?.content?.[0]?.type === "text" ? json.content[0].text : "";
              resolve(text);
            } catch (e) {
              reject(new Error(`score parse: ${(e as Error).message}`));
            }
          }
        });
      }
    );
    req.setTimeout(60_000, () => req.destroy(new Error("score timeout")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  // Extract first JSON array from response
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`score: no JSON array in response — got: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(match[0]) as ScoredResponse[];
  return parsed;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const pool = loadPool();
  const fetchNumber = pool.fetches.length + 1;
  console.log(`[pool-fetch] run #${fetchNumber} (pool currently has ${pool.items.length} items)`);

  // 1. Fetch all feeds (with existing batching/retry from fetchFeed)
  console.log(`[pool-fetch] fetching ${RSS_FEEDS.length} sources...`);
  const BATCH = 5;
  const raw: RawRSSItem[] = [];
  for (let i = 0; i < RSS_FEEDS.length; i += BATCH) {
    const batch = RSS_FEEDS.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(([url, name]) => fetchFeed(url, name)));
    results.forEach((r) => { if (r.status === "fulfilled") raw.push(...r.value); });
    if (i + BATCH < RSS_FEEDS.length) await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`[pool-fetch] raw items from feeds: ${raw.length}`);

  // 2. Filter by pubDate window
  const inWindow = raw.filter((it) => {
    const d = new Date(it.pubDate);
    if (isNaN(d.getTime())) return false;
    return d >= windowStart && d < windowEnd;
  });
  console.log(`[pool-fetch] in window: ${inWindow.length}`);

  // 3. Dedup within this fetch: canonicalUrl -> first-seen
  const byUrl = new Map<string, RawRSSItem>();
  for (const it of inWindow) {
    const cu = canonicalUrl(it.link);
    if (!byUrl.has(cu)) byUrl.set(cu, it);
  }
  const unique = Array.from(byUrl.values());

  // 4. Cluster against existing pool: by URL exact match OR fuzzy title (≥ 0.55)
  const existingByUrl = new Map<string, PoolItem>();
  pool.items.forEach((p) => existingByUrl.set(canonicalUrl(p.url), p));

  const toScore: RawRSSItem[] = [];
  let dedupMerges = 0;

  for (const it of unique) {
    const cu = canonicalUrl(it.link);
    const urlMatch = existingByUrl.get(cu);
    if (urlMatch) {
      // Same URL already in pool — just bump clusterSize + add source if new
      const sameClusterItems = pool.items.filter((p) => p.clusterId === urlMatch.clusterId);
      if (!urlMatch.clusterSources.includes(it.source)) {
        sameClusterItems.forEach((p) => {
          if (!p.clusterSources.includes(it.source)) p.clusterSources.push(it.source);
        });
      }
      // No clusterSize bump (it's the same item)
      continue;
    }
    // Fuzzy title match against existing cluster representatives
    let bestMatch: { item: PoolItem; sim: number } | null = null;
    for (const p of pool.items) {
      const sim = titleSimilarity(it.title, p.title);
      if (sim >= 0.55 && (!bestMatch || sim > bestMatch.sim)) {
        bestMatch = { item: p, sim };
      }
    }
    if (bestMatch) {
      // Merge into existing cluster: bump clusterSize on all members, add source
      const members = pool.items.filter((p) => p.clusterId === bestMatch!.item.clusterId);
      members.forEach((p) => {
        p.clusterSize += 1;
        if (!p.clusterSources.includes(it.source)) p.clusterSources.push(it.source);
      });
      dedupMerges++;
      continue;
    }
    // Brand-new to pool — queue for scoring
    toScore.push(it);
  }

  console.log(`[pool-fetch] unique-new: ${toScore.length}  dedup-merges: ${dedupMerges}`);

  // 5. Score in batches of 40
  const SCORE_BATCH = 40;
  const scored: PoolItem[] = [];
  for (let i = 0; i < toScore.length; i += SCORE_BATCH) {
    const batch = toScore.slice(i, i + SCORE_BATCH);
    const input = batch.map((it) => ({
      title: it.title,
      source: it.source,
      description: it.description || "",
    }));
    console.log(`[pool-fetch] scoring batch ${i / SCORE_BATCH + 1} (${batch.length} items)...`);
    let verdicts: ScoredResponse[];
    try {
      verdicts = await scoreBatch(input);
    } catch (e) {
      console.warn(`[pool-fetch] score batch failed: ${(e as Error).message} — marking batch as unscored`);
      verdicts = batch.map((_, k) => ({ idx: k + 1, score: 50, verdict: "potential" as const, reasoning: "score-failure-default" }));
    }
    // Map verdicts back
    for (let k = 0; k < batch.length; k++) {
      const v = verdicts.find((r) => r.idx === k + 1);
      const it = batch[k];
      const cu = canonicalUrl(it.link);
      const clusterId = `c-${sha1(cu)}`;
      scored.push({
        id: sha1(cu),
        url: it.link,
        title: it.title,
        source: it.source,
        pubDate: new Date(it.pubDate).toISOString(),
        description: it.description || "",
        rawImageUrl: it.imageUrl,
        fetchedInRun: fetchNumber,
        score: v?.score ?? 50,
        verdict: (v?.verdict === "rejected" ? "rejected" : "potential"),
        reasoning: v?.reasoning ?? "no-reasoning",
        clusterId,
        clusterSize: 1,
        clusterSources: [it.source],
      });
    }
  }

  // 6. Append and write
  pool.items.push(...scored);
  pool.fetches.push({
    n: fetchNumber,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    ranAt: new Date().toISOString(),
    itemsRawFromFeeds: raw.length,
    itemsInWindow: inWindow.length,
    itemsAdded: scored.length,
    dedupMerges,
  });

  const totalPotential = pool.items.filter((p) => p.verdict === "potential").length;
  const totalRejected = pool.items.filter((p) => p.verdict === "rejected").length;
  const uniqueClusters = new Set(pool.items.map((p) => p.clusterId)).size;

  if (dryRun) {
    console.log("[pool-fetch] --dry-run: would save pool but skipping write");
  } else {
    savePool(pool);
    console.log(`[pool-fetch] ✓ wrote ${poolPath}`);
  }

  console.log(
    `[pool-fetch] summary — fetch=${fetchNumber}/5 added=${scored.length} merges=${dedupMerges} ` +
    `potential=${totalPotential} rejected=${totalRejected} clusters=${uniqueClusters}`
  );
}

main().catch((e) => {
  console.error("[pool-fetch] fatal:", e);
  process.exit(1);
});
