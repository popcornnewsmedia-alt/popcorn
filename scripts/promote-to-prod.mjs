#!/usr/bin/env node
/**
 * promote-to-prod.mjs
 *
 * Promotes all dev-staged articles for a given date to production.
 *
 * Usage:
 *   node scripts/promote-to-prod.mjs            # promotes today
 *   node scripts/promote-to-prod.mjs 2026-04-11  # promotes a specific date
 *
 * Run from the repo root (where .env lives).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env from repo root ──────────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env");
let env = {};
try {
  env = Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );
} catch {
  console.error("❌ Could not read .env file at:", envPath);
  process.exit(1);
}

const SUPABASE_URL             = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Target date ───────────────────────────────────────────────────────────────
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("❌ Date must be in YYYY-MM-DD format, got:", date);
  process.exit(1);
}

console.log(`\n🚀 Promoting articles for ${date} from dev → prod…\n`);

// ── First, show what will be promoted ─────────────────────────────────────────
const { data: preview, error: previewErr } = await supabase
  .from("articles")
  .select("id, title, category, signal_score")
  .eq("feed_date", date)
  .eq("stage", "dev")
  .order("signal_score", { ascending: false });

if (previewErr) {
  console.error("❌ Failed to query articles:", previewErr.message);
  process.exit(1);
}

if (!preview || preview.length === 0) {
  console.log(`ℹ️  No dev articles found for ${date}. Nothing to promote.`);
  process.exit(0);
}

console.log(`Found ${preview.length} articles to promote:\n`);
for (const a of preview) {
  const score = a.signal_score != null ? `[${Number(a.signal_score).toFixed(1)}]` : "";
  console.log(`  • [${a.category}] ${score} ${a.title}`);
}

// ── Promote ───────────────────────────────────────────────────────────────────
const { data, error } = await supabase
  .from("articles")
  .update({ stage: "prod" })
  .eq("feed_date", date)
  .eq("stage", "dev")
  .select("title");

if (error) {
  console.error("\n❌ Promotion failed:", error.message);
  process.exit(1);
}

console.log(`\n✅ Promoted ${data?.length ?? 0} articles from ${date} to production.`);
console.log("   They are now live on popcornmedia.org.\n");
