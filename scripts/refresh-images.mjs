/**
 * Image refresh script — re-runs the image priority chain for articles
 * that are currently using bad CDN sources (Dexerto, kym-cdn, etc.)
 * Does NOT re-call Claude — only updates imageUrl fields.
 *
 * Usage: node scripts/refresh-images.mjs
 * Requires: UNSPLASH_ACCESS_KEY env var
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, "../artifacts/api-server/data/feed-2026-04-04.json");
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY ?? "TiMLxdpPf7mgyGdYwZ9behsUxdS5sBqziK0rTOLeC64";

// ── Bad CDN patterns — these images should be replaced ─────────────────────
const BAD_IMAGE_PATTERNS = [
  /dexerto\.com\/cdn-image/,
  /i\.kym-cdn\.com/,
  /s\.yimg\.com/,
  /i\.dailymail\.co\.uk/,
  /cdn\.images\.express\.co\.uk/,
  /img\.dealnews\.com/,
  /cdn\.clovetech\.com/,
  /assets-prd\.ignimgs\.com/,   // IGN CDN — low quality
];

function isBadImageUrl(url) {
  if (!url) return true;
  return BAD_IMAGE_PATTERNS.some(p => p.test(url));
}

// ── Unsplash ────────────────────────────────────────────────────────────────
async function fetchUnsplashImage(query) {
  if (!UNSPLASH_KEY || !query?.trim()) return undefined;
  try {
    const keywords = query
      .replace(/\b(the|a|an|and|or|of|in|on|at|to|for|with|is|are|was|were|has|have|had|be|been|being|that|this|these|those|it|its)\b/gi, " ")
      .replace(/[^a-z0-9\s]/gi, " ")
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 4)
      .join(" ");
    if (!keywords) return undefined;
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keywords)}&per_page=1&orientation=landscape&content_filter=high`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    const photo = data?.results?.[0];
    const src = photo?.urls?.full ?? photo?.urls?.regular;
    return src?.startsWith("http") ? src : undefined;
  } catch {
    return undefined;
  }
}

// ── Wikipedia ───────────────────────────────────────────────────────────────
async function fetchWikipediaImage(query) {
  if (!query?.trim()) return undefined;
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    if (!searchRes.ok) return undefined;
    const searchData = await searchRes.json();
    const pageTitle = searchData?.query?.search?.[0]?.title;
    if (!pageTitle) return undefined;
    const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=1200&format=json`;
    const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(5000) });
    if (!imgRes.ok) return undefined;
    const imgData = await imgRes.json();
    const pages = imgData?.query?.pages ?? {};
    const page = Object.values(pages)[0];
    const src = page?.thumbnail?.source;
    return src?.startsWith("http") ? src : undefined;
  } catch {
    return undefined;
  }
}

// ── iTunes (Music only) ─────────────────────────────────────────────────────
async function fetchItunesImage(query) {
  if (!query?.trim()) return undefined;
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const data = await res.json();
    const src = data?.results?.[0]?.artworkUrl100?.replace("100x100bb", "3000x3000bb");
    return src?.startsWith("http") ? src : undefined;
  } catch {
    return undefined;
  }
}

// ── OG image scraper ────────────────────────────────────────────────────────
async function fetchOGImage(articleUrl) {
  if (!articleUrl?.startsWith("http")) return undefined;
  try {
    const res = await fetch(articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const src = match?.[1];
    return src?.startsWith("http") ? src : undefined;
  } catch {
    return undefined;
  }
}

// ── Quality check ───────────────────────────────────────────────────────────
async function isHighQualityImage(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const size = parseInt(res.headers.get("content-length") ?? "0", 10);
    if (size > 0 && size < 50_000) return false;
    return true;
  } catch {
    return true; // benefit of the doubt
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  let updated = 0;

  for (const article of data.articles) {
    if (!isBadImageUrl(article.imageUrl)) continue;

    const title = article.title.slice(0, 50);
    const query = article.wikiSearchQuery;
    const articleUrl = article.url;
    console.log(`\n🔄 [${article.category}] ${title}`);
    console.log(`   OLD: ${article.imageUrl?.slice(0, 80)}`);

    let newUrl;

    // 1. OG image (quality-checked)
    if (articleUrl) {
      const og = await fetchOGImage(articleUrl);
      if (og && await isHighQualityImage(og)) {
        newUrl = og;
        console.log(`   ✓ OG image`);
      }
    }

    // 2. Unsplash
    if (!newUrl && query) {
      const unsplash = await fetchUnsplashImage(query);
      if (unsplash) {
        newUrl = unsplash;
        console.log(`   ✓ Unsplash`);
      }
    }

    // 3. iTunes (Music only)
    if (!newUrl && article.category === "Music" && query) {
      const itunes = await fetchItunesImage(query);
      if (itunes) {
        newUrl = itunes;
        console.log(`   ✓ iTunes`);
      }
    }

    // 4. Wikipedia
    if (!newUrl && query) {
      const wiki = await fetchWikipediaImage(query);
      if (wiki) {
        newUrl = wiki;
        console.log(`   ✓ Wikipedia`);
      }
    }

    // 5. OG without quality check
    if (!newUrl && articleUrl) {
      const og = await fetchOGImage(articleUrl);
      if (og) {
        newUrl = og;
        console.log(`   ✓ OG (no quality check)`);
      }
    }

    if (newUrl && newUrl !== article.imageUrl) {
      console.log(`   NEW: ${newUrl.slice(0, 80)}`);
      article.imageUrl = newUrl;
      updated++;
    } else {
      console.log(`   ⚠ No replacement found — keeping original`);
    }
  }

  if (updated > 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`\n✅ Updated ${updated} image(s) → ${DATA_FILE}`);
  } else {
    console.log("\n✅ No images needed updating.");
  }
}

main().catch(console.error);
