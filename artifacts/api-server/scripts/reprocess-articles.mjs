/**
 * Reprocess existing articles through the updated image selection and
 * enrichment pipelines WITHOUT re-fetching RSS.
 *
 * Usage:
 *   cd artifacts/api-server
 *   pnpm run build && node --env-file=../../.env scripts/reprocess-articles.mjs [--images-only] [--content-only]
 */

import https from "node:https";
import { createClient } from "@supabase/supabase-js";

// Dynamic import from built dist
const enricher = await import("../dist/index.mjs").catch(() => null);

// We can't easily import selectBestImageForRerun from the bundled dist.
// Instead, we'll use a standalone approach: fetch from Supabase, call Claude
// for content, and use our own image re-selection via the running server API.
// Actually, let's just build a mini-bundle of just the reprocess script.

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const imagesOnly = args.includes("--images-only");
const contentOnly = args.includes("--content-only");
const doImages = !contentOnly;
const doContent = !imagesOnly;

// ── Supabase ────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ── Claude API helper ───────────────────────────────────────────────────────
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY && doContent) {
  console.error("Missing ANTHROPIC_API_KEY — needed for content rewriting");
  process.exit(1);
}

function callClaude(prompt, maxTokens) {
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
        res.on("data", (chunk) => (data += chunk));
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

// ── Image reprocessing via local API server ─────────────────────────────────
// The server exposes selectBestImageForRerun — we'll call it via a local HTTP
// endpoint. But we need to first start the server... OR we can just call the
// API endpoint to refresh images.
//
// Actually the easiest approach: start the API server, then use a custom route.
// But that's complex. Let's use a different approach: build a mini esbuild bundle.

// For now let's handle content-only first (which is the simpler case).
// For images, we'll add a route to the API server.

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
  const linkMap = new Map();
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
    const tag = row.tag ?? "FEATURE";
    console.log(`\n─── [${i + 1}/${rows.length}] ${row.title.slice(0, 60)} (${tag}) ───`);

    const updates = {};

    // ── Image reprocessing ──────────────────────────────────────────────────
    if (doImages) {
      try {
        const articleUrl = linkMap.get(row.title) ?? "";
        console.log(`  🖼️  Re-selecting image via API server (wiki: "${row.wiki_search_query ?? ""}", link: ${articleUrl ? "yes" : "no"})...`);

        // Call the running API server's reprocess endpoint
        const imgRes = await fetch("http://localhost:3001/api/reprocess-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleId: row.id,
            title: row.title,
            summary: row.summary ?? "",
            category: row.category ?? "Internet",
            tag,
            wikiSearchQuery: row.wiki_search_query ?? "",
            articleUrl,
            currentImageUrl: row.image_url ?? null,
          }),
        });

        if (imgRes.ok) {
          const imgData = await imgRes.json();
          if (imgData.changed) {
            updates.image_url = imgData.url;
            updates.image_width = imgData.width ?? null;
            updates.image_height = imgData.height ?? null;
            updates.image_focal_x = imgData.focalX ?? null;
            updates.image_focal_y = imgData.focalY ?? null;
            updates.image_safe_w = imgData.safeW ?? null;
            updates.image_safe_h = imgData.safeH ?? null;
            console.log(`  ✅ Image CHANGED: ${imgData.winnerSource} (${imgData.width}×${imgData.height}) [intent=${imgData.intent}, ${imgData.top3}]`);
          } else {
            console.log(`  ⏸️  Image unchanged: ${imgData.winnerSource} (${imgData.top3})`);
          }
        } else {
          console.error(`  ❌ Image API error: ${imgRes.status} ${await imgRes.text()}`);
        }
      } catch (e) {
        console.error(`  ❌ Image error: ${e.message}`);
      }
    }

    // ── Content rewriting ───────────────────────────────────────────────────
    if (doContent) {
      const depthTag = ["BREAKING", "RELEASE"].includes(tag) ? "short" : "deep";
      const paraCount = depthTag === "short" ? "3 short paragraphs" : "4 to 5 short paragraphs with analysis and context";
      console.log(`  📝 Re-writing content (${depthTag}: ${paraCount})...`);

      const rewritePrompt = `You are the editorial voice for Popcorn — a cultural lens app that surfaces what actually matters in culture right now.

Rewrite the following article with these rules:
- ALWAYS use real names. Every headline and the first sentence MUST name the actual person, album, film, show, app, platform or company — never "the app", "the platform", "the company", "the service", "the brand", "the artist" or any other generic substitute.
- PRESERVE KEY SPECIFICS. If the source names a specific model, product, feature, track, award, or proper noun, you MUST include it.
- Write like you are talking to a friend. Short sentences. Simple words. No jargon.
- No dashes or hyphens used as pauses in sentences. Use plain punctuation.
- No bullet points inside the story content.
- Keep it upbeat and engaging. Tell people why they should care.
- Paragraphs MUST be separated by a blank line (\\n\\n). Never run paragraphs together.
- If a story references something unfamiliar, briefly explain it in plain English.
- This is a ${tag} article. Write ${paraCount}.${depthTag === "deep" ? " Add analysis, context, or perspective beyond the headline facts." : ""}
- For stories with past-event context, include a brief 1–2 sentence backstory so new readers are not lost.

EXISTING ARTICLE:
Title: ${row.title}
Category: ${row.category}
Tag: ${tag}
Summary: ${row.summary}
Content:
${row.content}

Output ONLY the rewritten content (paragraphs separated by \\n\\n). No title, no summary, no JSON, no code fences, no commentary.`;

      try {
        const newContent = await callClaude(rewritePrompt, 2000);
        if (newContent && newContent.length > 100) {
          const paragraphs = newContent.split(/\n\n+/).filter(p => p.trim().length > 0);
          updates.content = paragraphs.join("\n\n");
          console.log(`  ✅ Content rewritten: ${paragraphs.length} paragraphs, ${updates.content.length} chars`);
        } else {
          console.log(`  ⚠️  Content too short or empty, keeping original`);
        }
      } catch (e) {
        console.error(`  ❌ Content error: ${e.message}`);
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
        // Retry without focal columns
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
