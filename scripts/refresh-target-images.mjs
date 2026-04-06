/**
 * Targeted image refresh — re-runs image fetching for specific articles
 * using the full production pipeline (strict OG, TMDb, Spotify, Unsplash, iTunes, Wikipedia).
 *
 * Usage: node scripts/refresh-target-images.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, "../artifacts/api-server/data/feed-2026-04-04.json");

// ── Credentials (mirrors launch.json) ────────────────────────────────────────
const UNSPLASH_KEY       = "TiMLxdpPf7mgyGdYwZ9behsUxdS5sBqziK0rTOLeC64";
const TMDB_API_KEY       = "183b39667719dfd15479f283a960b84b";
const SPOTIFY_CLIENT_ID  = "9f4a68c46b45470095de7440ab05a1ba";
const SPOTIFY_CLIENT_SECRET = "fc362687862c48a1b63d00ba795a3375";

// ── Titles to refresh ─────────────────────────────────────────────────────────
const TARGET_TITLES = [
  "Netflix Price Hikes Ruled Unlawful in Italy",
  "McDonald's Turkey Has a Wild New Menu for Gamers",
  "Two Lost 1965 Doctor Who Episodes Found and Released",
  "Cardi B Teams Up With Zohran Mamdani on Free Childcare Push",
  "Linus Tech Tips Really Did Buy a $5 Million Private Jet",
  "K-Pop's AI Crisis Is Getting Impossible to Ignore",
  "The 'Chicky The Dog' AI Meme Is Everywhere Right Now",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const BAD_URL_PATTERNS = [
  /i\.imgur\.com/, /1x1/, /pixel\./, /spacer\.gif/, /placeholder/i,
  /default[-_]?(image|img|thumb)/i, /pubads\.g\.doubleclick\.net/,
  /googlesyndication\.com/, /adserver\./i, /\/ad\?/, /[Gg][Ee][Nn][Ee][Rr][Ii][Cc]/,
  /Social_Share/i, /[/_-]logo[/_.\-?]/i, /[/_-]icon[/_.\-?]/i,
  /[/_-]sprite[/_.\-?]/i, /[/_-]avatar[/_.\-?]/i, /[/_-]banner[/_.\-?]/i,
  /\/thumbnail\//i, /[/_-]tracking[/_.\-?]/i,
  /s\.yimg\.com/, /i\.dailymail\.co\.uk/, /cdn\.images\.express\.co\.uk/,
  /img\.dealnews\.com/, /cdn\.clovetech\.com/,
];

function isGoodUrl(url) {
  if (!url?.startsWith("http")) return false;
  if (BAD_URL_PATTERNS.some(p => p.test(url))) return false;
  try {
    const u = new URL(url);
    const w = parseInt(u.searchParams.get("w") ?? u.searchParams.get("width") ?? "0", 10);
    if (w > 0 && w < 400) return false;
  } catch { return false; }
  return true;
}

async function isHighQuality(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const size = parseInt(res.headers.get("content-length") ?? "0", 10);
    if (size > 0 && size < 25_000) return false;
    return true;
  } catch { return true; }
}

function isValidRatio(w, h) {
  if (!w || !h) return true;
  const r = w / h;
  return r > 0.4 && r < 3.0;
}

function isStrictOGValid(url, dims) {
  if (/[/_-](logo|icon|avatar|banner|sprite|ads?)[/_.\-?]/i.test(url)) return false;
  if (!dims) return true;
  if (dims.width < 600) return false;
  const r = dims.width / dims.height;
  if (r > 2.5 || r < 0.4) return false;
  return true;
}

async function fetchDimensions(url) {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-2047" }, signal: AbortSignal.timeout(3000) });
    if (!res.ok && res.status !== 206) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      if (buf.length < 24) return null;
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    // JPEG
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 8) {
        if (buf[i] !== 0xff) break;
        const marker = buf[i + 1];
        const segLen = buf.readUInt16BE(i + 2);
        if (marker === 0xc0 || marker === 0xc2)
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + segLen;
      }
    }
    // WebP
    if (buf[0]===0x52&&buf[1]===0x49&&buf[2]===0x46&&buf[3]===0x46&&
        buf[8]===0x57&&buf[9]===0x45&&buf[10]===0x42&&buf[11]===0x50) {
      const chunk = buf.slice(12, 16).toString("ascii");
      if (chunk === "VP8 " && buf.length >= 30 && buf[23]===0x9d&&buf[24]===0x01&&buf[25]===0x2a) {
        const w = buf.readUInt16LE(26) & 0x3fff, h = buf.readUInt16LE(28) & 0x3fff;
        if (w > 0 && h > 0) return { width: w, height: h };
      }
      if (chunk === "VP8L" && buf.length >= 25 && buf[20] === 0x2f) {
        const bits = buf.readUInt32LE(21);
        const w = (bits & 0x3fff) + 1, h = ((bits >> 14) & 0x3fff) + 1;
        if (w > 0 && h > 0) return { width: w, height: h };
      }
      if (chunk === "VP8X" && buf.length >= 30) {
        const w = (buf[24]|(buf[25]<<8)|(buf[26]<<16)) + 1;
        const h = (buf[27]|(buf[28]<<8)|(buf[29]<<16)) + 1;
        if (w > 0 && h > 0) return { width: w, height: h };
      }
    }
    return null;
  } catch { return null; }
}

// ── OG image ─────────────────────────────────────────────────────────────────
async function fetchOGImage(articleUrl) {
  if (!articleUrl?.startsWith("http")) return undefined;
  try {
    const res = await fetch(articleUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" },
    });
    if (!res.ok) return undefined;
    const reader = res.body?.getReader();
    if (!reader) return undefined;
    let html = "";
    while (html.length < 20000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader.cancel();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      ?? html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    const src = match?.[1];
    return src?.startsWith("http") ? src : undefined;
  } catch { return undefined; }
}

// ── TMDb ──────────────────────────────────────────────────────────────────────
async function fetchTMDb(query) {
  if (!TMDB_API_KEY || !query?.trim()) return undefined;
  try {
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`;
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return undefined;
    const posterPath = result.poster_path ?? result.profile_path;
    if (!posterPath) return undefined;
    return `https://image.tmdb.org/t/p/w1280${posterPath}`;
  } catch { return undefined; }
}

// ── Spotify ───────────────────────────────────────────────────────────────────
let _spotifyToken = null;
let _spotifyExpiry = 0;

async function getSpotifyToken() {
  if (_spotifyToken && Date.now() < _spotifyExpiry) return _spotifyToken;
  try {
    const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    _spotifyToken = data.access_token;
    _spotifyExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return _spotifyToken;
  } catch { return null; }
}

async function fetchSpotify(query) {
  if (!SPOTIFY_CLIENT_ID || !query?.trim()) return undefined;
  const token = await getSpotifyToken();
  if (!token) return undefined;
  try {
    for (const type of ["album", "artist"]) {
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=1&market=US`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const data = await res.json();
      const items = data?.[`${type}s`]?.items ?? [];
      const img = items[0]?.images?.find(i => i.width >= 600)?.url ?? items[0]?.images?.[0]?.url;
      if (img?.startsWith("http")) return img;
    }
    return undefined;
  } catch { return undefined; }
}

// ── Unsplash (strict) ─────────────────────────────────────────────────────────
function cleanQuery(query) {
  return query
    .replace(/\b(the|a|an|and|or|of|in|on|at|to|for|with|is|are|was|were|has|have|had|be|been|being|that|this|these|those|it|its|his|her|they|their|from|into|over|also|even|than|then|very|each|only|just|now|new|big|top|best|worst|first|last|one|two|three|more|most|all|any|no|not|so|but|if|as|by|up|out|about|after|before|says?|gets?|will|can|may|how|why|what|when|who|report|reveals?|breaking|latest|update)\b/gi, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 3)
    .join(" ");
}

async function fetchUnsplash(query) {
  const q = cleanQuery(query);
  if (!UNSPLASH_KEY || !q) return undefined;
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=3&orientation=portrait&content_filter=high`;
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return undefined;
    const data = await res.json();
    for (const photo of (data?.results ?? [])) {
      const hasContext =
        (typeof photo.description === "string" && photo.description.trim().length > 0) ||
        (Array.isArray(photo.tags) && photo.tags.length > 0);
      if (!hasContext) continue;
      const src = photo?.urls?.full ?? photo?.urls?.regular;
      if (src?.startsWith("http")) return src;
    }
    return undefined;
  } catch { return undefined; }
}

// ── iTunes ────────────────────────────────────────────────────────────────────
async function fetchItunes(query) {
  if (!query?.trim()) return undefined;
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const data = await res.json();
    const art = data?.results?.[0]?.artworkUrl100?.replace("100x100bb", "3000x3000bb");
    return art?.startsWith("http") ? art : undefined;
  } catch { return undefined; }
}

// ── Wikipedia ─────────────────────────────────────────────────────────────────
async function fetchWikipedia(query) {
  if (!query?.trim()) return undefined;
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!searchRes.ok) return undefined;
    const searchData = await searchRes.json();
    const pageTitle = searchData?.query?.search?.[0]?.title;
    if (!pageTitle) return undefined;
    const imgRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=1200&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!imgRes.ok) return undefined;
    const imgData = await imgRes.json();
    const page = Object.values(imgData?.query?.pages ?? {})[0];
    const src = page?.thumbnail?.source;
    return src?.startsWith("http") ? src : undefined;
  } catch { return undefined; }
}

// ── Article source URL scraper ─────────────────────────────────────────────────
// We don't store the original article URL in the JSON, but we can try to build it
// from context or skip OG and rely on the other sources.

// ── Main pipeline ─────────────────────────────────────────────────────────────
async function refreshArticle(article) {
  const query  = article.wikiSearchQuery;
  const cat    = article.category;
  const title  = article.title.slice(0, 50);
  let newUrl;
  let source;

  // 1. TMDb (Film & TV) — best for Doctor Who, Netflix, Spaceballs
  if (!newUrl && cat === "Film & TV" && query) {
    const url = await fetchTMDb(query);
    if (url && isGoodUrl(url)) { newUrl = url; source = "TMDb"; }
  }

  // 2. Spotify (Music) — best for K-Pop, albums, artists
  if (!newUrl && cat === "Music" && query) {
    const url = await fetchSpotify(query);
    if (url && isGoodUrl(url)) { newUrl = url; source = "Spotify"; }
  }

  // 3. iTunes (Music fallback)
  if (!newUrl && cat === "Music" && query) {
    const url = await fetchItunes(query);
    if (url && isGoodUrl(url)) { newUrl = url; source = "iTunes"; }
  }

  // 4. Unsplash (strict — all categories)
  if (!newUrl && query) {
    const url = await fetchUnsplash(query);
    if (url && isGoodUrl(url)) { newUrl = url; source = "Unsplash"; }
  }

  // 5. Wikipedia (last resort)
  if (!newUrl && query) {
    const url = await fetchWikipedia(query);
    if (url && isGoodUrl(url)) { newUrl = url; source = "Wikipedia"; }
  }

  return { newUrl, source };
}

// ── Entry point ────────────────────────────────────────────────────────────────
async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const targets = data.articles.filter(a => TARGET_TITLES.includes(a.title));

  console.log(`🎯 Refreshing ${targets.length} articles\n`);

  let updated = 0;

  for (const article of targets) {
    console.log(`\n🔄 [${article.category}] ${article.title.slice(0, 55)}`);
    console.log(`   OLD: ${article.imageUrl?.slice(0, 80)}`);

    const { newUrl, source } = await refreshArticle(article);

    if (newUrl && newUrl !== article.imageUrl) {
      // Fetch dimensions for the new image
      const dims = await fetchDimensions(newUrl);
      article.imageUrl    = newUrl;
      article.imageWidth  = dims?.width  ?? null;
      article.imageHeight = dims?.height ?? null;

      const ratio = dims ? (dims.width / dims.height).toFixed(2) : "unknown";
      console.log(`   ✓ ${source}: ${newUrl.slice(0, 80)}`);
      console.log(`   Dimensions: ${dims ? `${dims.width}×${dims.height} (ratio ${ratio})` : "unknown → cover(fallback)"}`);
      updated++;
    } else {
      console.log(`   ⚠ No better image found — keeping original`);
    }
  }

  // Save data/ file
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  // Also update /tmp/ if it exists
  const dateStr = path.basename(DATA_FILE, ".json").replace("feed-", "");
  const tmpFile = `/tmp/popcorn-curated-${dateStr}.json`;
  if (fs.existsSync(tmpFile)) {
    try {
      const tmpData = JSON.parse(fs.readFileSync(tmpFile, "utf-8"));
      const byTitle = new Map(data.articles.map(a => [a.title, a]));
      for (const a of (tmpData.articles ?? [])) {
        const updated = byTitle.get(a.title);
        if (updated) {
          a.imageUrl    = updated.imageUrl;
          a.imageWidth  = updated.imageWidth;
          a.imageHeight = updated.imageHeight;
        }
      }
      fs.writeFileSync(tmpFile, JSON.stringify(tmpData, null, 2));
      console.log(`\n   Also updated /tmp/ cache`);
    } catch { /* ignore */ }
  }

  console.log(`\n✅ Done — ${updated} articles updated`);
}

main().catch(console.error);
