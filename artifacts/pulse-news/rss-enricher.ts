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
// Category-matched fallback images — used only when a real image cannot be found
const CATEGORY_FALLBACK_IMAGES: Record<string, string[]> = {
  "Music": [
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80", // concert crowd
    "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&q=80", // festival stage
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80", // microphone
    "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80", // recording studio
    "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80", // DJ / nightlife
  ],
  "Film & TV": [
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80", // movie theater
    "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80", // film camera
    "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80", // retro TV
    "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&q=80", // streaming glow
  ],
  "Gaming": [
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&q=80", // gaming setup
    "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&q=80", // controller
    "https://images.unsplash.com/photo-1518972734183-cc86ec78ee26?w=800&q=80", // neon lights
  ],
  "Fashion": [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80", // runway
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80", // sneakers
    "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&q=80", // editorial
  ],
  "Culture": [
    "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&q=80", // gallery art
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80", // books
    "https://images.unsplash.com/photo-1536922246289-88c42f957773?w=800&q=80", // street culture
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80", // crowd
  ],
};

// Flat pool kept for legacy reference
const IMAGE_POOL = Object.values(CATEGORY_FALLBACK_IMAGES).flat();

function fallbackImage(category: string, seed: number): string {
  const pool = CATEGORY_FALLBACK_IMAGES[category] ?? CATEGORY_FALLBACK_IMAGES["Culture"];
  return pool[seed % pool.length];
}

const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  "Film & TV": ["#0e1a2e", "#2a3f6a"],
  Music:       ["#1a0e2e", "#4a2a6a"],
  Gaming:      ["#0a1e14", "#1e5a38"],
  Fashion:     ["#1e0a12", "#6a1e36"],
  Culture:     ["#1a1208", "#5a3e18"],
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RawRSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
  imageUrl?: string;
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
  signalScore?: number | null;
  wikiSearchQuery?: string;
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

function extractImage(block: string): string | undefined {
  // media:content url (most common in modern RSS — TMZ, Variety, etc.)
  const mc = block.match(/<media:content[^>]+url="([^"]+)"/i);
  if (mc && /\.(jpg|jpeg|png|webp|gif)/i.test(mc[1])) return mc[1];

  // media:thumbnail
  const mt = block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
  if (mt) return mt[1];

  // enclosure with image type
  const enc =
    block.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image/i) ||
    block.match(/<enclosure[^>]+type="image[^"]*"[^>]+url="([^"]+)"/i);
  if (enc) return enc[1];

  // <img src="..."> inside description/content
  const img = block.match(/<img[^>]+src="([^"]+)"/i);
  if (img && /^https?:\/\//.test(img[1])) return img[1];

  return undefined;
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
    description = description.slice(0, 250);

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

    const imageUrl = extractImage(block);
    items.push({ title, description, link, pubDate, source, imageUrl });
  }

  return items;
}

// ─── Image fetchers ──────────────────────────────────────────────────────────

const BAD_IMAGE_PATTERNS = [
  /i\.imgur\.com/,           // generic imgur placeholders
  /1x1/,                     // tracking pixels
  /pixel\./,                 // tracking pixels
  /spacer\.gif/,             // spacer GIFs
  /placeholder/i,            // placeholder images
  /default[-_]?(image|img|thumb)/i,
];

function isGoodImageUrl(url: string | undefined | null): boolean {
  if (!url || !url.startsWith("http")) return false;
  return !BAD_IMAGE_PATTERNS.some((p) => p.test(url));
}

async function fetchOGImage(articleUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(articleUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) return undefined;
    // Only read the first 20 KB — the <head> is always near the top
    const reader = res.body?.getReader();
    if (!reader) return undefined;
    let html = "";
    while (html.length < 20000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader.cancel();
    // og:image
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch?.[1]?.startsWith("http")) return ogMatch[1];
    // twitter:image as fallback
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch?.[1]?.startsWith("http")) return twMatch[1];
    return undefined;
  } catch {
    return undefined;
  }
}

// iTunes Search API (free, no key) — returns album/artist artwork at up to 600×600.
// Best for Music articles: searches album art first, then falls back to artist image.
async function fetchItunesImage(query: string): Promise<string | undefined> {
  if (!query?.trim()) return undefined;
  try {
    // Try to find a specific album first
    const albumUrl =
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}` +
      `&entity=album&media=music&limit=1`;
    const albumRes = await fetch(albumUrl, { signal: AbortSignal.timeout(6000) });
    if (albumRes.ok) {
      const albumData = await albumRes.json();
      const art: string | undefined = albumData?.results?.[0]?.artworkUrl100;
      if (art) return art.replace("100x100bb", "600x600bb");
    }
    // Fall back to artist image
    const artistUrl =
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}` +
      `&entity=musicArtist&media=music&limit=1`;
    const artistRes = await fetch(artistUrl, { signal: AbortSignal.timeout(6000) });
    if (artistRes.ok) {
      const artistData = await artistRes.json();
      const art: string | undefined = artistData?.results?.[0]?.artworkUrl100;
      if (art) return art.replace("100x100bb", "600x600bb");
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Fetch the main image from a Wikipedia page that matches the search query.
// Uses a two-step Wikipedia API call — no API key required.
async function fetchWikipediaImage(query: string): Promise<string | undefined> {
  if (!query?.trim()) return undefined;
  try {
    // Step 1: find the best-matching Wikipedia page title
    const searchUrl =
      `https://en.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=1`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
    if (!searchRes.ok) return undefined;
    const searchData = await searchRes.json();
    const pageTitle: string | undefined = searchData?.query?.search?.[0]?.title;
    if (!pageTitle) return undefined;

    // Step 2: get the original/thumbnail image for that page
    const imgUrl =
      `https://en.wikipedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(pageTitle)}` +
      `&prop=pageimages&piprop=original|thumbnail&pithumbsize=800` +
      `&format=json&origin=*`;
    const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(6000) });
    if (!imgRes.ok) return undefined;
    const imgData = await imgRes.json();
    const pages = Object.values(imgData?.query?.pages ?? {}) as any[];
    const src: string | undefined =
      pages[0]?.original?.source ?? pages[0]?.thumbnail?.source;
    // Skip SVG icons / logos / flags (bad hero images)
    if (src && src.startsWith("http") && !/\.svg$/i.test(src)) return src;
    return undefined;
  } catch {
    return undefined;
  }
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

// ─── Deduplication + ranking ─────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being",
  "has","have","had","do","does","did","will","would","could","should","may","might",
  "and","or","but","if","as","at","by","for","in","of","on","to","up","from","with",
  "that","this","these","those","it","its","he","she","they","we","you","i",
  "his","her","their","our","your","my","new","say","says","said","just","now",
  "after","before","over","about","how","why","what","when","where","who","which",
  "more","one","two","three","first","last","top","big","make","get","see","go",
]);

function titleTokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccardSim(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Deduplicate articles by title similarity, then rank by coverage × recency.
 * Returns the top `topN` unique stories — the ones with the most buzz.
 */
function deduplicateAndRank(items: RawRSSItem[], topN = 25): RawRSSItem[] {
  type Group = {
    representative: RawRSSItem;
    sourceCount: number;
    latestMs: number;
    tokens: Set<string>;
  };

  const groups: Group[] = [];

  for (const item of items) {
    const tokens = titleTokens(item.title);
    const dateMs = new Date(item.pubDate).getTime() || Date.now();

    let bestGroup: Group | null = null;
    let bestSim = 0.35; // minimum Jaccard threshold to be considered a duplicate

    for (const g of groups) {
      const sim = jaccardSim(tokens, g.tokens);
      if (sim > bestSim) {
        bestSim = sim;
        bestGroup = g;
      }
    }

    if (bestGroup) {
      bestGroup.sourceCount++;
      // Prefer the most recent version; break ties in favour of articles with images
      if (
        dateMs > bestGroup.latestMs ||
        (dateMs === bestGroup.latestMs &&
          item.imageUrl &&
          !bestGroup.representative.imageUrl)
      ) {
        bestGroup.latestMs = dateMs;
        bestGroup.representative = item;
      }
    } else {
      groups.push({ representative: item, sourceCount: 1, latestMs: dateMs, tokens });
    }
  }

  // Score = coverage bonus + recency bonus
  const now = Date.now();
  const scored = groups.map((g) => {
    const ageHours = (now - g.latestMs) / 3_600_000;
    const recency = Math.max(0, 1 - ageHours / 48); // 1 = fresh, 0 = 2 days old
    const score = g.sourceCount * 3 + recency * 2;
    return { score, g };
  });

  scored.sort((a, b) => b.score - a.score);

  console.log(
    `[rss] Deduplicated ${items.length} raw items → ${groups.length} unique stories → keeping top ${topN}`
  );

  return scored.slice(0, topN).map((s) => s.g.representative);
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
        `[${i + 1}] SOURCE: ${item.source}\nDATE: ${item.pubDate}\nTITLE: ${item.title}\nDESCRIPTION: ${item.description || "(none)"}${item.imageUrl ? `\nIMAGE: ${item.imageUrl}` : ""}`
    )
    .join("\n\n---\n\n");

  const prompt = `You are the editorial voice for Popcorn — a pop culture news app covering film, music, gaming, fashion, and everything the internet is talking about. Today is ${today}.

Below are ${rawItems.length} recent headlines. Your job:

1. Pick **13–15 stories** using this priority order:
   a. BREAKING NEWS first — anything from today or the last 24 hours. Cast announcements, album drops, box office records, award shocks, deaths, scandals, big releases, surprise announcements. Always lead with the biggest stories happening RIGHT NOW.
   b. Major releases (albums, films, games) out this week
   c. Big industry moves, viral moments, award show drama
   d. One or two lighter reads — fun culture stories or interesting discoveries
   Skip: SEO filler, repetitive non-stories, minor celebrity updates with no real hook.

2. Write each story in a friendly, conversational way — like a smart friend explaining the news. Keep it simple and engaging. Our readers are everyday people who love pop culture, not industry insiders.

ARTICLES:
${articleList}

WRITING RULES (strictly follow every one):
- ALWAYS use real names. Every headline and the first sentence MUST name the actual person, album, film, show or game. Never say "an artist", "a film", "a celebrity" — say who it is.
- Write like you are talking to a friend. Short sentences. Simple words. No jargon.
- No dashes or hyphens used as pauses in sentences. Use plain punctuation.
- No bullet points inside the story content.
- Keep it upbeat and engaging. Tell people why they should care.

For each selected article, output a JSON object with EXACTLY these fields:
{
  "title": "Short punchy headline, max 10 words — MUST include the real name",
  "summary": "2 sentences. First sentence names who/what and what happened. Second sentence says why it matters.",
  "content": "2 to 3 short paragraphs separated by \\n\\n. Conversational tone. Simple words. No dashes as punctuation. Name real people and things throughout.",
  "keyPoints": ["3 to 5 short plain-English takeaways (no dashes, no jargon)"],
  "signalScore": 0-100 (cultural significance / buzz level),
  "tag": "ONE of: BREAKING | HOT TAKE | REVIEW | INTERVIEW | FEATURE | RELEASE | TREND",
  "category": "ONE of: Film & TV | Music | Gaming | Fashion | Culture",
  "source": "Original source name",
  "imageUrl": "The IMAGE URL from the source article if one was provided, otherwise null",
  "wikiSearchQuery": "Search query for the article's main SUBJECT — prioritise the specific title over the person. Wikipedia pages for films, albums, and shows use poster/cover art as their main image, making far better hero images than headshots. Rules: (1) Film/TV → use the title + year: 'Challengers 2024 film', 'The White Lotus season 3', 'Black Mirror TV series'. (2) Music → use artist + album if known: 'Taylor Swift Tortured Poets Department album', 'BTS Map of the Soul Persona', else just the artist 'John Summit DJ'. (3) Gaming → game title: 'The Last of Us Part II game'. (4) If the story is purely about a person (death, scandal, tour announcement with no specific release), use name + role: 'Celine Dion singer', 'Tiger Woods golfer'.",
  "readTimeMinutes": <integer 2–6>,
  "sourceIndex": <the [N] number of the source article>
}

Respond with ONLY a valid JSON array — no markdown, no code fences, no commentary before or after.`;

  console.log("[rss] Calling Claude to enrich articles...");
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
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

  // First pass — build articles, mark ones that still need an OG image fetch
  const articles: EnrichedArticle[] = parsed.map((item: any, i: number) => {
    const cat = item.category in CATEGORY_GRADIENTS ? item.category : "Culture";
    const [gradientStart, gradientEnd] = CATEGORY_GRADIENTS[cat];
    const rssImageUrl = typeof item.imageUrl === "string" ? item.imageUrl : null;
    const imageUrl = isGoodImageUrl(rssImageUrl) ? rssImageUrl! : null;

    return {
      id: i + 1,
      title: String(item.title ?? ""),
      summary: String(item.summary ?? ""),
      content: String(item.content ?? ""),
      category: cat,
      source: String(item.source ?? "Unknown"),
      readTimeMinutes: Number(item.readTimeMinutes) || 5,
      publishedAt: (() => {
        const src = rawItems[item.sourceIndex - 1];
        if (src?.pubDate) {
          const d = new Date(src.pubDate);
          if (!isNaN(d.getTime())) return d.toISOString();
        }
        return new Date().toISOString();
      })(),
      likes: Math.floor(Math.random() * 4500) + 500,
      isBookmarked: false,
      gradientStart,
      gradientEnd,
      tag: String(item.tag ?? "ANALYSIS"),
      imageUrl: imageUrl ?? `__NEEDS_OG__${rawItems[item.sourceIndex - 1]?.link ?? ""}`,
      wikiSearchQuery: typeof item.wikiSearchQuery === "string" ? item.wikiSearchQuery : "",
      keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints : [],
      signalScore: typeof item.signalScore === "number" ? item.signalScore : null,
    } satisfies EnrichedArticle;
  });

  // Second pass — fetch real images for articles that couldn't get one from RSS.
  // Priority chain: (1) OG from article URL → (2) iTunes (Music) → (3) Wikipedia → (4) Unsplash
  const ogNeeded = articles.filter((a) => a.imageUrl?.startsWith("__NEEDS_OG__"));
  if (ogNeeded.length > 0) {
    console.log(`[rss] Fetching images for ${ogNeeded.length} articles (OG → iTunes → Wikipedia → Unsplash)…`);
    await Promise.all(
      ogNeeded.map(async (article, idx) => {
        const articleUrl = (article.imageUrl as string).replace("__NEEDS_OG__", "");
        const wikiQuery = (article as any).wikiSearchQuery as string | undefined;

        // 1. OG image scraped from the article page
        const ogUrl = articleUrl ? await fetchOGImage(articleUrl) : undefined;
        if (isGoodImageUrl(ogUrl)) {
          article.imageUrl = ogUrl!;
          return;
        }

        // 2. iTunes album/artist art (Music only — free, no key)
        if (article.category === "Music" && wikiQuery) {
          const itunesUrl = await fetchItunesImage(wikiQuery);
          if (isGoodImageUrl(itunesUrl)) {
            console.log(`[rss]   iTunes ✓ ${article.title.slice(0, 40)} → ${wikiQuery}`);
            article.imageUrl = itunesUrl!;
            return;
          }
        }

        // 3. Wikipedia — subject-focused query returns poster/cover art for films & albums
        if (wikiQuery) {
          const wikiUrl = await fetchWikipediaImage(wikiQuery);
          if (isGoodImageUrl(wikiUrl)) {
            console.log(`[rss]   Wikipedia ✓ ${article.title.slice(0, 40)} → ${wikiQuery}`);
            article.imageUrl = wikiUrl!;
            return;
          }
        }

        // 4. Category-matched Unsplash fallback
        article.imageUrl = fallbackImage(article.category, idx);
      })
    );

    const ogCount     = ogNeeded.filter((a) => !["unsplash","wikimedia","mzstatic"].some(d => a.imageUrl?.includes(d))).length;
    const itunesCount = ogNeeded.filter((a) => a.imageUrl?.includes("mzstatic")).length;
    const wikiCount   = ogNeeded.filter((a) => a.imageUrl?.includes("wikimedia")).length;
    const unsplash    = ogNeeded.filter((a) => a.imageUrl?.includes("unsplash")).length;
    console.log(`[rss] Image results: ${ogCount} OG | ${itunesCount} iTunes | ${wikiCount} Wikipedia | ${unsplash} Unsplash`);
  }

  return articles;
}

// ─── Cache + public API ───────────────────────────────────────────────────────

function cachePath(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const hourBlock = Math.floor(now.getHours() / 2); // 0–11, refreshes every 2 hours
  return path.join("/tmp", `popcorn-articles-${dateStr}-${hourBlock}.json`);
}

// In-memory cache tracks the 2-hour block key so it auto-expires mid-session
let _inMemoryCache: EnrichedArticle[] | null = null;
let _inMemoryCacheKey: string | null = null;

/**
 * Load today's live articles.
 * 1. Returns in-memory cache if it belongs to the current 2-hour block.
 * 2. Falls back to disk cache for the current block.
 * 3. Otherwise fetches RSS feeds + calls Claude, then writes disk cache.
 */
export async function loadLiveArticles(): Promise<EnrichedArticle[]> {
  const cp = cachePath();

  // Return in-memory cache only if it's still within the same 2-hour block
  if (_inMemoryCache && _inMemoryCacheKey === cp) return _inMemoryCache;

  // Check disk cache for current block
  if (fs.existsSync(cp)) {
    try {
      const raw = fs.readFileSync(cp, "utf-8");
      _inMemoryCache = JSON.parse(raw) as EnrichedArticle[];
      _inMemoryCacheKey = cp;
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
    // Viral / celebrity / trending — catches the stories everyone is talking about
    ["https://www.tmz.com/rss.xml",                                    "TMZ"],
    ["https://pagesix.com/feed/",                                      "Page Six"],
    ["https://www.vulture.com/feeds/flipboard.rss",                     "Vulture"],
    ["https://www.indiewire.com/feed/",                                "IndieWire"],
    ["https://www.stereogum.com/feed/",                                "Stereogum"],
    // Film & TV trade
    ["https://variety.com/feed/",                                      "Variety"],
    ["https://deadline.com/feed/",                                     "Deadline"],
    ["https://www.hollywoodreporter.com/feed/",                        "The Hollywood Reporter"],
    ["https://collider.com/feed/",                                     "Collider"],
    // Music
    ["https://consequence.net/feed/",                                  "Consequence"],
    ["https://www.nme.com/feed",                                       "NME"],
    ["https://www.rollingstone.com/feed/",                             "Rolling Stone"],
    ["https://www.billboard.com/feed/",                                "Billboard"],
    ["https://pitchfork.com/rss/news/",                                "Pitchfork"],
    // Gaming
    ["https://www.theverge.com/rss/games/index.xml",                   "The Verge Games"],
    ["https://feeds.feedburner.com/ign/all",                           "IGN"],
    ["https://www.polygon.com/rss/index.xml",                          "Polygon"],
    ["https://kotaku.com/rss",                                         "Kotaku"],
    // Alt / culture crossover
    ["https://www.theguardian.com/culture/rss",                        "The Guardian Culture"],
    ["https://nautil.us/feed/",                                        "Nautilus"],
    ["https://www.dazeddigital.com/rss",                               "Dazed"],
    ["https://hypebeast.com/feed",                                     "Hypebeast"],
    ["https://uproxx.com/feed/",                                       "Uproxx"],
    // Quality editorial / long-reads
    ["https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml",          "NYT Arts"],
    ["https://www.theatlantic.com/feed/all/",                          "The Atlantic"],
    ["https://www.wired.com/feed/rss",                                 "Wired"],
    ["https://www.morningbrew.com/daily/feed",                         "Morning Brew"],
  ];

  // Fetch in batches of 5 — prevents undici's connection pool from becoming
  // saturated (which corrupts all subsequent network calls, including Claude).
  const BATCH = 5;
  const results: PromiseSettledResult<RawRSSItem[]>[] = [];
  for (let i = 0; i < feeds.length; i += BATCH) {
    const batch = feeds.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map(([url, name]) => fetchFeed(url, name))
    );
    results.push(...batchResults);
    if (i + BATCH < feeds.length) await new Promise((r) => setTimeout(r, 150));
  }

  // Sort by most recent first so Claude sees the freshest stories at the top
  const allItems = results
    .filter((r): r is PromiseFulfilledResult<RawRSSItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => {
      const tA = new Date(a.pubDate).getTime();
      const tB = new Date(b.pubDate).getTime();
      if (isNaN(tA) && isNaN(tB)) return 0;
      if (isNaN(tA)) return 1;
      if (isNaN(tB)) return -1;
      return tB - tA;
    });

  console.log(`[rss] Total raw items: ${allItems.length}`);

  if (allItems.length < 5) {
    throw new Error(`Only ${allItems.length} articles fetched — too few to enrich`);
  }

  // Deduplicate + rank, then send only the top stories to Claude
  const toEnrich = deduplicateAndRank(allItems, 25);

  const enriched = await enrichWithClaude(toEnrich);

  // Persist to disk
  try {
    fs.writeFileSync(cp, JSON.stringify(enriched, null, 2));
    console.log(`[rss] ✓ Wrote ${enriched.length} articles to ${cp}`);
  } catch (e) {
    console.warn("[rss] Could not write disk cache:", e);
  }

  _inMemoryCache = enriched;
  _inMemoryCacheKey = cp;
  return enriched;
}

/** Clear caches (useful for testing) */
export function clearCache(): void {
  _inMemoryCache = null;
  const cp = cachePath();
  if (fs.existsSync(cp)) fs.unlinkSync(cp);
}
