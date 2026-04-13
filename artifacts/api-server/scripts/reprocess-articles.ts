/**
 * Reprocess existing articles through the updated image selection and
 * enrichment pipelines WITHOUT re-fetching RSS.
 *
 * Usage:
 *   cd artifacts/api-server
 *   node --env-file=../../.env scripts/reprocess-articles.ts [--images-only] [--content-only]
 *
 * What it does:
 *   1. Loads all prod articles for feed_date = 2026-04-12 from Supabase
 *   2. Re-runs selectBestImageForRerun() on each (new scoring, Unsplash boost, portrait safety net)
 *   3. Re-writes content via Claude with tag-based depth (3 para for BREAKING/RELEASE, 4-5 for others)
 *   4. Updates each article row in Supabase
 */

import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import {
  selectBestImageForRerun,
  type EnrichedArticle,
} from "../src/lib/rss-enricher.js";

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const imagesOnly = args.includes("--images-only");
const contentOnly = args.includes("--content-only");
const doImages = !contentOnly;
const doContent = !imagesOnly;

// ── Supabase ────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ── Claude API helper ───────────────────────────────────────────────────────
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
if (!ANTHROPIC_KEY && doContent) {
  console.error("Missing ANTHROPIC_API_KEY — needed for content rewriting");
  process.exit(1);
}

function callClaude(prompt: string, maxTokens: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json?.content?.[0]?.text ?? "");
          } catch {
            reject(new Error(`Claude parse error: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const FEED_DATE = "2026-04-12";

  // 1. Load articles
  const { data: rows, error } = await supabase
    .from("articles")
    .select("*")
    .eq("feed_date", FEED_DATE)
    .eq("stage", "prod");

  if (error || !rows?.length) {
    console.error("Failed to load articles:", error?.message ?? "no rows");
    process.exit(1);
  }
  console.log(`\n📰 Loaded ${rows.length} prod articles for ${FEED_DATE}\n`);

  // 2. Try to find original links from uncurated_articles
  const linkMap = new Map<string, string>();
  const { data: uncurated } = await supabase
    .from("uncurated_articles")
    .select("title, link")
    .eq("feed_date", FEED_DATE);
  for (const u of uncurated ?? []) {
    if (u.link) linkMap.set(u.title, u.link);
  }
  console.log(`🔗 Found ${linkMap.size} original links from uncurated_articles\n`);

  // 3. Process each article
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const article: EnrichedArticle = {
      id: row.id,
      title: row.title,
      summary: row.summary ?? "",
      content: row.content ?? "",
      category: row.category ?? "Internet",
      source: row.source ?? "",
      readTimeMinutes: row.read_time_minutes ?? 3,
      publishedAt: row.published_at,
      likes: row.likes ?? 1000,
      isBookmarked: false,
      gradientStart: row.gradient_start ?? "",
      gradientEnd: row.gradient_end ?? "",
      tag: row.tag ?? "FEATURE",
      imageUrl: row.image_url,
      imageWidth: row.image_width,
      imageHeight: row.image_height,
      keyPoints: row.key_points ?? [],
      signalScore: row.signal_score,
      wikiSearchQuery: row.wiki_search_query ?? "",
    };

    const articleUrl = linkMap.get(row.title) ?? "";
    const tag = row.tag ?? "FEATURE";
    console.log(`\n─── [${i + 1}/${rows.length}] ${article.title.slice(0, 60)} (${tag}) ───`);

    const updates: Record<string, unknown> = {};

    // ── Image reprocessing ──────────────────────────────────────────────────
    if (doImages) {
      try {
        console.log(`  🖼️  Re-selecting image (wiki: "${article.wikiSearchQuery}", link: ${articleUrl ? "yes" : "no"})...`);
        const img = await selectBestImageForRerun(article, articleUrl, row.image_url ?? null);
        const changed = img.url !== row.image_url;
        if (changed) {
          updates.image_url = img.url;
          updates.image_width = img.width ?? null;
          updates.image_height = img.height ?? null;
          updates.image_focal_x = img.focalX ?? null;
          updates.image_focal_y = img.focalY ?? null;
          updates.image_safe_w = img.safeW ?? null;
          updates.image_safe_h = img.safeH ?? null;
          console.log(`  ✅ Image CHANGED: ${img.debug?.winnerSource} (${img.width}×${img.height}) [intent=${img.debug?.intent}, ${img.debug?.top3}]`);
        } else {
          console.log(`  ⏸️  Image unchanged: ${img.debug?.winnerSource} (${img.debug?.top3})`);
        }
      } catch (e) {
        console.error(`  ❌ Image error: ${(e as Error).message}`);
      }
    }

    // ── Content rewriting ───────────────────────────────────────────────────
    if (doContent) {
      const depthTag = ["BREAKING", "RELEASE"].includes(tag) ? "short" : "deep";
      const paraCount = depthTag === "short" ? "3 to 4 short paragraphs" : "5 to 6 short paragraphs with analysis and context";
      console.log(`  📝 Re-writing content (${depthTag}: ${paraCount})...`);

      const rewritePrompt = `You are the editorial voice for Popcorn — a cultural lens app that surfaces what actually matters in culture right now.

Rewrite the following article with these rules:
- ALWAYS use real names. Name the actual person, album, film, show, app, platform or company.
- Write like you are talking to a friend. Short sentences. Simple words. No jargon.
- No dashes or hyphens used as pauses in sentences. Use plain punctuation.
- No bullet points inside the story content.
- Keep it upbeat and engaging. Tell people why they should care.
- Paragraphs MUST be separated by a blank line (\\n\\n). Never run paragraphs together.
- If a story references something unfamiliar, briefly explain it in plain English.
- This is a ${tag} article. Write ${paraCount}. Weave in specific numbers, dates, quotes, or details from the source — readers want the full picture, not just the headline.
- For stories with past-event context, include a brief 1–2 sentence backstory.

EXISTING ARTICLE:
Title: ${article.title}
Category: ${article.category}
Tag: ${tag}
Summary: ${article.summary}
Content: ${article.content}

Output ONLY the rewritten content (paragraphs separated by \\n\\n). No title, no summary, no JSON, no code fences.`;

      try {
        const newContent = await callClaude(rewritePrompt, 2000);
        if (newContent && newContent.length > 100) {
          const paragraphs = newContent.split(/\n\n+/).filter(p => p.trim().length > 0);
          updates.content = paragraphs.join("\n\n");
          console.log(`  ✅ Content rewritten: ${paragraphs.length} paragraphs, ${updates.content.toString().length} chars`);
        } else {
          console.log(`  ⚠️  Content too short or empty, keeping original`);
        }
      } catch (e) {
        console.error(`  ❌ Content error: ${(e as Error).message}`);
      }
    }

    // ── Update Supabase ─────────────────────────────────────────────────────
    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from("articles")
        .update(updates)
        .eq("id", row.id);
      if (upErr) {
        console.error(`  ❌ Supabase update error: ${upErr.message}`);
        // Retry without focal columns if they don't exist
        if (upErr.message.includes("column")) {
          const safeUpdates = { ...updates };
          delete safeUpdates.image_focal_x;
          delete safeUpdates.image_focal_y;
          delete safeUpdates.image_safe_w;
          delete safeUpdates.image_safe_h;
          const { error: retryErr } = await supabase
            .from("articles")
            .update(safeUpdates)
            .eq("id", row.id);
          if (retryErr) console.error(`  ❌ Retry error: ${retryErr.message}`);
          else console.log(`  ✅ Updated (without focal columns)`);
        }
      } else {
        console.log(`  ✅ Supabase updated (${Object.keys(updates).join(", ")})`);
      }
    } else {
      console.log(`  ⏸️  No changes to save`);
    }
  }

  console.log("\n✨ Reprocessing complete!\n");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
