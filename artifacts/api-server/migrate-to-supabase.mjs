/**
 * One-time migration: copies all existing local JSON feed data to Supabase.
 * Run AFTER the schema SQL has been applied in the Supabase dashboard.
 *
 * Usage:  node migrate-to-supabase.mjs
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://kxfooueifvqldqqvbpeu.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4Zm9vdWVpZnZxbGRxcXZicGV1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ1MDc2OCwiZXhwIjoyMDkxMDI2NzY4fQ.N5VZDDVJCjyw1k_Lj0ZF0vLRGfkBaly7jrcBbp0JYw8";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const DATA_DIR = path.join(__dirname, "data");

function articleToRow(a, feedDate) {
  return {
    feed_date:          feedDate,
    title:              a.title,
    summary:            a.summary    ?? null,
    content:            a.content    ?? null,
    category:           a.category   ?? null,
    source:             a.source     ?? null,
    read_time_minutes:  a.readTimeMinutes ?? 3,
    published_at:       a.publishedAt,
    likes:              a.likes      ?? 1000,
    gradient_start:     a.gradientStart ?? null,
    gradient_end:       a.gradientEnd   ?? null,
    tag:                a.tag        ?? "FEATURE",
    image_url:          a.imageUrl   ?? null,
    image_width:        a.imageWidth ?? null,
    image_height:       a.imageHeight ?? null,
    key_points:         a.keyPoints  ?? [],
    signal_score:       a.signalScore ?? null,
    wiki_search_query:  a.wikiSearchQuery ?? null,
  };
}

async function migrateArticles() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log("No data/ directory found — nothing to migrate.");
    return;
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => /^feed-\d{4}-\d{2}-\d{2}\.json$/.test(f));
  console.log(`Found ${files.length} feed file(s) to migrate.`);

  for (const file of files) {
    const feedDate = file.replace("feed-", "").replace(".json", "");
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
    const articles = raw.articles ?? [];
    if (articles.length === 0) { console.log(`  ${feedDate}: 0 articles, skipping`); continue; }

    const rows = articles.map(a => articleToRow(a, feedDate));

    // Delete existing rows for this date first (idempotent)
    await supabase.from("articles").delete().eq("feed_date", feedDate);

    const { error } = await supabase.from("articles").insert(rows);
    if (error) {
      console.error(`  ✗ ${feedDate}: ${error.message}`);
    } else {
      console.log(`  ✓ ${feedDate}: ${rows.length} articles inserted`);
    }
  }
}

async function migrateUncurated() {
  const uncuratedDir = path.join(DATA_DIR, "uncurated");
  if (!fs.existsSync(uncuratedDir)) {
    console.log("No data/uncurated/ directory — skipping uncurated migration.");
    return;
  }

  const files = fs.readdirSync(uncuratedDir).filter(f => /^uncurated-\d{4}-\d{2}-\d{2}\.json$/.test(f));
  console.log(`\nFound ${files.length} uncurated file(s) to migrate.`);

  for (const file of files) {
    const feedDate = file.replace("uncurated-", "").replace(".json", "");
    const raw = JSON.parse(fs.readFileSync(path.join(uncuratedDir, file), "utf-8"));
    const entries = raw.articles ?? [];
    if (entries.length === 0) { console.log(`  ${feedDate}: 0 entries, skipping`); continue; }

    const rows = entries.map(e => ({
      feed_date:   feedDate,
      title:       e.title,
      source:      e.source    ?? null,
      pub_date:    e.pubDate   ?? null,
      link:        e.link      ?? null,
      dedup_rank:  e.dedupRank ?? null,
      dedup_score: e.dedupScore ?? null,
      stage:       e.stage,
      reason:      e.reason    ?? null,
      raw_item:    e._raw      ?? null,
      fetched_at:  raw.fetchedAt ?? null,
    }));

    await supabase.from("uncurated_articles").delete().eq("feed_date", feedDate);

    const { error } = await supabase.from("uncurated_articles").insert(rows);
    if (error) {
      console.error(`  ✗ ${feedDate}: ${error.message}`);
    } else {
      console.log(`  ✓ ${feedDate}: ${rows.length} uncurated entries inserted`);
    }
  }
}

console.log("Starting Supabase migration...\n");
await migrateArticles();
await migrateUncurated();
console.log("\nMigration complete.");
