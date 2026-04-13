import fs from "node:fs";
import https from "node:https";
import { Router, type IRouter } from "express";
import {
  getArticles,
  getIsLive,
  getArticleById,
  updateLike,
  toggleBookmark,
  triggerRefresh,
  triggerShortlist,
  publishSelected,
  publishRawItems,
  deleteArticles,
  updateArticleImageById,
} from "../lib/article-store.js";
import { backfillFocalPointsForToday } from "../lib/curated-store.js";
import { selectBestImageForRerun, detectImageFocalPoint, fetchImageDimensions, type EnrichedArticle } from "../lib/rss-enricher.js";
import { supabase } from "../lib/supabase-client.js";

const router: IRouter = Router();

// GET /api/news
router.get("/news", (req, res) => {
  const page = parseInt((req.query.page as string) ?? "1") || 1;
  const limit = parseInt((req.query.limit as string) ?? "10") || 10;
  const category = req.query.category as string | undefined;

  let filtered = getArticles();
  if (category && category !== "All") {
    filtered = filtered.filter((a) => a.category === category);
  }

  const offset = (page - 1) * limit;
  const slice = filtered.slice(offset, offset + limit + 1);
  const hasMore = slice.length > limit;
  if (hasMore) slice.pop();

  res.setHeader("X-Popcorn-Live", getIsLive() ? "1" : "0");
  res.json({
    articles: slice,
    total: filtered.length,
    page,
    limit,
    hasMore,
    isLive: getIsLive(),
  });
});

// GET /api/news/:id
router.get("/news/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const article = getArticleById(id);
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json(article);
});

// POST /api/news/:id/like
router.post("/news/:id/like", (req, res) => {
  const id = parseInt(req.params.id);
  const article = updateLike(id);
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json({ id: article.id, likes: article.likes });
});

// POST /api/news/:id/bookmark
router.post("/news/:id/bookmark", (req, res) => {
  const id = parseInt(req.params.id);
  const article = toggleBookmark(id);
  if (!article) {
    res.status(404).json({ error: "Article not found" });
    return;
  }
  res.json({ id: article.id, isBookmarked: article.isBookmarked });
});

// GET /api/categories
router.get("/categories", (_req, res) => {
  const cats = Array.from(new Set(getArticles().map((a) => a.category)));
  res.json({ categories: ["All", ...cats] });
});

// GET /api/status
router.get("/status", (_req, res) => {
  res.json({ isLive: getIsLive(), articleCount: getArticles().length });
});

// POST /api/refresh — trigger an immediate curation run
// Optional body: { "windowStart": "ISO string", "publishToday": true }
// windowStart: earliest RSS pub date to include (defaults to last 25h)
// publishToday: stamp all new articles with today's date (use when pulling a wider window)
router.post("/refresh", (req, res) => {
  const { windowStart, windowEnd, publishToday } = req.body as {
    windowStart?: string;
    windowEnd?: string;
    publishToday?: boolean;
  };
  const wsDate = windowStart ? new Date(windowStart) : undefined;
  const weDate = windowEnd ? new Date(windowEnd) : undefined;
  triggerRefresh(wsDate, publishToday === true, weDate);
  res.json({ ok: true, message: "Curation refresh triggered" });
});

// POST /api/shortlist — fetch + rank today's candidates, return numbered list (no Claude)
// Optional body: { "windowStart": "ISO string", "windowEnd": "ISO string", "feeds": [[url, name], ...] }
router.post("/shortlist", (req, res) => {
  const { windowStart, windowEnd, feeds } = req.body as {
    windowStart?: string;
    windowEnd?: string;
    feeds?: [string, string][];
  };
  const wsDate = windowStart ? new Date(windowStart) : undefined;
  const weDate = windowEnd   ? new Date(windowEnd)   : undefined;
  triggerShortlist(wsDate, weDate, Array.isArray(feeds) ? feeds : undefined)
    .then((candidates) => res.json({ ok: true, count: candidates.length, candidates }))
    .catch((err: Error) => res.status(500).json({ ok: false, error: err.message }));
});

// POST /api/publish — enrich and publish user-selected shortlist indices
// Body: { "indices": [3, 7, 12, 19] }
router.post("/publish", (req, res) => {
  const { indices } = req.body as { indices?: number[] };
  if (!Array.isArray(indices) || indices.length === 0) {
    res.status(400).json({ ok: false, error: "Provide a non-empty 'indices' array" });
    return;
  }
  publishSelected(indices)
    .then((added) => res.json({ ok: true, added, message: `${added} articles published to the feed` }))
    .catch((err: Error) => res.status(500).json({ ok: false, error: err.message }));
});

// DELETE /api/news — remove articles by ID
// Body: { "ids": [1, 4] }
router.delete("/news", (req, res) => {
  const { ids } = req.body as { ids?: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ ok: false, error: "Provide a non-empty 'ids' array" });
    return;
  }
  const removed = deleteArticles(ids);
  res.json({ ok: true, removed, message: `${removed} articles removed from the feed` });
});

// GET /api/audit — return today's (or a given date's) curation audit
// Query params:
//   date=YYYY-MM-DD   (default: today)
//   stage=rejected_by_claude|ranked_out|deduplicated|selected   (default: all non-selected)
router.get("/audit", (req, res) => {
  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
  const stageFilter = req.query.stage as string | undefined;

  // Uncurated data lives in local files only
  const tmpPath = `/tmp/popcorn-audit-${date}.json`;
  const committedPath = `${process.cwd()}/data/uncurated/uncurated-${date}.json`;
  const auditPath = fs.existsSync(tmpPath) ? tmpPath : committedPath;
  if (!fs.existsSync(auditPath)) {
    res.status(404).json({ ok: false, error: `No audit data found for ${date}` });
    return;
  }
  try {
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf-8"));
    audit.source = "local-file";
    if (stageFilter) {
      audit.articles = audit.articles.filter((a: any) => a.stage === stageFilter);
    } else {
      audit.articles = audit.articles.filter((a: any) => a.stage !== "selected");
    }
    res.json(audit);
  } catch {
    res.status(500).json({ ok: false, error: "Failed to read audit file" });
  }
});

// POST /api/publish-raw — reset feed and enrich/publish raw article items directly
// Body: { "reset": true, "publishToday": true, "items": [{ title, link, description, pubDate, source, imageUrl? }] }
router.post("/publish-raw", (req, res) => {
  const { items, reset, publishToday } = req.body as { items?: any[]; reset?: boolean; publishToday?: boolean };
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ ok: false, error: "Provide a non-empty 'items' array" });
    return;
  }
  publishRawItems(items, reset === true, publishToday === true)
    .then((added) => res.json({ ok: true, added, message: `${added} articles published to the feed` }))
    .catch((err: Error) => res.status(500).json({ ok: false, error: err.message }));
});

// PATCH /api/news/:id/image — editorial image override
// Body: { "imageUrl": "https://..." }
router.patch("/news/:id/image", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ ok: false, error: "Invalid article id" });
    return;
  }
  const { imageUrl } = req.body as { imageUrl?: string };
  if (!imageUrl || !imageUrl.startsWith("http")) {
    res.status(400).json({ ok: false, error: "Provide a valid 'imageUrl' string starting with http" });
    return;
  }
  try {
    const updated = await updateArticleImageById(id, imageUrl);
    if (!updated) {
      res.status(404).json({ ok: false, error: `Article ${id} not found` });
      return;
    }
    res.json({ ok: true, id: updated.id, imageUrl: updated.imageUrl, imageWidth: updated.imageWidth, imageHeight: updated.imageHeight });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// POST /api/news/backfill-focal-points — detect focal points + safe boxes for
// any article in TODAY's feed that doesn't already have them. Safe to call
// repeatedly. Pass ?force=1 to re-detect even articles that already have
// values (useful after a prompt change).
router.post("/news/backfill-focal-points", async (req, res) => {
  try {
    const force = req.query.force === "1" || req.query.force === "true";
    const result = await backfillFocalPointsForToday({ force });
    res.json({ ok: true, force, ...result });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// POST /api/news/:id/detect-focal — run focal point detection on a specific
// article's current image. Useful for manually-updated images that skipped
// the normal pipeline.
router.post("/news/:id/detect-focal", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "Invalid article ID" });
  try {
    const { data: row, error } = await supabase
      .from("articles")
      .select("id, title, summary, category, image_url, image_width, image_height")
      .eq("id", id)
      .single();
    if (error || !row) return res.status(404).json({ ok: false, error: "Article not found" });
    if (!row.image_url) return res.status(400).json({ ok: false, error: "No image URL" });

    // Detect focal point
    const focal = await detectImageFocalPoint(row.image_url, {
      title: row.title,
      summary: row.summary,
      category: row.category,
    });

    // Fetch dimensions if missing
    let width = row.image_width;
    let height = row.image_height;
    if (!width || !height) {
      const dims = await fetchImageDimensions(row.image_url);
      if (dims) { width = dims.width; height = dims.height; }
    }

    if (!focal) return res.json({ ok: true, focal: null, message: "Detection returned null" });

    // Update Supabase
    const updates: Record<string, unknown> = {
      image_focal_x: focal.x,
      image_focal_y: focal.y,
      image_safe_w: focal.safeW,
      image_safe_h: focal.safeH,
    };
    if (width && height) {
      updates.image_width = width;
      updates.image_height = height;
    }
    const { error: upErr } = await supabase.from("articles").update(updates).eq("id", id);
    if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

    res.json({
      ok: true,
      id,
      title: row.title,
      focal: { x: focal.x, y: focal.y, safeW: focal.safeW, safeH: focal.safeH },
      dimensions: { width, height },
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// POST /api/reprocess — re-run image selection + content rewriting on existing
// prod articles. Uses the latest scoring/quality/prompt logic without re-fetching RSS.
// Body: { feedDate?: "2026-04-12", images?: boolean, content?: boolean }
router.post("/reprocess", async (req, res) => {
  const {
    feedDate = new Date().toISOString().slice(0, 10),
    images = true,
    content = true,
  } = req.body as { feedDate?: string; images?: boolean; content?: boolean };

  console.log(`[reprocess] Starting reprocessing for ${feedDate} (images=${images}, content=${content})`);

  // 1. Load articles from Supabase
  const { data: rows, error: selErr } = await supabase
    .from("articles")
    .select("*")
    .eq("feed_date", feedDate)
    .eq("stage", "prod")
    .order("id", { ascending: true });

  if (selErr || !rows?.length) {
    res.status(400).json({ ok: false, error: selErr?.message ?? "No articles found" });
    return;
  }

  // Try to find original links from uncurated_articles
  const linkMap = new Map<string, string>();
  const { data: uncurated } = await supabase
    .from("uncurated_articles")
    .select("title, link")
    .eq("feed_date", feedDate);
  for (const u of uncurated ?? []) {
    if (u.link) linkMap.set(u.title as string, u.link as string);
  }

  console.log(`[reprocess] Found ${rows.length} articles, ${linkMap.size} original links`);
  res.json({ ok: true, message: `Reprocessing ${rows.length} articles in background`, count: rows.length });

  // 2. Process in background
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const callClaude = (prompt: string, maxTokens: number): Promise<string> =>
    new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const apiReq = https.request(
        {
          hostname: "api.anthropic.com",
          path: "/v1/messages",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_KEY!,
            "anthropic-version": "2023-06-01",
          },
        },
        (apiRes) => {
          let data = "";
          apiRes.on("data", (chunk: Buffer) => (data += chunk));
          apiRes.on("end", () => {
            try {
              const json = JSON.parse(data);
              resolve(json?.content?.[0]?.text ?? "");
            } catch {
              reject(new Error(`Claude parse error: ${data.slice(0, 200)}`));
            }
          });
        }
      );
      apiReq.on("error", reject);
      apiReq.write(body);
      apiReq.end();
    });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tag = String(row.tag ?? "FEATURE");
    const title = String(row.title ?? "");
    const articleUrl = linkMap.get(title) ?? "";
    console.log(`\n[reprocess ${i + 1}/${rows.length}] ${title.slice(0, 60)} (${tag})`);

    const updates: Record<string, unknown> = {};

    // ── Image reprocessing ──────────────────────────────────────────────
    if (images) {
      try {
        const article: EnrichedArticle = {
          id: Number(row.id),
          title,
          summary: String(row.summary ?? ""),
          content: String(row.content ?? ""),
          category: String(row.category ?? "Internet"),
          source: String(row.source ?? ""),
          readTimeMinutes: Number(row.read_time_minutes ?? 3),
          publishedAt: String(row.published_at ?? ""),
          likes: Number(row.likes ?? 1000),
          isBookmarked: false,
          gradientStart: String(row.gradient_start ?? ""),
          gradientEnd: String(row.gradient_end ?? ""),
          tag,
          imageUrl: row.image_url ? String(row.image_url) : null,
          imageWidth: row.image_width != null ? Number(row.image_width) : null,
          imageHeight: row.image_height != null ? Number(row.image_height) : null,
          keyPoints: Array.isArray(row.key_points) ? row.key_points as string[] : [],
          signalScore: row.signal_score != null ? Number(row.signal_score) : null,
          wikiSearchQuery: row.wiki_search_query ? String(row.wiki_search_query) : undefined,
        };

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
          console.log(`  [img] CHANGED: ${img.debug?.winnerSource} (${img.width}×${img.height}) [${img.debug?.intent}, ${img.debug?.top3}]`);
        } else {
          console.log(`  [img] unchanged: ${img.debug?.winnerSource} (${img.debug?.top3})`);
        }
      } catch (e) {
        console.error(`  [img] error: ${(e as Error).message}`);
      }
    }

    // ── Content rewriting ───────────────────────────────────────────────
    if (content && ANTHROPIC_KEY) {
      const depthTag = ["BREAKING", "RELEASE"].includes(tag) ? "short" : "deep";
      const paraCount = depthTag === "short" ? "3 short paragraphs" : "4 to 5 short paragraphs with analysis and context";

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
          const paragraphs = newContent.split(/\n\n+/).filter((p: string) => p.trim().length > 0);
          updates.content = paragraphs.join("\n\n");
          console.log(`  [content] rewritten: ${paragraphs.length} paragraphs, ${(updates.content as string).length} chars`);
        } else {
          console.log(`  [content] too short, keeping original`);
        }
      } catch (e) {
        console.error(`  [content] error: ${(e as Error).message}`);
      }
    }

    // ── Update Supabase ─────────────────────────────────────────────────
    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from("articles")
        .update(updates)
        .eq("id", row.id);
      if (upErr) {
        console.error(`  [db] update error: ${upErr.message}`);
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
          if (retryErr) console.error(`  [db] retry error: ${retryErr.message}`);
          else console.log(`  [db] updated (without focal columns)`);
        }
      } else {
        console.log(`  [db] updated: ${Object.keys(updates).join(", ")}`);
      }
    }
  }

  console.log(`\n[reprocess] ✅ Complete — ${rows.length} articles reprocessed\n`);
});

export default router;
