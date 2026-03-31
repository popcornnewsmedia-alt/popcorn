/**
 * ingest-rss.ts
 *
 * Standalone script: fetches the 5 AI-news RSS feeds, enriches the top
 * articles with Claude, then writes them straight to Supabase.
 *
 * Run from the repo root:
 *   DATABASE_URL='...' ANTHROPIC_API_KEY='...' pnpm --filter @workspace/scripts run ingest-rss
 */

import { spawn } from "node:child_process";
import { db } from "@workspace/db";
import { articlesTable } from "@workspace/db/schema";

// ─── Image pool (same as rss-enricher) ───────────────────────────────────────

// Dark, cinematic, tech-themed photos — curated for full-screen portrait cards.
// All verified to be dramatically lit with no UI screenshots or generic stock poses.
const IMAGE_POOL = [
  // Deep space / satellite — drama, scale
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Neon server rack — deep blue, tech
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Circuit board extreme macro — dark green
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Network cable jungle — dark teal
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Matrix / code rain — dark green
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // AI neural network glow — dark purple
  "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // LED light array — vivid bars on black
  "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Dark code on screen — amber on black
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Chip wafer — dark metallic
  "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // AI robot face — dark dramatic
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Digital abstract — dark blue waves
  "https://images.unsplash.com/photo-1677442136019-21780ecad979?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Data centre aisle — dark corridor
  "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Laptop code at night — dark ambient
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Dark fibre optic threads
  "https://images.unsplash.com/photo-1509475826633-fed577a2c71b?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Abstract glowing orb — dark sci-fi
  "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Microprocessor pins — dark metallic macro
  "https://images.unsplash.com/photo-1436262513933-a0b06755c784?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Night cityscape — dark urban tech
  "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Binary / data stream — dark green
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Quantum dots / particles — dark space
  "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1080&h=1920&fit=crop&crop=entropy&q=90",
  // Holographic interface — dark blue
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1080&h=1920&fit=crop&crop=entropy&q=90",
];

const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  Models:   ["#1e1e2e", "#4a4a7a"],
  Research: ["#0a2a1a", "#3a7a5a"],
  Industry: ["#2a1a0a", "#8a6a3a"],
  Policy:   ["#1a1a2a", "#5a6a9a"],
  Tools:    ["#1a0a2a", "#6a3a8a"],
};

// ─── RSS feeds ────────────────────────────────────────────────────────────────

const FEEDS: [string, string][] = [
  ["https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", "The Verge"],
  ["https://techcrunch.com/category/artificial-intelligence/feed/", "TechCrunch"],
  ["https://venturebeat.com/category/ai/feed/", "VentureBeat"],
  ["https://artificialintelligence-news.com/feed/", "AI News"],
  ["https://feeds.arstechnica.com/arstechnica/technology-lab", "Ars Technica"],
];

// ─── XML helpers ──────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, "i"
  );
  const m = block.match(re);
  if (!m) return "";
  return stripHtml((m[1] ?? m[2] ?? "").trim());
}

interface RawItem { title: string; description: string; link: string; pubDate: string; source: string; imageUrl?: string; }

/** Decode HTML entities in a URL and request the best version for full-screen portrait cards.
 *  - Decodes &#038; / &amp; → &
 *  - Unsplash: crops to 9:16 portrait (1080×1920) so no upscaling is needed on phone screens
 */
function cleanImageUrl(raw: string): string {
  // Decode HTML entities
  let url = raw
    .replace(/&#0*38;/g, "&")
    .replace(/&amp;/gi, "&");

  // Unsplash: request portrait crop — eliminates the landscape→portrait upscale that causes blur
  if (url.includes("images.unsplash.com")) {
    // Strip any existing dimension/fit params and replace with portrait crop
    url = url.split("?")[0] + "?w=1080&h=1920&fit=crop&crop=entropy&q=90";
  }

  return url;
}

/** Extract a thumbnail/hero image URL from an RSS item block.
 *  Tries (in order):
 *  1. <media:content url="..." medium="image" .../>
 *  2. <media:thumbnail url="..."/>
 *  3. <enclosure url="..." type="image/..."/>
 *  4. First <img src="..."> inside the description/content HTML
 */
function extractItemImage(block: string): string | undefined {
  // media:content with url attr (most common in modern feeds)
  const mc = block.match(/<media:content[^>]+url="([^"]+)"[^>]*>/i);
  if (mc) return cleanImageUrl(mc[1]);

  // media:thumbnail
  const mt = block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
  if (mt) return cleanImageUrl(mt[1]);

  // enclosure with image type
  const enc = block.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image\/[^"]*"/i)
           || block.match(/<enclosure[^>]+type="image\/[^"]*"[^>]+url="([^"]+)"/i);
  if (enc) return cleanImageUrl(enc[1]);

  // First <img> inside encoded content/description
  const img = block.match(/<img[^>]+src="(https?:\/\/[^"]+)"/i);
  if (img) return cleanImageUrl(img[1]);

  return undefined;
}

function parseRSS(xml: string, source: string): RawItem[] {
  const isAtom = /<feed[\s>]/i.test(xml);
  const pattern = isAtom ? /<entry>([\s\S]*?)<\/entry>/gi : /<item>([\s\S]*?)<\/item>/gi;
  const items: RawItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(xml)) !== null && items.length < 12) {
    const block = m[1];
    const title = extractTag(block, "title");
    if (!title || title.length < 5) continue;
    let description = extractTag(block, "description") || extractTag(block, "summary") ||
      extractTag(block, "content\\:encoded") || extractTag(block, "content");
    description = description.slice(0, 600);
    let link = "";
    const linkM = block.match(/<link>([^<]+)<\/link>/) || block.match(/<link[^>]+href="([^"]+)"/i);
    if (linkM) link = linkM[1].trim();
    let pubDate = new Date().toISOString();
    const dateM = block.match(/<pubDate>([^<]+)<\/pubDate>/i) ||
      block.match(/<published>([^<]+)<\/published>/i) ||
      block.match(/<updated>([^<]+)<\/updated>/i);
    if (dateM) pubDate = dateM[1].trim();
    const imageUrl = extractItemImage(block);
    items.push({ title, description, link, pubDate, source, imageUrl });
  }
  return items;
}

async function fetchFeed(url: string, name: string): Promise<RawItem[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Infer/1.0; +https://infer.news) RSS reader",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRSS(xml, name);
    console.log(`  ✓ ${name}: ${items.length} items`);
    return items;
  } catch (e) {
    console.warn(`  ✗ ${name}: ${e}`);
    return [];
  }
}

// ─── Call Anthropic via curl (bypasses Node.js 25 TLS issues entirely) ───────
//
// Uses spawn() + piped stdin so:
//   • No shell quoting issues (args passed directly as an array)
//   • No temp file (body piped straight to curl stdin via -d @-)
//   • --keepalive-time 10 sends TCP keepalives to prevent the connection being
//     treated as idle by the NAT router
//   • --http1.1 avoids HTTP/2 framing errors
//   • -H "Expect:" suppresses curl's automatic "Expect: 100-continue" header
//
// IMPORTANT: use claude-haiku-4-5, NOT claude-sonnet-4-5 — Haiku generates tokens
// 3-5× faster (~25 s for 6 articles) while Sonnet takes >60 s, which hits
// Anthropic's server-side 60-second HTTP connection timeout (curl exit 52).

function callClaude(apiKey: string, body: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);

    const curlBin = "/usr/bin/curl";
    const args = [
      "-s", "--http1.1",
      "--keepalive-time", "10",
      "-X", "POST",
      "https://api.anthropic.com/v1/messages",
      "-H", `x-api-key: ${apiKey}`,
      "-H", "anthropic-version: 2023-06-01",
      "-H", "content-type: application/json",
      "-H", "Expect:",
      "-d", "@-",          // read request body from stdin
      "--max-time", "90",
    ];

    const child = spawn(curlBin, args, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    child.on("error", (err) => reject(new Error(`spawn failed: ${err.message}`)));

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`curl exited ${code}\nstdout: ${stdout.slice(0, 300)}\nstderr: ${stderr.slice(0, 300)}`));
        return;
      }
      if (!stdout.trim()) {
        reject(new Error(`curl returned empty response. stderr: ${stderr}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.type === "error") {
          reject(new Error(`Anthropic API error: ${parsed.error?.message ?? stdout.slice(0, 200)}`));
        } else {
          resolve(stdout);
        }
      } catch {
        reject(new Error(`Could not parse curl response: ${stdout.slice(0, 200)}`));
      }
    });

    // Write the request body to curl's stdin, then close it
    child.stdin.write(bodyStr);
    child.stdin.end();
  });
}

// ─── Claude enrichment ────────────────────────────────────────────────────────

async function enrich(rawItems: RawItem[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const articleList = rawItems
    .map((item, i) => `[${i + 1}] SOURCE: ${item.source}\nTITLE: ${item.title}\nDESCRIPTION: ${item.description || "(none)"}`)
    .join("\n\n---\n\n");

  const imageListStr = IMAGE_POOL.map((url, i) => `${i}: ${url}`).join("\n");

  const prompt = `You are the editorial AI for Infer — a sharp, opinionated AI-news app read by founders, researchers, and investors. Today is ${today}.

Below are ${rawItems.length} recent headlines pulled from AI news sources. Your job:

1. Pick the **6 most important and genuinely newsworthy** articles. Prioritise: concrete product launches, breakthrough research, significant funding/acquisitions, meaningful policy changes. Deprioritise: opinion fluff, reworded press releases, minor updates.

2. For each chosen article, produce a full editorial write-up in Infer's voice — analytical, no-nonsense, reader-respects-your-time.

ARTICLES:
${articleList}

FALLBACK HERO IMAGES (only used when the article has no image of its own — assign one index per article that matches the article topic):
${imageListStr}

For each of the 6 selected articles, output a JSON object with EXACTLY these fields:
{
  "articleNumber": <the [N] number from the input list above>,
  "title": "Punchy headline, max 10 words",
  "summary": "2-sentence TL;DR shown on the card — hook the reader",
  "content": "3–4 paragraphs of editorial prose separated by \\n\\n. Analytical, first-person plural voice ('We', 'What this means'). No bullet lists inside content.",
  "keyPoints": ["3–5 concise takeaway bullets (string array)"],
  "impact": "One blunt sentence: why does this matter beyond the tech bubble?",
  "signalScore": 0-100,
  "tag": "ONE of: BREAKING | ANALYSIS | RESEARCH | INDUSTRY | POLICY | INTERVIEW | BREAKTHROUGH",
  "category": "ONE of: Models | Research | Industry | Policy | Tools",
  "source": "Original source name",
  "imageIndex": <fallback image index — only used if the article has no image>,
  "readTimeMinutes": <integer 3–8>
}

Respond with ONLY a valid JSON array — no markdown, no code fences, no commentary before or after.`;

  console.log("\nCalling Claude to enrich articles…");
  let rawResponse = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const responseText = await callClaude(apiKey, {
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      const parsed = JSON.parse(responseText);
      rawResponse = parsed.content?.[0]?.text ?? "";
      break;
    } catch (err: any) {
      if (attempt < 3) {
        const wait = attempt * 4000;
        console.warn(`  Attempt ${attempt}/3 failed: ${err.message} — retrying in ${wait / 1000}s…`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }

  const text = rawResponse;
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Claude response did not contain a JSON array");

  const parsed: any[] = JSON.parse(jsonMatch[0]);
  console.log(`Claude returned ${parsed.length} enriched articles`);

  return parsed.map((item: any, i: number) => {
    const cat = item.category in CATEGORY_GRADIENTS ? item.category : "Industry";
    const [gradientStart, gradientEnd] = CATEGORY_GRADIENTS[cat];

    // Prefer the image extracted directly from the RSS feed item;
    // fall back to the Unsplash pool image Claude selected.
    const rawIdx = typeof item.articleNumber === "number" ? item.articleNumber - 1 : -1;
    const rawItem = rawIdx >= 0 && rawIdx < rawItems.length ? rawItems[rawIdx] : undefined;
    const imgIdx = typeof item.imageIndex === "number" ? item.imageIndex : i % IMAGE_POOL.length;
    const imageUrl = rawItem?.imageUrl || (IMAGE_POOL[imgIdx] ?? IMAGE_POOL[i % IMAGE_POOL.length]);

    // Use the actual RSS publish date so articles get distinct timestamps.
    let publishedAt = new Date();
    if (rawItem?.pubDate) {
      const parsed = new Date(rawItem.pubDate);
      if (!isNaN(parsed.getTime())) publishedAt = parsed;
    }

    return {
      title: String(item.title ?? ""),
      summary: String(item.summary ?? ""),
      content: String(item.content ?? ""),
      category: cat,
      source: String(item.source ?? "Unknown"),
      readTimeMinutes: Number(item.readTimeMinutes) || 5,
      publishedAt,
      likes: 0,
      isBookmarked: false,
      gradientStart,
      gradientEnd,
      tag: String(item.tag ?? "ANALYSIS"),
      imageUrl,
      keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints : [],
      impact: item.impact ? String(item.impact) : null,
      signalScore: typeof item.signalScore === "number" ? item.signalScore : null,
    };
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Infer RSS Ingest ===\n");

  // 1. Fetch feeds
  console.log("Fetching RSS feeds…");
  const results = await Promise.allSettled(FEEDS.map(([url, name]) => fetchFeed(url, name)));
  const allItems = results
    .filter((r): r is PromiseFulfilledResult<RawItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  console.log(`\nTotal raw items: ${allItems.length}`);
  if (allItems.length < 5) throw new Error(`Too few articles fetched (${allItems.length})`);

  // 2. Enrich top 12 with Claude (smaller batch = faster response, avoids NAT timeout)
  const toEnrich = allItems.slice(0, 12);
  const enriched = await enrich(toEnrich);

  // 3. Write to DB (clear today's articles first, then insert fresh ones)
  console.log("\nWriting to database…");
  await db.delete(articlesTable);
  for (const article of enriched) {
    await db.insert(articlesTable).values(article);
  }

  console.log(`\n✅ Done — ${enriched.length} live articles written to Supabase.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
