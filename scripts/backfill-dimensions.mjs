/**
 * Dimension backfill script — adds imageWidth / imageHeight to every article
 * in the stored feed JSON that is missing them.
 *
 * Uses a range request (bytes=0-2047) to read PNG IHDR / JPEG SOF headers
 * without downloading full images.
 *
 * Usage: node scripts/backfill-dimensions.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, "../artifacts/api-server/data/feed-2026-04-04.json");

// ── Dimension fetcher (mirrors rss-enricher.ts) ──────────────────────────────
async function fetchImageDimensions(url) {
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-2047" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok && res.status !== 206) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    // PNG: magic 89 50 4E 47 — width @ offset 16, height @ 20 (4-byte big-endian)
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      if (buf.length < 24) return null;
      const width  = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      return { width, height };
    }

    // JPEG: starts FF D8 — scan for SOF0 (FF C0) or SOF2 (FF C2)
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 8) {
        if (buf[i] !== 0xff) break;
        const marker = buf[i + 1];
        const segLen = buf.readUInt16BE(i + 2);
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buf.readUInt16BE(i + 5);
          const width  = buf.readUInt16BE(i + 7);
          return { width, height };
        }
        i += 2 + segLen;
      }
    }

    // WebP: RIFF????WEBP at bytes 0-11
    if (
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50   // WEBP
    ) {
      const chunk = buf.slice(12, 16).toString("ascii");

      // VP8 (lossy): key frame sync at 23, width/height at 26-29
      if (chunk === "VP8 " && buf.length >= 30) {
        if (buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
          const width  = buf.readUInt16LE(26) & 0x3fff;
          const height = buf.readUInt16LE(28) & 0x3fff;
          if (width > 0 && height > 0) return { width, height };
        }
      }

      // VP8L (lossless): 28-bit packed header at offset 21
      if (chunk === "VP8L" && buf.length >= 25) {
        if (buf[20] === 0x2f) {
          const bits = buf.readUInt32LE(21);
          const width  = (bits & 0x3fff) + 1;
          const height = ((bits >> 14) & 0x3fff) + 1;
          if (width > 0 && height > 0) return { width, height };
        }
      }

      // VP8X (extended/animated): canvas w-1 at 24-26, h-1 at 27-29 (24-bit LE)
      if (chunk === "VP8X" && buf.length >= 30) {
        const width  = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
        const height = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
        if (width > 0 && height > 0) return { width, height };
      }
    }

    return null; // AVIF / other — can't parse
  } catch {
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const articles = data.articles ?? [];

  const needsDimensions = articles.filter(
    (a) => a.imageUrl && typeof a.imageWidth !== "number"
  );

  console.log(`📐 ${needsDimensions.length} / ${articles.length} articles need dimensions\n`);

  let updated = 0;
  let failed  = 0;

  // Process in batches of 5 to avoid hammering CDNs
  const BATCH = 5;
  for (let i = 0; i < needsDimensions.length; i += BATCH) {
    const batch = needsDimensions.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (article) => {
        const dims = await fetchImageDimensions(article.imageUrl);
        const title = article.title.slice(0, 50);
        if (dims) {
          article.imageWidth  = dims.width;
          article.imageHeight = dims.height;
          const ratio = (dims.width / dims.height).toFixed(2);
          const fit = !dims || (ratio > 0.8 && ratio < 1.8) ? "cover" : "contain";
          console.log(`  ✓ ${title}`);
          console.log(`    ${dims.width}×${dims.height}  ratio=${ratio}  → ${fit}`);
          updated++;
        } else {
          console.log(`  ✗ ${title}`);
          console.log(`    (could not parse — will default to cover)`);
          failed++;
        }
      })
    );
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  // Also update /tmp/ file if it exists — otherwise the server loads the stale
  // cached version on startup and ignores our updated data/ file.
  const dateStr = path.basename(DATA_FILE, ".json").replace("feed-", "");
  const tmpFile = `/tmp/popcorn-curated-${dateStr}.json`;
  if (fs.existsSync(tmpFile)) {
    try {
      const tmpData = JSON.parse(fs.readFileSync(tmpFile, "utf-8"));
      // Apply dimensions to /tmp/ articles by matching on title
      const dimsByTitle = new Map(
        data.articles.map((a) => [a.title, { imageWidth: a.imageWidth, imageHeight: a.imageHeight }])
      );
      for (const a of (tmpData.articles ?? [])) {
        const dims = dimsByTitle.get(a.title);
        if (dims) { a.imageWidth = dims.imageWidth; a.imageHeight = dims.imageHeight; }
      }
      fs.writeFileSync(tmpFile, JSON.stringify(tmpData, null, 2));
      console.log(`   Also updated /tmp/ cache → ${tmpFile}`);
    } catch {
      console.log(`   ⚠ Could not update /tmp/ cache — delete it manually: rm ${tmpFile}`);
    }
  }

  console.log(`\n✅ Done — ${updated} updated, ${failed} unparseable (kept as null → cover fallback)`);
  console.log(`   Saved → ${DATA_FILE}`);
}

main().catch(console.error);
