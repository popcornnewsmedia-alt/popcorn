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

Pick approximately ${target} stories — ideal is **around 24-26 when the pool honestly supports it**. On light-signal days (weekends, slow news cycles, sparse pools) the right number may be lower; never pad to hit a count. The pool has already been scored — every item here passed the initial bar. Err toward inclusion for borderline stories; a missed story is worse than a borderline one that made the cut. Under-cutting is the more common failure mode — if you are at ~20 and the pool is rich, go back and rescue.

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
  recentTitles: string[] = [],
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

  const recentBlock = recentTitles.length > 0
    ? `

---

## PUBLISHED IN THE LAST 7 DAYS — DO NOT RE-RUN

The following stories have been published in recent days. Even if today's source, headline, or angle is different — if you recognise the named entity AND the triggering event, SKIP IT. This is the single most trust-breaking failure mode.

${recentTitles.map((t) => `  - ${t}`).join("\n")}
`
    : "";

  // Estimate pool size from articleList — used only for context in the prompt
  const approxPoolSize = (articleList.match(/\n\d+\./g) || []).length || 0;

  const currentFeedCount = alreadyPublished.length;
  const incrementalCeiling =
    currentFeedCount >= 26
      ? `Today's feed already has ${currentFeedCount} stories — at or above the ideal band. Only add a story if it is genuinely exceptional and clearly stronger than the weakest thing already published. If in doubt, do not add it.`
      : currentFeedCount >= 22
      ? `Today's feed has ${currentFeedCount} stories — inside the ~24-26 ideal band. Add only the strongest 2-4 picks. Do not pad. Quality over quantity.`
      : `This is an INCREMENTAL UPDATE. ${currentFeedCount} stories are already in today's feed (ideal is around 24-26 when the pool supports it). Add stories clearly stronger than the weakest already published. Prefer 3 excellent new stories over 8 mediocre ones.`;

  return `${SHARED_CONTEXT}

Today is ${today}.${recentBlock}${alreadyPublishedBlock}

---

## YOUR TASK — MANUAL REFRESH SELECTION

You are selecting from a pool of candidate articles for today's feed. Apply the editorial brief and patterns above.

${
  alreadyPublished.length === 0
    ? `This is a FULL RESET RUN with no existing feed. The pool has ~${approxPoolSize} candidates — every one already passed scoring.

**Ideal target: around 24-26 stories when the pool honestly supports it.** This is guidance, not a constraint. On light-signal days (weekends, slow news cycles, sparse pools) the right number may be lower — never pad to hit a count. There is no hard floor and no hard ceiling. Quality first, breadth second.

**Soft framing on under-cutting:** the auto-selector has historically under-cut on rich pools (Apr 25: 5 from 80; Apr 26: 3 from 100; May 12: 16 from 96), requiring 10-15 manual rescues across the same missed patterns: music live events, Film & TV trailers, internet culture, sports with cultural angle, fun/filler, fashion collabs. If the pool is rich and you are at <22, go back and rescue. If the pool is genuinely light, fewer picks is the right answer.

**Axis coverage check before returning (guidance, not floor):** music, film/TV, internet culture, fun/filler, sports/fashion/culture wildcard. If any axis is empty and the pool offered candidates worth rescuing, go back for them. If the pool truly didn't offer one, leave it empty — don't force coverage with a weak pick.`
    : incrementalCeiling
}

## OUTPUT FORMAT — STRICT

Your ENTIRE response must be a single JSON array. Nothing else.

- NO preamble, NO "Looking at the pool...", NO "I'll work through this systematically", NO axis-coverage walkthrough, NO per-item analysis, NO DEDUP CHECK narration.
- NO markdown, NO code fences, NO commentary before or after.
- Do the axis-coverage and dedup checks SILENTLY in your head. The user sees only the final array.
- If you start writing prose, STOP and emit the array.

Schema — one object per selected article:
{"sourceIndex":N,"score":N,"bucket":"CULTURE|INTERNET|CREATOR ECONOMY|CULTURAL SPILLOVER"}

If nothing qualifies, output exactly: []

ARTICLES:
${articleList}

REMEMBER: respond with ONLY the JSON array. First character of your response must be '[' and last character must be ']'.`;
}

// ── Per-window Consideration (Haiku — lightweight pre-filter) ────────────────

export interface ConsiderationItem {
  title: string;
  source: string;
  description: string;
}

export function buildConsiderationPrompt(
  items: ConsiderationItem[],
  feedbackContext: string,
): string {
  const numbered = items
    .map((it, i) => `${i + 1}. [${it.source}] "${it.title}"${it.description ? ` — ${it.description.slice(0, 150)}` : ""}`)
    .join("\n");

  const feedbackBlock = feedbackContext
    ? `\n---\n\n## EDITORIAL FEEDBACK (last 14 days — learn from these patterns)\n\n${feedbackContext}\n`
    : "";

  return `${CURATION_BRIEF}${feedbackBlock}
---

## YOUR TASK — WINDOW SHORTLISTING

You are screening a batch of RSS articles for potential inclusion in the Popcorn daily feed. This is a pre-filter, not the final decision — err toward inclusion.

Pick 8-15 articles that have genuine Popcorn potential. A borderline story included now can be dropped later; a missed story cannot be recovered without manual work.

**Include:** music events/releases/tours, Film & TV trailers/IP moments, internet culture, sports with cultural angle, fashion/design collabs, fun/quirky/shareable stories, surprising celebrity moments, tech with mass-cultural impact.

**Exclude:** political process news (senators, bills, votes), crime without celebrity hook, incremental product updates, inside-baseball industry news, low-signal viral-of-the-day.

Return ONLY a JSON array of 1-based indices, e.g.: [1, 5, 12, 23, 31]
No explanation. No prose. Just the array.

Articles (${items.length} total):
${numbered}`;
}
