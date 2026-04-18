/**
 * Pool finalize — runs at 7:30pm BKK after the final fetch. Reads the
 * day's pool JSON, asks Claude to pick 10-15 articles for today's feed,
 * enriches them (content rewrite + image processing + focal detection)
 * using the existing pipeline, saves to Supabase as `dev` stage, then
 * writes a human-facing markdown review doc to `curation-review/`.
 *
 * Usage:
 *   cd artifacts/api-server
 *   node --env-file=../../.env --import tsx scripts/pool-finalize.ts \
 *     [--feed-date=2026-04-18]   # defaults to today's BKK date
 *     [--target=12]              # target selection count (default 12, range 10-15)
 *     [--dry-run]                # skip enrichment + Supabase write; still writes review doc stub
 */

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import {
  enrichSelectedItems,
  type RawRSSItem,
  type EnrichedArticle,
} from "../src/lib/rss-enricher.js";
import { mergeFeed, saveCommittedFeed } from "../src/lib/curated-store.js";
import { supabase } from "../src/lib/supabase-client.js";

// ── Types (mirror pool-fetch.ts) ───────────────────────────────────────────

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
  /** Set by finalize when the item is chosen for the feed */
  publishedReasoning?: string;
}

interface FetchRecord {
  n: number;
  windowStart: string;
  windowEnd: string;
  ranAt: string;
  itemsRawFromFeeds: number;
  itemsInWindow: number;
  itemsAdded: number;
  dedupMerges: number;
}

interface Pool {
  feedDate: string;
  dayStart: string;
  fetches: FetchRecord[];
  items: PoolItem[];
  /** Set by finalize when it runs successfully */
  finalizedAt?: string;
}

// ── Args ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const dryRun = args.includes("--dry-run");
const target = Math.max(10, Math.min(15, parseInt(arg("target") ?? "12", 10)));

function bkkDateString(d: Date): string {
  const shifted = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

const feedDate = arg("feed-date") ?? bkkDateString(new Date());
const poolPath = path.join(process.cwd(), "data", "pool", `pool-${feedDate}.json`);
const reviewDir = path.resolve(process.cwd(), "..", "..", "curation-review");
const reviewPath = path.join(reviewDir, `review-${feedDate}.md`);

console.log(`[pool-finalize] feedDate=${feedDate} target=${target} dryRun=${dryRun}`);
console.log(`[pool-finalize] poolPath=${poolPath}`);
console.log(`[pool-finalize] reviewPath=${reviewPath}`);

// ── Cross-day dedup: load recent published titles ──────────────────────────

/**
 * Pulls titles of articles published in the last `days` days (excluding
 * `excludeFeedDate` itself), regardless of stage. Used to prevent Claude
 * from re-selecting stories that have already run in the feed.
 */
async function loadRecentTitles(excludeFeedDate: string, days: number): Promise<string[]> {
  if (!process.env.SUPABASE_URL) {
    console.warn("[pool-finalize] SUPABASE_URL not set — skipping recent-titles dedup");
    return [];
  }
  // Compute cutoff: days before excludeFeedDate (inclusive of cutoff, exclusive of excludeFeedDate itself)
  const end = new Date(excludeFeedDate + "T00:00:00Z");
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const cutoff = start.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("articles")
    .select("title,feed_date")
    .gte("feed_date", cutoff)
    .lt("feed_date", excludeFeedDate)
    .order("feed_date", { ascending: false });

  if (error) {
    console.warn("[pool-finalize] failed to load recent titles:", error.message);
    return [];
  }
  const titles = (data ?? []).map((r: { title: string }) => r.title).filter(Boolean);
  return titles;
}

// ── Claude final selection ─────────────────────────────────────────────────

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

interface Selection {
  idx: number;              // 1-based index into the `potential` list we sent
  reasoning: string;
}

async function finalSelect(
  potentials: Array<{ title: string; source: string; description: string; score: number; clusterSize: number; clusterSources: string[] }>,
  recentTitles: string[]
): Promise<Selection[]> {
  const numbered = potentials
    .map((it, i) => `${i + 1}. [${it.source}] "${it.title}" (score=${it.score}, covered by ${it.clusterSize} source${it.clusterSize > 1 ? "s" : ""}${it.clusterSize > 1 ? ": " + it.clusterSources.join(", ") : ""}) — ${it.description.slice(0, 200)}`)
    .join("\n");

  const recentBlock = recentTitles.length
    ? `\n\nALREADY PUBLISHED IN THE LAST 7 DAYS (${recentTitles.length} headlines) — DO NOT re-publish the same story even if today's framing, headline, or source differs. These are OFF-LIMITS:\n${recentTitles.map((t) => `  - ${t}`).join("\n")}\n`
    : "";

  const prompt = `You are the final editor of a daily pop-culture feed aimed at culturally-literate millennials. The feed runs 10–15 stories per day, designed as a fast, shareable scroll that captures the day's cultural pulse.

SELECTION PHILOSOPHY (most important rule):
Story quality comes FIRST. Theme / topic / tone balance is a SOFT TIE-BREAKER, never a hard cap.
- If two crime stories are both genuinely strong on their own merits, include both. Do NOT drop one just because "we already have a crime story".
- If three mass-brand stories are all newsworthy, include all three.
- If two A-tier celebrities died on the same day, publish both.
- Theme balance only matters when picking between items of similar quality — use it to avoid monotony, not to override genuine story strength.
- Never skip a strong story to "leave room for variety". Variety is a nice-to-have; quality is the point.

EDITORIAL GOALS:
- Think across five axes when tie-breaking for balance: Power (politics+culture crossover), Tech (meaningful tech+society), Culture (music/film/fashion/art), Internet (distinctive viral/meme), Human (scaled drama, celebrity crossovers, behavioral shifts)
- Prioritise narrative reversals, power/tech/control moves, unexpected crossovers, fandom-driven real-world behavior
- Favor stories covered by multiple sources (clusterSize > 1) when tie-breaking on score
- Prefer novel internet culture over low-quality viral-of-the-day

MUST-HAVE LANES (actively hunt for these — do NOT over-index on "smart/substantial" picks):

1. MASS-RECOGNITION BRAND MOMENTS — globally-recognised consumer brands doing something new (Nutella new flavor, IKEA × Chupa Chups meatball lollipop, McDonald's limited item, Lego weird collab, Starbucks × tech company, etc.). Near-automatic inclusions. Universal recognition = universal shareability. Do NOT skip just because it's a "food" or "consumer product" story — those travel further than niche "smart" stories. Aim for at least 1 per feed when available.

2. DEBUNKING / BELIEF REVERSALS — studies that overturn widely-held internet beliefs (manifestation debunked, popular diet disproven, habit-stacking myth, TikTok wellness claim tested). Highly shareable precisely because millions hold the belief. Score penalty for skipping these when in pool.

3. DELIGHT + ABSURDITY TEXTURE — weird brand mashups, luxury absurdism (peacock watches, $80K handbags), politician-with-a-prior-life (NYC mayor still earning rap royalties), oddly-specific consumer moments. These are the feed's TEXTURE — a feed without any feels like homework. Include as many as the pool genuinely offers, don't artificially cap.

4. LEGACY LEGEND MOMENTS — iconic living musicians/artists (McCartney, Ringo, Stevie Wonder, Dylan, Madonna, Dolly level) doing something new / collaborating / breaking silences. Even a short announcement is mass-resonant. Prioritise over a same-score new-artist release.

5. CELEBRITY INCIDENTS with scaled drama — public attack, arrest, breakup with concrete details. Include as many as are genuinely strong on their own; don't cap.

6. RELATABLE OUTRAGE / UNFAIRNESS — concrete pricing or inequality stories with mass resonance (absurd event pricing, venue surge fees, airline fee chaos). Crosses culture and daily life.

SCORING BIAS: Do NOT over-penalise "lightweight" picks. Stories earn their spot through any of: depth, familiarity, absurdity, emotional resonance, shareability. A Nutella new flavor at score 35 beats a senator's AI prediction at score 70.

POLITICS RULE (strict):
- REJECT pure US/UK legislative process stories (bills, senators debating, party votes, committee moves) unless they involve a globally-recognised household-name figure (Trump, Obama, Biden, AOC, Sanders, Musk-as-political-actor, etc.) OR directly affect culture, tech, or daily life in a way a non-political reader will immediately feel.
- A senator most readers have never heard of making a prediction = REJECT.
- "Republican/Democrat revolt over [process bill]" = REJECT.
- Politics is only in if it crosses over into culture, tech control, surveillance that affects normal people, or names everyone knows.

SOFT ANTI-PATTERNS (avoid if it doesn't cost you a strong story):
- Over-indexing on pure AI/tech narratives without cultural hooks
- Low-signal viral with no staying power (but novel/absurd/brand moments ARE high-signal)
- Pure trailer-only list with no substance
- Skipping a mass-brand moment or debunking story because you preferred something "weightier"
Note: these are soft preferences. If every pick independently earns its spot, don't drop one just to satisfy variety.

DEDUP RULES:
1. Within today's candidates: if multiple items describe the same story, pick the best framing (best source, best headline) and include once.
2. Against already-published stories (list below): REJECT anything that is the same underlying story as one we've already run in the last 7 days, even if today's source has a different angle, update, or follow-up detail. New angles on a yesterday story = skip unless it's a genuinely major new development (arrest, death, resolution).${recentBlock}
TASK: Pick exactly ${target} stories. Return JSON array, one entry per pick:
[{"idx": 7, "reasoning": "short one-liner — why this made the cut vs. alternatives"}, ...]

Order the array by how prominent the story should be in the feed (top = most prominent).

Respond with ONLY the JSON array, no prose.

Candidate pool (${potentials.length} items, all passed per-fetch scoring):
${numbered}`;

  const body = JSON.stringify({
    model: "claude-opus-4-6",
    max_tokens: 6000,
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
            reject(new Error(`finalSelect HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
          } else {
            try {
              const json = JSON.parse(data);
              const text = json?.content?.[0]?.type === "text" ? json.content[0].text : "";
              resolve(text);
            } catch (e) {
              reject(new Error(`finalSelect parse: ${(e as Error).message}`));
            }
          }
        });
      }
    );
    req.setTimeout(180_000, () => req.destroy(new Error("finalSelect timeout")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`finalSelect: no JSON array in response — got: ${raw.slice(0, 300)}`);
  return JSON.parse(match[0]) as Selection[];
}

// ── Review doc writer ──────────────────────────────────────────────────────

function writeReviewDoc(
  pool: Pool,
  publishedItems: PoolItem[],
  enriched: EnrichedArticle[],
  borderlineBelowCut: PoolItem[]
): void {
  const publishedIds = new Set(publishedItems.map((p) => p.id));
  const potentialNotPublished = pool.items.filter(
    (p) => p.verdict === "potential" && !publishedIds.has(p.id)
  );
  // Group rejects
  const lowScore = pool.items.filter((p) => p.verdict === "rejected" && p.score < 40);
  const midScore = pool.items.filter((p) => p.verdict === "rejected" && p.score >= 40);

  // Unique cluster count
  const uniqueClusters = new Set(pool.items.map((p) => p.clusterId)).size;

  // Top sources by coverage (items with their source in clusterSources)
  const sourceCoverage = new Map<string, number>();
  pool.items.forEach((p) => p.clusterSources.forEach((s) => sourceCoverage.set(s, (sourceCoverage.get(s) ?? 0) + 1)));
  const topSources = [...sourceCoverage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const lines: string[] = [];
  lines.push(`# Review — ${pool.feedDate}`);
  lines.push("");
  lines.push(`Generated ${new Date().toISOString()} · 24h window starting ${pool.dayStart}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Fetches run:** ${pool.fetches.length} / 5`);
  lines.push(`- **Total items in pool:** ${pool.items.length}`);
  lines.push(`- **Unique stories (clusters):** ${uniqueClusters}`);
  lines.push(`- **Potential:** ${pool.items.filter((p) => p.verdict === "potential" || p.verdict === "published").length}`);
  lines.push(`- **Rejected by scoring:** ${pool.items.filter((p) => p.verdict === "rejected").length}`);
  lines.push(`- **Published to preview:** ${publishedItems.length}`);
  lines.push("");
  lines.push("### Fetches");
  lines.push("");
  lines.push("| # | Window | Items in window | New | Dedup merges |");
  lines.push("|---|---|---|---|---|");
  pool.fetches.forEach((f) => {
    lines.push(`| ${f.n} | ${f.windowStart.slice(11, 16)}→${f.windowEnd.slice(11, 16)} UTC | ${f.itemsInWindow} | ${f.itemsAdded} | ${f.dedupMerges} |`);
  });
  lines.push("");
  lines.push("### Top sources by coverage");
  lines.push("");
  lines.push(topSources.map(([s, n]) => `- ${s}: ${n}`).join("\n"));
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`## ✓ Published (${publishedItems.length})`);
  lines.push("");
  publishedItems.forEach((p, i) => {
    const enr = enriched.find((e) => e.title === p.title);
    const img = enr?.imageUrl;
    lines.push(`### ${i + 1}. ${p.title}`);
    lines.push("");
    lines.push(`- **Source:** ${p.source} · **Score:** ${p.score} · **Coverage:** ${p.clusterSize} source${p.clusterSize > 1 ? "s" : ""}`);
    if (enr) {
      lines.push(`- **Category:** ${enr.category} · **Tag:** ${enr.tag}`);
    }
    lines.push(`- **Why published:** ${p.publishedReasoning ?? "—"}`);
    lines.push(`- **Per-fetch reasoning:** ${p.reasoning}`);
    if (img) lines.push(`- ![image](${img})`);
    lines.push(`- [Original article](${p.url})`);
    lines.push("");
  });
  lines.push("---");
  lines.push("");
  lines.push(`## ⚬ Not published — potential but not picked (${potentialNotPublished.length})`);
  lines.push("");
  lines.push("_These passed scoring but didn't make the final 10–15 cut. The first ~10 are the closest calls; tell me any numbers to swap in._");
  lines.push("");
  potentialNotPublished
    .sort((a, b) => b.score - a.score)
    .forEach((p, i) => {
      lines.push(`${i + 1}. **[${p.source}]** "${p.title}" — score=${p.score}, coverage=${p.clusterSize}`);
      lines.push(`   - ${p.reasoning}`);
      lines.push(`   - [Link](${p.url})`);
    });
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`## ✗ Rejected — mid-score (${midScore.length})`);
  lines.push("");
  lines.push("_Score 40–49. Borderline noise. Flag here if you want me to consider any._");
  lines.push("");
  midScore.sort((a, b) => b.score - a.score).forEach((p) => {
    lines.push(`- **[${p.source}]** "${p.title}" — score=${p.score} — ${p.reasoning}`);
  });
  lines.push("");
  lines.push(`## ✗ Rejected — low-score (${lowScore.length})`);
  lines.push("");
  lines.push("_Score < 40. Routine noise / off-brand / promo. Expand only if nothing else is working._");
  lines.push("");
  lines.push("<details><summary>Expand low-score list</summary>");
  lines.push("");
  lowScore.sort((a, b) => b.score - a.score).forEach((p) => {
    lines.push(`- **[${p.source}]** "${p.title}" — score=${p.score}`);
  });
  lines.push("");
  lines.push("</details>");
  lines.push("");

  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(reviewPath, lines.join("\n"));
  console.log(`[pool-finalize] ✓ review doc written: ${reviewPath}`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!fs.existsSync(poolPath)) {
    console.error(`[pool-finalize] pool file not found: ${poolPath}`);
    console.error("Have you run pool-fetch.ts at least once for this feedDate?");
    process.exit(1);
  }

  const pool = JSON.parse(fs.readFileSync(poolPath, "utf8")) as Pool;
  console.log(`[pool-finalize] pool has ${pool.items.length} items across ${pool.fetches.length} fetches`);

  // Dedup at the cluster level: one representative per cluster, highest score wins
  const byCluster = new Map<string, PoolItem>();
  for (const it of pool.items) {
    if (it.verdict !== "potential" && it.verdict !== "published") continue;
    const existing = byCluster.get(it.clusterId);
    if (!existing || it.score > existing.score) byCluster.set(it.clusterId, it);
  }
  const representatives = [...byCluster.values()].sort((a, b) => b.score - a.score);
  console.log(`[pool-finalize] potential cluster reps: ${representatives.length}`);

  if (representatives.length === 0) {
    console.error("[pool-finalize] no potential items to choose from — exiting");
    process.exit(1);
  }

  // Pull last 7 days of published titles from Supabase for cross-day dedup
  const recentTitles = await loadRecentTitles(feedDate, 7);
  console.log(`[pool-finalize] passing ${recentTitles.length} recent titles to editor for dedup`);

  // Final Claude selection
  console.log(`[pool-finalize] asking Claude to pick ${target} from ${representatives.length}...`);
  const selections = await finalSelect(
    representatives.map((r) => ({
      title: r.title,
      source: r.source,
      description: r.description,
      score: r.score,
      clusterSize: r.clusterSize,
      clusterSources: r.clusterSources,
    })),
    recentTitles
  );
  console.log(`[pool-finalize] Claude selected ${selections.length}`);

  // Map selections back to items
  const publishedItems: PoolItem[] = [];
  for (const sel of selections) {
    const idx = sel.idx - 1;
    if (idx < 0 || idx >= representatives.length) {
      console.warn(`[pool-finalize] bad idx ${sel.idx} — skipping`);
      continue;
    }
    const item = representatives[idx];
    item.publishedReasoning = sel.reasoning;
    publishedItems.push(item);
  }

  // Mark published in pool (mutates all cluster members)
  const publishedClusterIds = new Set(publishedItems.map((p) => p.clusterId));
  pool.items.forEach((p) => {
    if (publishedClusterIds.has(p.clusterId) && (p.verdict === "potential" || p.verdict === "published")) {
      p.verdict = "published";
    }
  });

  // Run enrichment + image pipeline on selected items
  let enriched: EnrichedArticle[] = [];
  if (!dryRun && publishedItems.length > 0) {
    const rawItems: RawRSSItem[] = publishedItems.map((p) => ({
      title: p.title,
      description: p.description,
      link: p.url,
      pubDate: p.pubDate,
      source: p.source,
      imageUrl: p.rawImageUrl,
    }));

    console.log(`[pool-finalize] enriching ${rawItems.length} articles...`);
    enriched = await enrichSelectedItems(rawItems, true);
    console.log(`[pool-finalize] ✓ enrichment complete (${enriched.length} articles)`);

    console.log("[pool-finalize] merging into feed + saving to Supabase dev stage...");
    const added = mergeFeed(enriched);
    saveCommittedFeed();
    console.log(`[pool-finalize] ✓ ${added} new articles merged to today's feed`);
  } else if (dryRun) {
    console.log("[pool-finalize] --dry-run: skipping enrichment + Supabase write");
  }

  // Persist updated pool (verdict changes)
  pool.finalizedAt = new Date().toISOString();
  fs.writeFileSync(poolPath, JSON.stringify(pool, null, 2) + "\n");
  console.log(`[pool-finalize] ✓ pool updated with published verdicts`);

  // Borderline candidates: top 8 potential-not-published for easy swap reference
  const publishedIds = new Set(publishedItems.map((p) => p.id));
  const borderlineBelowCut = pool.items
    .filter((p) => (p.verdict === "potential") && !publishedIds.has(p.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  writeReviewDoc(pool, publishedItems, enriched, borderlineBelowCut);

  console.log(`[pool-finalize] DONE — ${publishedItems.length} published, review at ${reviewPath}`);
}

main().catch((e) => {
  console.error("[pool-finalize] fatal:", e);
  process.exit(1);
});
