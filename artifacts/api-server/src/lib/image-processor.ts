/**
 * Image processor — downloads, resizes, and uploads article images to
 * Supabase Storage so the feed serves pre-sized, CDN-cached JPEGs instead
 * of pulling multi-megabyte originals from third-party sources.
 *
 * Used by `upsertFeedToSupabase` at publish time. Existing DB rows are
 * untouched; this runs ONCE per new article, replacing the source URL
 * with a Supabase Storage public URL before the row is inserted.
 *
 * Pipeline:
 *   1. Fetch source bytes (10s timeout, follows redirects)
 *   2. sharp() — resize to max 2400px wide (no upscaling), re-encode as
 *      JPEG quality 95, auto-rotate via EXIF, strip metadata.
 *      2400 is chosen so that a portrait-cropped landscape source still
 *      retains ≥1:1 pixel density on iPhone Pro Max (1290 device px wide)
 *      after ~35% horizontal crop from object-fit:cover on the feed card.
 *   3. Upload to the `article-images` Supabase bucket with a deterministic
 *      key so retries are idempotent (`YYYY-MM-DD/<hash>.jpg`)
 *   4. Return the bucket's public URL
 *
 * Failure modes (all return `null` so the caller keeps the original URL):
 *   - Network timeout / non-200
 *   - Unsupported format (SVG, GIF animation, etc.)
 *   - Supabase upload error
 *
 * The caller MUST tolerate a null return value and fall back to the
 * original URL — we never want image processing to block a curation run.
 */

import sharp from "sharp";
import crypto from "node:crypto";
import { supabase } from "./supabase-client.js";

const BUCKET = "article-images";
const TARGET_WIDTH = 2400;
const JPEG_QUALITY = 95;
const FETCH_TIMEOUT_MS = 10_000;

export interface ProcessedImage {
  url: string;          // Supabase public URL
  width: number;        // resized width (≤ TARGET_WIDTH)
  height: number;       // resized height
  bytes: number;        // file size in bytes
  credit: string;       // human-readable source name derived from origin URL
}

// ─── Image credit derivation ────────────────────────────────────────────────
// Maps the host of an image's original source URL to the publisher / archive
// the photo should be credited to. Runs at upload time (we know the source
// URL before it's rewritten to Supabase Storage) so the derived credit is
// persisted alongside the Storage URL in the `image_credit` column.
//
// Falls back to a cleaned-up hostname ("variety.com" → "Variety") for any
// host that isn't in the explicit map, so every newly-processed image gets
// some attribution.

const HOST_CREDIT_MAP: Record<string, string> = {
  "upload.wikimedia.org":          "Wikimedia Commons",
  "commons.wikimedia.org":         "Wikimedia Commons",
  "en.wikipedia.org":              "Wikimedia Commons",
  "i.ytimg.com":                   "YouTube",
  "img.youtube.com":               "YouTube",
  "image.tmdb.org":                "TMDB",
  "is1-ssl.mzstatic.com":          "Apple Music",
  "is2-ssl.mzstatic.com":          "Apple Music",
  "is3-ssl.mzstatic.com":          "Apple Music",
  "is4-ssl.mzstatic.com":          "Apple Music",
  "is5-ssl.mzstatic.com":          "Apple Music",
  "i.scdn.co":                     "Spotify",
  "images.unsplash.com":           "Unsplash",
  "media.pitchfork.com":           "Pitchfork",
  "variety.com":                   "Variety",
  "www.variety.com":               "Variety",
  "pyxis.nymag.com":               "Vulture",
  "www.vulture.com":               "Vulture",
  "deadline.com":                  "Deadline",
  "www.deadline.com":              "Deadline",
  "hollywoodreporter.com":         "The Hollywood Reporter",
  "www.hollywoodreporter.com":     "The Hollywood Reporter",
  "pagesix.com":                   "Page Six",
  "www.pagesix.com":               "Page Six",
  "nypost.com":                    "New York Post",
  "www.nypost.com":                "New York Post",
  "consequence.net":               "Consequence",
  "www.consequence.net":           "Consequence",
  "stereogum.com":                 "Stereogum",
  "www.stereogum.com":             "Stereogum",
  "www.nme.com":                   "NME",
  "nme.com":                       "NME",
  "www.rollingstone.com":          "Rolling Stone",
  "rollingstone.com":              "Rolling Stone",
  "www.theverge.com":              "The Verge",
  "theverge.com":                  "The Verge",
  "techcrunch.com":                "TechCrunch",
  "www.techcrunch.com":            "TechCrunch",
  "www.engadget.com":              "Engadget",
  "engadget.com":                  "Engadget",
  "www.wired.com":                 "Wired",
  "wired.com":                     "Wired",
  "futurism.com":                  "Futurism",
  "www.futurism.com":              "Futurism",
  "arstechnica.com":               "Ars Technica",
  "cdn.arstechnica.net":           "Ars Technica",
  "www.polygon.com":               "Polygon",
  "polygon.com":                   "Polygon",
  "www.ign.com":                   "IGN",
  "ign.com":                       "IGN",
  "www.kotaku.com":                "Kotaku",
  "kotaku.com":                    "Kotaku",
  "dexerto.com":                   "Dexerto",
  "www.dexerto.com":                "Dexerto",
  "www.eater.com":                 "Eater",
  "eater.com":                     "Eater",
  "www.vogue.com":                 "Vogue",
  "vogue.com":                     "Vogue",
  "www.gq.com":                    "GQ",
  "gq.com":                        "GQ",
  "www.highsnobiety.com":          "Highsnobiety",
  "highsnobiety.com":              "Highsnobiety",
  "www.theguardian.com":           "The Guardian",
  "i.guim.co.uk":                  "The Guardian",
  "www.nytimes.com":               "The New York Times",
  "static01.nyt.com":              "The New York Times",
  "www.washingtonpost.com":        "The Washington Post",
  "www.reuters.com":                "Reuters",
  "www.apnews.com":                "Associated Press",
  "ichef.bbci.co.uk":              "BBC",
  "www.bbc.com":                   "BBC",
};

function titleCaseHost(raw: string): string {
  // Strip leading www., drop TLD, replace hyphens with spaces, title-case
  const stripped = raw.replace(/^www\./i, "").replace(/\.[a-z]{2,6}(\.[a-z]{2})?$/i, "");
  const cleaned = stripped.replace(/[-_]/g, " ").trim();
  if (!cleaned) return raw;
  return cleaned
    .split(/\s+/)
    .map((word) => (word.length > 3 ? word[0].toUpperCase() + word.slice(1) : word.toUpperCase()))
    .join(" ");
}

export function deriveImageCredit(sourceUrl: string): string {
  try {
    const u = new URL(sourceUrl);
    const host = u.hostname.toLowerCase();
    if (HOST_CREDIT_MAP[host]) return HOST_CREDIT_MAP[host];

    // Try the root host (drop leading subdomain like "media.", "cdn.", "img.")
    const rootAttempt = host.replace(/^(media|cdn|img|i|static\d*|image|images|assets)\./, "");
    if (HOST_CREDIT_MAP[rootAttempt]) return HOST_CREDIT_MAP[rootAttempt];

    return titleCaseHost(host);
  } catch {
    return "Source";
  }
}

/**
 * Rewrites a raw Wikimedia upload URL to its `/thumb/` variant at the given
 * pixel width. The thumb endpoint serves pre-resized JPEGs (often <500KB)
 * instead of the multi-megabyte master — Wikimedia's master images can be
 * 12000+px wide and time out our 10s fetch budget.
 *
 *   in:  https://upload.wikimedia.org/wikipedia/commons/d/de/Colosseo_2020.jpg
 *   out: https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/2400px-Colosseo_2020.jpg
 *
 * Already-thumbnailed URLs and non-Wikimedia URLs pass through unchanged.
 */
function maybeRewriteWikimediaThumb(url: string, widthPx = 2400): string {
  if (!url.includes("upload.wikimedia.org")) return url;
  if (url.includes("/thumb/")) return url; // already a thumb
  const m = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+)\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)(\?.*)?$/i);
  if (!m) return url;
  const [, base, c1, c2, filename] = m;
  return `${base}/thumb/${c1}/${c2}/${filename}/${widthPx}px-${filename}`;
}

/**
 * Fetch with an abort timeout. Returns the response body as a Buffer, or
 * throws if the fetch fails, times out, or returns a non-200.
 */
async function fetchBytes(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Some CDNs (Wikipedia, Getty) return 403 for requests without
        // a normal-looking User-Agent header.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Download, resize, and upload a single image. Returns the Supabase
 * public URL plus the resized dimensions, or null on any failure.
 *
 * The storage key is deterministic: `YYYY-MM-DD/<sha1(srcUrl)>.jpg`, so
 * re-running curation on the same day with the same source URL will
 * `upsert: true` over the existing object rather than duplicating it.
 */
export async function processAndUploadImage(
  sourceUrl: string,
  feedDate: string, // "YYYY-MM-DD"
): Promise<ProcessedImage | null> {
  try {
    // 1. Download. For Wikimedia URLs, rewrite to a 2400px /thumb/ variant
    // first — the masters can be 100MB+ and routinely time out our 10s
    // fetch budget (e.g. Colosseo_2020.jpg = 12051×8442). The thumb endpoint
    // serves a pre-resized JPEG that fits comfortably in the budget.
    const fetchUrl = maybeRewriteWikimediaThumb(sourceUrl);
    const srcBytes = await fetchBytes(fetchUrl);

    // 2. Resize + re-encode
    //    - `withoutEnlargement: true` skips upscaling for already-small images
    //    - `rotate()` honors EXIF orientation so portraits don't end up sideways
    //    - `.jpeg({ quality, mozjpeg })` produces the smallest sensible JPEG
    const pipeline = sharp(srcBytes, { failOn: "truncated" })
      .rotate()
      .resize({
        width: TARGET_WIDTH,
        withoutEnlargement: true,
        fit: "inside",
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true });

    const { data: outputBuffer, info } = await pipeline.toBuffer({
      resolveWithObject: true,
    });

    // 3. Upload to Supabase Storage
    const hash = crypto
      .createHash("sha1")
      .update(sourceUrl)
      .digest("hex")
      .slice(0, 16);
    const key = `${feedDate}/${hash}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(key, outputBuffer, {
        contentType: "image/jpeg",
        cacheControl: "31536000", // 1 year — content is immutable (hash-keyed)
        upsert: true,
      });

    if (uploadErr) {
      console.warn(
        `[image-processor] upload failed for ${sourceUrl.slice(0, 60)}: ${uploadErr.message}`,
      );
      return null;
    }

    // 4. Return public URL
    const { data: publicData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(key);

    return {
      url: publicData.publicUrl,
      width: info.width,
      height: info.height,
      bytes: outputBuffer.length,
      credit: deriveImageCredit(sourceUrl),
    };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.warn(
      `[image-processor] skipped ${sourceUrl.slice(0, 60)}: ${msg}`,
    );
    return null;
  }
}
