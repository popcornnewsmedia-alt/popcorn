#!/usr/bin/env node
/**
 * backfill-focal-points.mjs
 *
 * Reads local feed JSON files and writes focal point + safe-box data
 * to the Supabase articles table, matching rows by title.
 *
 * Prerequisites — run this SQL in the Supabase Dashboard → SQL Editor first:
 *
 *   ALTER TABLE articles
 *     ADD COLUMN IF NOT EXISTS image_focal_x float8,
 *     ADD COLUMN IF NOT EXISTS image_focal_y float8,
 *     ADD COLUMN IF NOT EXISTS image_safe_w  float8,
 *     ADD COLUMN IF NOT EXISTS image_safe_h  float8;
 *
 * Then run from repo root:
 *   node scripts/backfill-focal-points.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

// ── Load .env ────────────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── Collect all articles with focal point data from local JSON ────────────────
const dataDir = resolve(process.cwd(), "artifacts/api-server/data");
const feedFiles = readdirSync(dataDir)
  .filter((f) => f.startsWith("feed-") && f.endsWith(".json"))
  .sort();

const toUpdate = [];
for (const file of feedFiles) {
  const data = JSON.parse(readFileSync(join(dataDir, file), "utf8"));
  const articles = Array.isArray(data) ? data : data.articles ?? [];
  for (const a of articles) {
    if (a.imageFocalX !== null && a.imageFocalX !== undefined) {
      toUpdate.push({
        title:       a.title,
        imageFocalX: a.imageFocalX,
        imageFocalY: a.imageFocalY,
        imageSafeW:  a.imageSafeW ?? null,
        imageSafeH:  a.imageSafeH ?? null,
        imageWidth:  a.imageWidth ?? null,
        imageHeight: a.imageHeight ?? null,
      });
    }
  }
}

console.log(`\n🔍 Found ${toUpdate.length} articles with focal point data in local JSON\n`);

// ── Verify the columns exist before trying to update ─────────────────────────
const { error: testErr } = await supabase
  .from("articles")
  .select("image_focal_x")
  .limit(1);

if (testErr && /column.*does not exist/i.test(testErr.message)) {
  console.error("❌ Columns not found in Supabase.\n");
  console.error("   Please run this SQL in the Supabase Dashboard → SQL Editor:\n");
  console.error("   ALTER TABLE articles");
  console.error("     ADD COLUMN IF NOT EXISTS image_focal_x float8,");
  console.error("     ADD COLUMN IF NOT EXISTS image_focal_y float8,");
  console.error("     ADD COLUMN IF NOT EXISTS image_safe_w  float8,");
  console.error("     ADD COLUMN IF NOT EXISTS image_safe_h  float8;\n");
  process.exit(1);
}

// ── Update each article ───────────────────────────────────────────────────────
let updated = 0;
let alreadySet = 0;
let notFound = 0;

for (const article of toUpdate) {
  // Find by exact title
  const { data: rows, error: queryErr } = await supabase
    .from("articles")
    .select("id, title, image_focal_x")
    .eq("title", article.title)
    .limit(2); // >1 would mean duplicate titles

  if (queryErr) {
    console.error(`  ❌ Query error for "${article.title}":`, queryErr.message);
    continue;
  }

  if (!rows || rows.length === 0) {
    console.log(`  ⚠️  Not in Supabase: "${article.title}"`);
    notFound++;
    continue;
  }

  if (rows.length > 1) {
    console.warn(`  ⚠️  Multiple matches for "${article.title}" — skipping`);
    continue;
  }

  const row = rows[0];

  if (row.image_focal_x !== null) {
    alreadySet++;
    continue;
  }

  const { error: updateErr } = await supabase
    .from("articles")
    .update({
      image_focal_x: article.imageFocalX,
      image_focal_y: article.imageFocalY,
      image_safe_w:  article.imageSafeW,
      image_safe_h:  article.imageSafeH,
      // Also back-fill image dimensions if missing
      image_width:   article.imageWidth,
      image_height:  article.imageHeight,
    })
    .eq("id", row.id);

  if (updateErr) {
    console.error(`  ❌ Update error for "${article.title}":`, updateErr.message);
  } else {
    console.log(`  ✓ ${article.title} → focal=(${article.imageFocalX}, ${article.imageFocalY})`);
    updated++;
  }
}

console.log(`\n✅ Done — updated: ${updated}  already set: ${alreadySet}  not found in DB: ${notFound}\n`);
