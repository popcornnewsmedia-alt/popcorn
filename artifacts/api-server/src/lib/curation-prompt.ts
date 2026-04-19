// ─────────────────────────────────────────────────────────────────────────────
// POPCORN CURATION — PROMPT COMPOSITION
//
// Combines the editorial brief (stable voice) with the pattern library
// (living examples) and exposes three role-specific prompt builders:
//
//   buildScorerPrompt     — per-RSS-batch 0-100 scoring (pool-fetch.ts)
//   buildFinalizerPrompt  — end-of-day final cut (pool-finalize.ts)
//   buildRefreshPrompt    — manual /api/refresh trigger (rss-enricher.ts)
//
// All three share the same brief + pattern library. Only the task framing
// and output format differ per role.
// ─────────────────────────────────────────────────────────────────────────────

import { CURATION_BRIEF } from "./curation-brief.js";
import { CURATION_PATTERNS } from "./curation-patterns.js";

const SHARED_CONTEXT = `${CURATION_BRIEF}\n\n${CURATION_PATTERNS}`;

// ── Scorer (per-fetch RSS batches) ──────────────────────────────────────────

export interface ScorerItem {
  title: string;
  source: string;
  description: string;
}

export function buildScorerPrompt(batch: ScorerItem[]): string {
  const numbered = batch
    .map((it, i) => `${i + 1}. [${it.source}] "${it.title}" — ${it.description.slice(0, 200)}`)
    .join("\n");

  return `${SHARED_CONTEXT}

---

## YOUR TASK — RSS BATCH SCORING

You are scoring a batch of RSS items as they arrive throughout the day. The best-scoring items go into the daily pool, from which the final cut is made later.

Score each item 0-100 based on the editorial brief and patterns above:
- 75-100 → clearly earns a spot (strong Popcorn story)
- 50-74 → potential — deserves to be in the pool for later consideration
- 0-49 → reject — does not belong

Classify as \`potential\` (score ≥ 50) or \`rejected\` (score < 50).

**Be generous with:** novelty, delight, consumer-internet, mass-brand, "wait, what?" hooks, debunking, legacy-legend moments, luxury absurdism, delight-power crossovers. These are historically under-scored and have cost us the best stories.

**Be harsh with:** inside-the-Beltway politics (unknown senators, process bills), product roundups, incremental updates, abstract think pieces, duplicate framings, low-signal viral, industry-only news, commentary dressed as news.

**A Nutella new flavor at score 35 beats a senator at score 70.** If you feel yourself penalising a "light" story just because it's fun, re-read the editorial instincts.

Respond with JSON only, an array, one entry per input item:
[{"idx":1,"score":78,"verdict":"potential","reasoning":"short one-liner"},...]

Items:
${numbered}`;
}

// ── Finalizer (end-of-day cut from accumulated pool) ────────────────────────

export interface FinalizerItem {
  title: string;
  source: string;
  description: string;
  score: number;
  clusterSize: number;
  clusterSources: string[];
}

export function buildFinalizerPrompt(
  potentials: FinalizerItem[],
  recentTitles: string[],
  target: number,
): string {
  const numbered = potentials
    .map((it, i) => {
      const cluster = it.clusterSize > 1
        ? ` (covered by ${it.clusterSize} sources: ${it.clusterSources.join(", ")})`
        : ` (covered by 1 source)`;
      return `${i + 1}. [${it.source}] "${it.title}" (score=${it.score}${cluster}) — ${it.description.slice(0, 200)}`;
    })
    .join("\n");

  const recentBlock = recentTitles.length
    ? `

---

## ALREADY PUBLISHED IN THE LAST 7 DAYS — OFF-LIMITS

The following stories have been published in the last 7 days. DO NOT re-publish any of them, even if today's source, headline, or angle is different.

Same underlying story = same story. If you recognise the named entity AND the triggering event from this list, SKIP IT. This is the single most trust-breaking failure mode — cross-day duplicates destroy user confidence. The ONLY exception is a genuinely major new development (arrest, death, verdict, resolution).

${recentTitles.map((t) => `  - ${t}`).join("\n")}
`
    : "";

  return `${SHARED_CONTEXT}${recentBlock}

---

## YOUR TASK — END-OF-DAY FINAL CUT

You are picking the final feed from the day's accumulated pool. The pool has already been pre-filtered by per-fetch scoring — everything here passed the initial bar, but many still don't belong in the final cut.

Pick approximately ${target} stories (flex 12-20 based on what genuinely earns a spot). Do NOT pad to hit a number.

**Before returning, run the final check:**
1. Would I forward at least 5 of these to a friend?
2. Does this feel like a feed, not a news dump?
3. Is there at least one genuinely surprising story?
4. Is there at least one that's slightly ridiculous?
5. Any cross-day duplicates? → revise
6. Any dark-gravity stack (2+ crime/scandal)? → revise
7. Any thematic stack (2+ surveillance / 2+ AI-launches / similar)? → revise

**When tie-breaking on score:** favor stories covered by multiple sources (clusterSize > 1), favor novelty and delight over "importance," favor the specific over the abstract.

Return a JSON array, ordered by prominence (top = most prominent):
[{"idx": 7, "reasoning": "short one-liner — why this made the cut vs. alternatives"}, ...]

Respond with ONLY the JSON array, no prose.

Candidate pool (${potentials.length} items, all passed per-fetch scoring):
${numbered}`;
}

// ── Refresh editor (/api/refresh manual trigger) ────────────────────────────

export interface AlreadyPublished {
  title: string;
}

export function buildRefreshPrompt(
  articleList: string,
  alreadyPublished: AlreadyPublished[],
  today: string,
): string {
  const alreadyPublishedBlock =
    alreadyPublished.length > 0
      ? `

---

## ALREADY IN TODAY'S FEED — OFF-LIMITS

These stories are already in today's feed. Your selections must all be NEW stories. Judge by story identity, not headline wording. If nothing new clears the bar, select zero. Same entity + same triggering event = same story = SKIP.

${alreadyPublished.map((a, i) => `${i + 1}. ${a.title}`).join("\n")}
`
      : "";

  return `${SHARED_CONTEXT}

Today is ${today}.${alreadyPublishedBlock}

---

## YOUR TASK — MANUAL REFRESH SELECTION

You are selecting from a pool of candidate articles for today's feed. Apply the editorial brief and patterns above.

${
  alreadyPublished.length === 0
    ? `This is a FULL RESET RUN with no existing feed. Apply the full editorial bar across all domains. Do not pad with borderline entertainment content — if the strong stories only cover 3 domains, that is fine.`
    : `This is an INCREMENTAL UPDATE. ${alreadyPublished.length} stories are already in today's feed (including cross-day historical dedup from all previously published editions). Only add stories clearly stronger than the weakest already published. Prefer 2 excellent new stories over 8 mediocre ones.`
}

Output ONLY a compact JSON array — one object per selected article:
{"sourceIndex":N,"score":N,"bucket":"CULTURE|INTERNET|CREATOR ECONOMY|CULTURAL SPILLOVER"}

If nothing qualifies, output [].
Respond with ONLY the JSON array — no markdown, no code fences, no rejected entries.

ARTICLES:
${articleList}`;
}
