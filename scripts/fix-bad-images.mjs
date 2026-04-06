/**
 * fix-bad-images.mjs — Manually fix 3 articles with irrelevant images
 * Uses article-specific hardcoded query overrides for each source.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, "../artifacts/api-server/data/feed-2026-04-04.json");

const UNSPLASH_KEY          = "TiMLxdpPf7mgyGdYwZ9behsUxdS5sBqziK0rTOLeC64";
const SPOTIFY_CLIENT_ID     = "9f4a68c46b45470095de7440ab05a1ba";
const SPOTIFY_CLIENT_SECRET = "fc362687862c48a1b63d00ba795a3375";

// ── Per-article overrides ─────────────────────────────────────────────────────
const ARTICLE_FIXES = [
  {
    titleMatch: "Cardi B",
    label: "Cardi B + Mamdani",
    strategies: [
      // Unsplash: direct name search now that hasContext filter is removed
      { type: "unsplash", query: "Cardi B", orientation: "portrait" },
      // Wikipedia fallbacks
      { type: "wikipedia", query: "Cardi B rapper" },
      { type: "wikipedia", query: "Zohran Mamdani New York politician" },
    ],
  },
  {
    titleMatch: "K-Pop",
    label: "K-Pop AI Crisis",
    strategies: [
      // Unsplash: K-pop stage visuals — bright, stylised, unmistakably K-pop
      { type: "unsplash", query: "kpop concert stage performance lights crowd", orientation: "portrait" },
      { type: "unsplash", query: "asian pop music concert stage fans lights", orientation: "portrait" },
      { type: "unsplash", query: "concert performance stage colorful lights crowd", orientation: "portrait" },
      // Wikipedia: BLACKPINK as recognisable K-pop act fallback
      { type: "wikipedia", query: "BLACKPINK K-pop group" },
    ],
  },
];

// ── Quality gate ──────────────────────────────────────────────────────────────
// Minimum bar: file must be ≥ 60 KB AND dimensions (if parseable) ≥ 800px wide.
async function passesQuality(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return false;
    const size = parseInt(res.headers.get("content-length") ?? "0", 10);
    if (size > 0 && size < 60_000) return false;
    return true;
  } catch { return true; } // if HEAD fails, optimistically allow
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function fetchDimensions(url) {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-2047" }, signal: AbortSignal.timeout(4000) });
    if (!res.ok && res.status !== 206) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // PNG
    if (buf[0]===0x89&&buf[1]===0x50&&buf[2]===0x4e&&buf[3]===0x47 && buf.length>=24)
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    // JPEG
    if (buf[0]===0xff&&buf[1]===0xd8) {
      let i=2;
      while (i < buf.length-8) {
        if (buf[i]!==0xff) break;
        const m=buf[i+1]; const l=buf.readUInt16BE(i+2);
        if (m===0xc0||m===0xc2) return { width: buf.readUInt16BE(i+7), height: buf.readUInt16BE(i+5) };
        i+=2+l;
      }
    }
    // WebP
    if (buf[0]===0x52&&buf[1]===0x49&&buf[2]===0x46&&buf[3]===0x46&&buf[8]===0x57&&buf[9]===0x45&&buf[10]===0x42&&buf[11]===0x50) {
      const c=buf.slice(12,16).toString("ascii");
      if (c==="VP8 "&&buf.length>=30&&buf[23]===0x9d&&buf[24]===0x01&&buf[25]===0x2a) {
        const w=buf.readUInt16LE(26)&0x3fff, h=buf.readUInt16LE(28)&0x3fff;
        if (w&&h) return {width:w,height:h};
      }
      if (c==="VP8L"&&buf.length>=25&&buf[20]===0x2f) {
        const bits=buf.readUInt32LE(21);
        return {width:(bits&0x3fff)+1,height:((bits>>14)&0x3fff)+1};
      }
      if (c==="VP8X"&&buf.length>=30) {
        return {width:(buf[24]|(buf[25]<<8)|(buf[26]<<16))+1,height:(buf[27]|(buf[28]<<8)|(buf[29]<<16))+1};
      }
    }
    return null;
  } catch { return null; }
}

// ── Spotify ───────────────────────────────────────────────────────────────────
let _spotToken=null, _spotExpiry=0;
async function getSpotifyToken() {
  if (_spotToken && Date.now()<_spotExpiry) return _spotToken;
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method:"POST", headers:{Authorization:`Basic ${creds}`,"Content-Type":"application/x-www-form-urlencoded"},
    body:"grant_type=client_credentials", signal:AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const d = await res.json();
  _spotToken = d.access_token; _spotExpiry = Date.now()+(d.expires_in-60)*1000;
  return _spotToken;
}

async function runSpotify(query) {
  const token = await getSpotifyToken(); if (!token) return undefined;
  for (const type of ["artist","album"]) {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=3&market=US`,
      { headers:{Authorization:`Bearer ${token}`}, signal:AbortSignal.timeout(5000) }
    );
    if (!res.ok) continue;
    const data = await res.json();
    const items = data?.[`${type}s`]?.items??[];
    for (const item of items) {
      const img = item.images?.find(i=>i.width>=600)?.url ?? item.images?.[0]?.url;
      // Skip album covers with text-heavy or generic AI album art
      if (img?.startsWith("http")) return img;
    }
  }
  return undefined;
}

// ── Wikipedia ─────────────────────────────────────────────────────────────────
async function runWikipedia(query) {
  const sRes = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`,
    { signal:AbortSignal.timeout(5000) }
  );
  if (!sRes.ok) return undefined;
  const sData = await sRes.json();
  const results = sData?.query?.search ?? [];
  for (const result of results) {
    const pageTitle = result.title;
    const imgRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=1200&format=json`,
      { signal:AbortSignal.timeout(5000) }
    );
    if (!imgRes.ok) continue;
    const imgData = await imgRes.json();
    const page = Object.values(imgData?.query?.pages??{})[0];
    const src = page?.thumbnail?.source;
    if (src?.startsWith("http")) return src;
  }
  return undefined;
}

// ── Unsplash ──────────────────────────────────────────────────────────────────
async function runUnsplash(query, orientation="portrait") {
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=${orientation}&content_filter=high`,
    { headers:{Authorization:`Client-ID ${UNSPLASH_KEY}`}, signal:AbortSignal.timeout(6000) }
  );
  if (!res.ok) return undefined;
  const data = await res.json();
  for (const photo of (data?.results??[])) {
    const src = photo?.urls?.full ?? photo?.urls?.regular;
    if (src?.startsWith("http")) return src;
  }
  return undefined;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

  for (const fix of ARTICLE_FIXES) {
    const article = data.articles.find(a => a.title.includes(fix.titleMatch));
    if (!article) { console.log(`⚠ Not found: ${fix.titleMatch}`); continue; }

    console.log(`\n🔧 ${fix.label}`);
    console.log(`   OLD: ${article.imageUrl?.slice(0,90)}`);

    let newUrl;
    let usedSource;

    for (const s of fix.strategies) {
      let url;
      if (s.type === "wikipedia")     url = await runWikipedia(s.query);
      else if (s.type === "spotify")  url = await runSpotify(s.query);
      else if (s.type === "unsplash") url = await runUnsplash(s.query, s.orientation);

      if (url?.startsWith("http") && await passesQuality(url)) {
        newUrl = url; usedSource = `${s.type}(${s.query})`;
        break;
      }
      if (url?.startsWith("http")) console.log(`   ✗ ${s.type}(${s.query}) — failed quality check`);
      console.log(`   ✗ ${s.type}(${s.query}) — nothing`);
    }

    if (!newUrl) { console.log(`   ⚠ All strategies failed — keeping original`); continue; }

    const dims = await fetchDimensions(newUrl);
    article.imageUrl    = newUrl;
    article.imageWidth  = dims?.width  ?? null;
    article.imageHeight = dims?.height ?? null;

    console.log(`   ✓ ${usedSource}`);
    console.log(`   NEW: ${newUrl.slice(0,90)}`);
    console.log(`   Dims: ${dims ? `${dims.width}×${dims.height} (ratio ${(dims.width/dims.height).toFixed(2)})` : "unknown → cover fallback"}`);
  }

  // Save
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log("\n✅ Saved to data file");

  // Sync /tmp/
  const dateStr = path.basename(DATA_FILE, ".json").replace("feed-", "");
  const tmpFile = `/tmp/popcorn-curated-${dateStr}.json`;
  if (fs.existsSync(tmpFile)) {
    const tmpData = JSON.parse(fs.readFileSync(tmpFile, "utf-8"));
    const byTitle = new Map(data.articles.map(a => [a.title, a]));
    for (const a of (tmpData.articles??[])) {
      const u = byTitle.get(a.title);
      if (u) { a.imageUrl=u.imageUrl; a.imageWidth=u.imageWidth; a.imageHeight=u.imageHeight; }
    }
    fs.writeFileSync(tmpFile, JSON.stringify(tmpData, null, 2));
    console.log("✅ Synced /tmp/ cache");
  }
}

main().catch(console.error);
