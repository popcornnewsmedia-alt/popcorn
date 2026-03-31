/**
 * RSS Enricher — fetches live pop culture news from RSS feeds and enriches each article
 * with Claude to generate summaries, key points, signal scores, etc.
 *
 * Cache: writes to /tmp/bref-articles-YYYY-MM-DD.json so Claude is only
 * called once per day (per machine restart).
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

// ─── Image pool ────────────────────────────────────────────────────────────
// Curated Unsplash photos that work well as article hero images.
// Claude picks an index from this list for each article.
const IMAGE_POOL = [
  "https://images.unsplash.com/photo-1677442136019-21780ecad979?w=800&q=80", // 0  AI / neural-net glow
  "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80", // 1  humanoid robot face
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80", // 2  circuit board
  "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80", // 3  blockchain/crypto
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80", // 4  code on screen
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80", // 5  earth from space / data
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80", // 6  people + data viz
  "https://images.unsplash.com/photo-1436262513933-a0b06755c784?w=800&q=80", // 7  law / policy
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80", // 8  tech executive portrait
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80", // 9  lab / science
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80", // 10 server racks
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80", // 11 data dashboard
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80", // 12 robot close-up
  "https://images.unsplash.com/photo-1509475826633-fed577a2c71b?w=800&q=80", // 13 brain / mind abstract
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80", // 14 cybersecurity / shield
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80", // 15 matrix / green code
  "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80", // 16 startup / team
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80", // 17 laptop + code
  "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=800&q=80", // 18 screens / monitor wall
  "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80", // 19 laptop + dark theme
];

const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  Models: ["#1e1e2e", "#4a4a7a"],
  Research: ["#0a2a1a", "#3a7a5a"],
  Industry: ["#2a1a0a", "#8a6a3a"],
  Policy: ["#1a1a2a", "#5a6a9a"],
  Tools: ["#1a0a2a", "#6a3a8a"],
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RawRSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
}

export interface EnrichedArticle {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  source: string;
  readTimeMinutes: number;
  publishedAt: string;
  likes: number;
  isBookmarked: boolean;
  gradientStart: string;
  gradientEnd: string;
  tag: string;
  imageUrl?: string | null;
  keyPoints?: string[] | null;
  impact?: string | null;
  signalScore?: number | null;
}

// ─── XML helpers ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string {
  // Handles CDATA and plain content
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    "i"
  );
  const m = block.match(re);
  if (!m) return "";
  return stripHtml((m[1] ?? m[2] ?? "").trim());
}

function parseRSSItems(xml: string, source: string): RawRSSItem[] {
  const isAtom = /<feed[\s>]/i.test(xml);
  const pattern = isAtom
    ? /<entry>([\s\S]*?)<\/entry>/gi
    : /<item>([\s\S]*?)<\/item>/gi;

  const items: RawRSSItem[] = [];
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(xml)) !== null && items.length < 12) {
    const block = m[1];

    const title = extractTag(block, "title");
    if (!title || title.length < 5) continue;

    let description =
      extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content\\:encoded") ||
      extractTag(block, "content");
    description = description.slice(0, 600);

    // Link
    let link = "";
    const linkM =
      block.match(/<link>([^<]+)<\/link>/) ||
      block.match(/<link[^>]+href="([^"]+)"/i);
    if (linkM) link = linkM[1].trim();

    // Date
    let pubDate = new Date().toISOString();
    const dateM =
      block.match(/<pubDate>([^<]+)<\/pubDate>/i) ||
      block.match(/<published>([^<]+)<\/published>/i) ||
      block.match(/<updated>([^<]+)<\/updated>/i);
    if (dateM) pubDate = dateM[1].trim();

    items.push({ title, description, link, pubDate, source });
  }

  return items;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function fetchFeed(
  url: string,
  sourceName: string
): Promise<RawRSSItem[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Popcorn/1.0; +https://popcorn.news) RSS reader",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRSSItems(xml, sourceName);
    console.log(`[rss] ${sourceName}: ${items.length} items`);
    return items;
  } catch (e) {
    console.warn(`[rss] ⚠ Failed to fetch ${sourceName} (${url}): ${e}`);
    return [];
  }
}

// ─── Claude enrichment ───────────────────────────────────────────────────────

async function enrichWithClaude(
  rawItems: RawRSSItem[]
): Promise<EnrichedArticle[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const articleList = rawItems
    .map(
      (item, i) =>
        `[${i + 1}] SOURCE: ${item.source}\nTITLE: ${item.title}\nDESCRIPTION: ${item.description || "(none)"}`
    )
    .join("\n\n---\n\n");

  const imageListStr = IMAGE_POOL.map((url, i) => `${i}: ${url}`).join("\n");

  const prompt = `You are the editorial AI for Popcorn — a sharp, opinionated pop culture news app. Today is ${today}.

Below are ${rawItems.length} recent headlines pulled from pop culture news sources. Your job:

1. Pick the **6 most important and genuinely newsworthy** articles. Prioritise: concrete product launches, breakthrough research, significant funding/acquisitions, meaningful policy changes. Deprioritise: opinion fluff, reworded press releases, minor updates.

2. For each chosen article, produce a full editorial write-up in Popcorn's voice — analytical, no-nonsense, reader-respects-your-time.

ARTICLES:
${articleList}

AVAILABLE HERO IMAGES (assign one index per article — match the image topic to the article content):
${imageListStr}

For each of the 6 selected articles, output a JSON object with EXACTLY these fields:
{
  "title": "Punchy headline, max 10 words",
  "summary": "2-sentence TL;DR shown on the card — hook the reader",
  "content": "3–4 paragraphs of editorial prose separated by \\n\\n. Analytical, first-person plural voice ('We', 'What this means'). No bullet lists inside content.",
  "keyPoints": ["3–5 concise takeaway bullets (string array)"],
  "impact": "One blunt sentence: why does this matter beyond the tech bubble?",
  "signalScore": 0-100,
  "tag": "ONE of: BREAKING | ANALYSIS | RESEARCH | INDUSTRY | POLICY | INTERVIEW | BREAKTHROUGH",
  "category": "ONE of: Models | Research | Industry | Policy | Tools",
  "source": "Original source name",
  "imageIndex": <number from image list>,
  "readTimeMinutes": <integer 3–8>
}

Respond with ONLY a valid JSON array — no markdown, no code fences, no commentary before or after.`;

  console.log("[rss] Calling Claude to enrich articles...");
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Extract JSON array (in case Claude adds any stray text)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("[rss] Claude response did not contain a JSON array:\n", text.slice(0, 500));
    throw new Error("Claude response did not contain a JSON array");
  }

  let parsed: any[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[rss] Failed to parse Claude JSON:", e);
    throw e;
  }

  console.log(`[rss] Claude returned ${parsed.length} enriched articles`);

  return parsed.map((item: any, i: number) => {
    const cat = item.category in CATEGORY_GRADIENTS ? item.category : "Industry";
    const [gradientStart, gradientEnd] = CATEGORY_GRADIENTS[cat];
    const imgIdx = typeof item.imageIndex === "number" ? item.imageIndex : i % IMAGE_POOL.length;

    return {
      id: i + 1,
      title: String(item.title ?? ""),
      summary: String(item.summary ?? ""),
      content: String(item.content ?? ""),
      category: cat,
      source: String(item.source ?? "Unknown"),
      readTimeMinutes: Number(item.readTimeMinutes) || 5,
      publishedAt: new Date().toISOString(),
      likes: Math.floor(Math.random() * 4500) + 500,
      isBookmarked: false,
      gradientStart,
      gradientEnd,
      tag: String(item.tag ?? "ANALYSIS"),
      imageUrl: IMAGE_POOL[imgIdx] ?? IMAGE_POOL[i % IMAGE_POOL.length],
      keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints : [],
      impact: item.impact ? String(item.impact) : null,
      signalScore: typeof item.signalScore === "number" ? item.signalScore : null,
    } satisfies EnrichedArticle;
  });
}

// ─── Cache + public API ───────────────────────────────────────────────────────

function cachePath(): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return path.join("/tmp", `infer-articles-${dateStr}.json`);
}

let _inMemoryCache: EnrichedArticle[] | null = null;

/**
 * Load today's live articles.
 * 1. Returns in-memory cache if available.
 * 2. Falls back to disk cache (/tmp/bref-articles-YYYY-MM-DD.json).
 * 3. Otherwise fetches RSS feeds + calls Claude, then writes disk cache.
 */
export async function loadLiveArticles(): Promise<EnrichedArticle[]> {
  if (_inMemoryCache) return _inMemoryCache;

  // Check disk cache first
  const cp = cachePath();
  if (fs.existsSync(cp)) {
    try {
      const raw = fs.readFileSync(cp, "utf-8");
      _inMemoryCache = JSON.parse(raw) as EnrichedArticle[];
      console.log(`[rss] ✓ Loaded ${_inMemoryCache.length} articles from disk cache (${cp})`);
      return _inMemoryCache;
    } catch {
      console.warn("[rss] Disk cache corrupted, will re-fetch.");
      fs.unlinkSync(cp);
    }
  }

  // Fetch RSS feeds
  console.log("[rss] Fetching RSS feeds…");
  const feeds: [string, string][] = [
    [
      "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
      "The Verge",
    ],
    [
      "https://techcrunch.com/category/artificial-intelligence/feed/",
      "TechCrunch",
    ],
    ["https://venturebeat.com/category/ai/feed/", "VentureBeat"],
    ["https://artificialintelligence-news.com/feed/", "AI News"],
    [
      "https://feeds.arstechnica.com/arstechnica/technology-lab",
      "Ars Technica",
    ],
  ];

  const results = await Promise.allSettled(
    feeds.map(([url, name]) => fetchFeed(url, name))
  );

  const allItems = results
    .filter((r): r is PromiseFulfilledResult<RawRSSItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  console.log(`[rss] Total raw items: ${allItems.length}`);

  if (allItems.length < 5) {
    throw new Error(`Only ${allItems.length} articles fetched — too few to enrich`);
  }

  // Send up to 28 most recent items to Claude
  const toEnrich = allItems.slice(0, 28);

  const enriched = await enrichWithClaude(toEnrich);

  // Persist to disk
  try {
    fs.writeFileSync(cp, JSON.stringify(enriched, null, 2));
    console.log(`[rss] ✓ Wrote ${enriched.length} articles to ${cp}`);
  } catch (e) {
    console.warn("[rss] Could not write disk cache:", e);
  }

  _inMemoryCache = enriched;
  return enriched;
}

/** Clear caches (useful for testing) */
export function clearCache(): void {
  _inMemoryCache = null;
  const cp = cachePath();
  if (fs.existsSync(cp)) fs.unlinkSync(cp);
}
