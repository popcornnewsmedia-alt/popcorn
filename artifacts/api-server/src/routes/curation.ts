/**
 * Curation API — streamlined endpoints for manual editorial curation.
 *
 * POST   /api/curation/add          — add articles from uncurated pool or raw data (→ prod)
 * DELETE /api/curation/remove       — remove articles by Supabase ID
 * POST   /api/curation/promote      — promote all dev articles for a date to prod
 * POST   /api/curation/reset-image  — re-select image for one article
 * PATCH  /api/curation/set-image    — set a specific image URL (through Sharp pipeline)
 * GET    /api/curation/feed         — list feed with stable Supabase IDs
 * GET    /api/curation/candidates   — list shortlist candidates for a date (from Supabase or local file)
 */

import fs from "node:fs";
import path from "node:path";
import { Router, type IRouter } from "express";
import {
  loadUncuratedArticles,
  uncuratedToRawItem,
  resolveArticleBySupabaseId,
} from "../lib/curation-helpers.js";
import { enrichSelectedItems, selectBestImageForRerun, detectImageFocalPoint, type EnrichedArticle } from "../lib/rss-enricher.js";
import { mergeFeed, saveCommittedFeed, saveCommittedFeedAsProd, removeArticlesBySupabaseId, updateArticleImageInMemory, updateArticleTitleInMemory, promoteToProduction, backfillFocalPointsForToday, lookupPreservedImagesByLinks } from "../lib/curated-store.js";
import { markLive } from "../lib/article-store.js";
import { processAndUploadImage } from "../lib/image-processor.js";
import { supabase } from "../lib/supabase-client.js";
import https from "node:https";

const router: IRouter = Router();

// ─── POST /api/curation/add ──────────────────────────────────────────────────

router.post("/curation/add", async (req, res) => {
  try {
    const {
      indices,
      raw,
      feedDate = new Date().toISOString().slice(0, 10),
    } = req.body as {
      indices?: number[];
      raw?: { title: string; source: string; link: string; description?: string; imageUrl?: string }[];
      feedDate?: string;
    };

    let rawItems: { title: string; description: string; link: string; pubDate: string; source: string; imageUrl?: string }[];

    if (Array.isArray(indices) && indices.length > 0) {
      // Variant A: by sequence number from uncurated file (falls back to Supabase)
      const uncurated = await loadUncuratedArticles(feedDate);
      if (uncurated.length === 0) {
        res.status(404).json({ ok: false, error: `No uncurated candidates found for ${feedDate}` });
        return;
      }

      const matched = indices
        .filter((i) => i >= 1 && i <= uncurated.length)
        .map((i) => uncurated[i - 1]);

      if (matched.length === 0) {
        res.status(400).json({
          ok: false,
          error: `No valid indices. Range: 1–${uncurated.length}`,
        });
        return;
      }

      console.log(`[curation/add] Resolving ${matched.length} articles from uncurated pool...`);
      rawItems = await Promise.all(matched.map(uncuratedToRawItem));
    } else if (Array.isArray(raw) && raw.length > 0) {
      // Variant B: direct raw article data
      rawItems = raw.map((a) => ({
        title: a.title,
        description: a.description ?? "",
        link: a.link,
        pubDate: new Date().toISOString(),
        source: a.source,
        imageUrl: a.imageUrl,
      }));
    } else {
      res.status(400).json({
        ok: false,
        error: 'Provide either "indices" (array of sequence numbers) or "raw" (array of article objects)',
      });
      return;
    }

    // Look up any previously-published articles by link so we can preserve
    // their original image data instead of re-running image selection (which
    // can return a different/worse image on a second run).
    const preservedImages = await lookupPreservedImagesByLinks(
      rawItems.map((r) => r.link).filter((l): l is string => !!l),
    );

    console.log(`[curation/add] Enriching ${rawItems.length} articles...`);
    const enriched = await enrichSelectedItems(rawItems, true);

    // Restore the original image for any article whose link was previously
    // published. This overrides the freshly-selected image — so a re-add
    // without an explicit image-change request keeps the original.
    let preservedCount = 0;
    for (const article of enriched) {
      if (!article.link) continue;
      const preserved = preservedImages.get(article.link);
      if (!preserved || !preserved.imageUrl) continue;
      article.imageUrl = preserved.imageUrl;
      article.sourceImageUrl = preserved.sourceImageUrl;
      article.imageWidth = preserved.imageWidth;
      article.imageHeight = preserved.imageHeight;
      article.imageFocalX = preserved.imageFocalX;
      article.imageFocalY = preserved.imageFocalY;
      article.imageSafeW = preserved.imageSafeW;
      article.imageSafeH = preserved.imageSafeH;
      article.imageCredit = preserved.imageCredit;
      preservedCount++;
    }
    if (preservedCount > 0) {
      console.log(`[curation/add] Preserved original image for ${preservedCount} re-added article(s).`);
    }

    // Manual curation additions go straight to prod — they're already reviewed.
    const added = await mergeFeed(enriched, { stage: 'prod' });
    saveCommittedFeedAsProd();
    markLive();

    res.json({
      ok: true,
      added,
      articles: enriched.map((a) => ({
        title: a.title,
        category: a.category,
        tag: a.tag,
        imageUrl: a.imageUrl,
      })),
      message: `${added} articles published to the feed`,
    });
  } catch (err) {
    console.error("[curation/add] error:", (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ─── DELETE /api/curation/remove ─────────────────────────────────────────────

router.delete("/curation/remove", async (req, res) => {
  try {
    const { ids } = req.body as { ids?: number[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ ok: false, error: 'Provide "ids" (array of Supabase article IDs)' });
      return;
    }

    const result = await removeArticlesBySupabaseId(ids);
    res.json({
      ok: true,
      removed: result.removed,
      articles: result.articles,
      message: `${result.removed} articles removed from the feed`,
    });
  } catch (err) {
    console.error("[curation/remove] error:", (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ─── POST /api/curation/reset-image ──────────────────────────────────────────

router.post("/curation/reset-image", async (req, res) => {
  try {
    const { id } = req.body as { id?: number };
    if (!id) {
      res.status(400).json({ ok: false, error: 'Provide "id" (Supabase article ID)' });
      return;
    }

    const row = await resolveArticleBySupabaseId(id);
    if (!row) {
      res.status(404).json({ ok: false, error: `Article ${id} not found` });
      return;
    }

    const title = String(row.title ?? "");
    const feedDate = String(row.feed_date ?? new Date().toISOString().slice(0, 10));
    const previousImage = String(row.image_url ?? "");

    // Look up original article link for image selection
    const { data: uncuratedRow } = await supabase
      .from("uncurated_articles")
      .select("link")
      .eq("feed_date", feedDate)
      .ilike("title", `%${title.slice(0, 30)}%`)
      .limit(1)
      .single();
    const articleUrl = uncuratedRow?.link ? String(uncuratedRow.link) : "";

    // Build EnrichedArticle for image selection
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
      tag: String(row.tag ?? "FEATURE"),
      imageUrl: row.image_url ? String(row.image_url) : null,
      imageWidth: row.image_width != null ? Number(row.image_width) : null,
      imageHeight: row.image_height != null ? Number(row.image_height) : null,
      keyPoints: Array.isArray(row.key_points) ? (row.key_points as string[]) : [],
      signalScore: row.signal_score != null ? Number(row.signal_score) : null,
      wikiSearchQuery: row.wiki_search_query ? String(row.wiki_search_query) : undefined,
    };

    console.log(`[curation/reset-image] Re-selecting image for "${title.slice(0, 50)}"...`);
    const img = await selectBestImageForRerun(article, articleUrl, previousImage);

    // Process through Sharp pipeline
    const processed = await processAndUploadImage(img.url, feedDate);
    if (!processed) {
      res.status(500).json({ ok: false, error: "Image processing failed" });
      return;
    }

    // Run focal detection
    const focal = await detectImageFocalPoint(processed.url, { title, summary: article.summary, category: article.category });

    // Update in-memory + Supabase
    await updateArticleImageInMemory(id, {
      imageUrl: processed.url,
      imageWidth: processed.width,
      imageHeight: processed.height,
      imageCredit: processed.credit,
      imageFocalX: focal?.x ?? img.focalX ?? null,
      imageFocalY: focal?.y ?? img.focalY ?? null,
      imageSafeW: focal?.safeW ?? img.safeW ?? null,
      imageSafeH: focal?.safeH ?? img.safeH ?? null,
    });

    res.json({
      ok: true,
      id,
      title,
      previousImage,
      newImage: {
        url: processed.url,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
        credit: processed.credit,
        source: img.debug?.winnerSource,
      },
      focal: focal ?? { x: img.focalX, y: img.focalY, safeW: img.safeW, safeH: img.safeH },
    });
  } catch (err) {
    console.error("[curation/reset-image] error:", (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ─── PATCH /api/curation/set-image ───────────────────────────────────────────

router.patch("/curation/set-image", async (req, res) => {
  try {
    const { id, imageUrl } = req.body as { id?: number; imageUrl?: string };
    if (!id || !imageUrl) {
      res.status(400).json({ ok: false, error: 'Provide "id" (Supabase ID) and "imageUrl"' });
      return;
    }

    const row = await resolveArticleBySupabaseId(id);
    if (!row) {
      res.status(404).json({ ok: false, error: `Article ${id} not found` });
      return;
    }

    const title = String(row.title ?? "");
    const feedDate = String(row.feed_date ?? new Date().toISOString().slice(0, 10));

    console.log(`[curation/set-image] Processing image for "${title.slice(0, 50)}"...`);
    const processed = await processAndUploadImage(imageUrl, feedDate);
    if (!processed) {
      res.status(400).json({ ok: false, error: "Failed to process image URL — check if accessible" });
      return;
    }

    // Run focal detection
    const focal = await detectImageFocalPoint(processed.url, {
      title,
      summary: String(row.summary ?? ""),
      category: String(row.category ?? ""),
    });

    // Update in-memory + Supabase
    await updateArticleImageInMemory(id, {
      imageUrl: processed.url,
      imageWidth: processed.width,
      imageHeight: processed.height,
      imageCredit: processed.credit,
      imageFocalX: focal?.x ?? null,
      imageFocalY: focal?.y ?? null,
      imageSafeW: focal?.safeW ?? null,
      imageSafeH: focal?.safeH ?? null,
    });

    res.json({
      ok: true,
      id,
      title,
      image: {
        url: processed.url,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
        credit: processed.credit,
      },
      focal: focal ?? null,
    });
  } catch (err) {
    console.error("[curation/set-image] error:", (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ─── PATCH /api/curation/set-title ───────────────────────────────────────────

router.patch("/curation/set-title", async (req, res) => {
  try {
    const { id, title } = req.body as { id?: number; title?: string };
    if (!id || !title || !title.trim()) {
      res.status(400).json({ ok: false, error: 'Provide "id" (Supabase ID) and non-empty "title"' });
      return;
    }
    const result = await updateArticleTitleInMemory(id, title.trim());
    if (!result.ok) {
      res.status(500).json({ ok: false, error: "Supabase update failed", previousTitle: result.previousTitle });
      return;
    }
    res.json({ ok: true, id, previousTitle: result.previousTitle, title: title.trim() });
  } catch (err) {
    console.error("[curation/set-title] error:", (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ─── POST /api/curation/promote ──────────────────────────────────────────────

router.post("/curation/promote", async (req, res) => {
  try {
    const { feedDate = new Date().toISOString().slice(0, 10) } = req.body as { feedDate?: string };
    const count = await promoteToProduction(feedDate);
    res.json({
      ok: true,
      promoted: count,
      feedDate,
      message: count > 0
        ? `${count} articles promoted to prod for ${feedDate}`
        : `No dev articles to promote for ${feedDate} (already prod or none exist)`,
    });
  } catch (err) {
    console.error("[curation/promote] error:", (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ─── GET /api/curation/candidates ────────────────────────────────────────────

router.get("/curation/candidates", async (req, res) => {
  try {
    const feedDate = (req.query.feedDate as string) ?? new Date().toISOString().slice(0, 10);
    const format   = (req.query.format  as string) ?? "json";
    const candidates = await loadUncuratedArticles(feedDate);

    if (format !== "txt") {
      res.json({ ok: true, feedDate, count: candidates.length, candidates });
      return;
    }

    // ── Plain-text view for browser review ───────────────────────────────────
    const BORDER = "═".repeat(100);
    const decodeHtml = (s: string) =>
      s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
       .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
       .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

    const selected   = candidates.filter((a) => a.stage === "selected");
    const addable    = candidates.filter((a) => a.stage === "rejected_by_claude" || a.stage === "ranked_out");
    const deduped    = candidates.filter((a) => a.stage === "deduplicated");

    const lines: string[] = [];
    lines.push(BORDER);
    lines.push(`  POPCORN CANDIDATES — ${feedDate}`);
    lines.push(`  ${candidates.length} total   ${selected.length} selected   ${addable.length} available to add   ${deduped.length} grouped as duplicates`);
    lines.push(`  To add: POST /api/curation/add  { "feedDate": "${feedDate}", "indices": [N, N, ...] }`);
    lines.push(BORDER);
    lines.push("");

    lines.push(`── SELECTED BY CLAUDE (${selected.length}) ${"─".repeat(68)}`);
    selected.forEach((a, i) => {
      const score = Math.round(a.dedupScore ?? 0);
      const src   = (a.source ?? "").slice(0, 28).padEnd(28);
      lines.push(`  #${String(i + 1).padEnd(4)} score:${String(score).padEnd(4)} ${src}  ${decodeHtml(a.title)}`);
    });
    lines.push("");

    lines.push(`── AVAILABLE TO ADD — rejected or ranked-out (${addable.length}) ${"─".repeat(40)}`);
    lines.push(`   idx   score  source                        stage                title`);
    lines.push(`   ${"─".repeat(95)}`);
    addable.forEach((a) => {
      const idx   = String(candidates.indexOf(a) + 1).padEnd(5);
      const score = String(Math.round(a.dedupScore ?? 0)).padEnd(6);
      const src   = (a.source ?? "").slice(0, 28).padEnd(28);
      const stage = a.stage === "ranked_out" ? "ranked_out  " : "rejected    ";
      lines.push(`   ${idx} ${score} ${src}  ${stage}  ${decodeHtml(a.title)}`);
      if (a.stage === "rejected_by_claude" && a.reason) {
        lines.push(`${"".padEnd(72)}↳ ${a.reason.slice(0, 80)}`);
      }
    });
    lines.push("");

    if (deduped.length > 0) {
      lines.push(`── GROUPED AS DUPLICATES (${deduped.length}) ${"─".repeat(68)}`);
      deduped.forEach((a) => {
        const src = (a.source ?? "").slice(0, 28).padEnd(28);
        lines.push(`   ${src}  ${decodeHtml(a.title).slice(0, 65)}`);
        if (a.reason) lines.push(`${"".padEnd(32)}↳ ${a.reason.slice(0, 85)}`);
      });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(lines.join("\n"));
  } catch (err) {
    console.error("[curation/candidates] error:", (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ─── GET /api/curation/feed ──────────────────────────────────────────────────

router.get("/curation/feed", async (req, res) => {
  try {
    const feedDate = String(req.query.feedDate ?? new Date().toISOString().slice(0, 10));

    const { data: rows, error } = await supabase
      .from("articles")
      .select("id, title, category, source, tag, image_url, image_width, image_height, feed_date, stage, signal_score")
      .eq("feed_date", feedDate)
      .order("id", { ascending: true });

    if (error) {
      res.status(500).json({ ok: false, error: error.message });
      return;
    }

    res.json({
      ok: true,
      feedDate,
      count: rows?.length ?? 0,
      articles: (rows ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        source: r.source,
        tag: r.tag,
        stage: r.stage,
        score: r.signal_score,
        imageWidth: r.image_width,
        imageHeight: r.image_height,
        imageUrl: r.image_url ? String(r.image_url).slice(0, 100) + "..." : null,
      })),
    });
  } catch (err) {
    console.error("[curation/feed] error:", (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ─── POST /api/curation/batch ─────────────────────────────────────────────────
// Single-call curation: add + remove + focal backfill + image verification.
// Eliminates the multi-round-trip dance of calling add → backfill → verify.

router.post("/curation/batch", async (req, res) => {
  try {
    const {
      add,
      remove,
      feedDate = new Date().toISOString().slice(0, 10),
    } = req.body as {
      add?: {
        indices?: number[];
        raw?: { title: string; source: string; link: string; description?: string; imageUrl?: string }[];
      };
      remove?: number[];
      feedDate?: string;
    };

    const result: {
      added: { count: number; articles: { id?: number; title: string; category: string; tag: string }[] };
      removed: { count: number; articles: { id: number; title: string }[] };
      focal: { scanned: number; updated: number; skipped: number };
      images: { total: number; ok: number; failed: string[] };
    } = {
      added: { count: 0, articles: [] },
      removed: { count: 0, articles: [] },
      focal: { scanned: 0, updated: 0, skipped: 0 },
      images: { total: 0, ok: 0, failed: [] },
    };

    // ── Step 1: Remove articles ──────────────────────────────────────────────
    if (Array.isArray(remove) && remove.length > 0) {
      console.log(`[curation/batch] Removing ${remove.length} articles...`);
      const removeResult = await removeArticlesBySupabaseId(remove);
      result.removed = {
        count: removeResult.removed,
        articles: removeResult.articles.map((a) => ({ id: a.id, title: a.title })),
      };
    }

    // ── Step 2: Add articles ─────────────────────────────────────────────────
    if (add) {
      let rawItems: { title: string; description: string; link: string; pubDate: string; source: string; imageUrl?: string }[] = [];

      if (Array.isArray(add.indices) && add.indices.length > 0) {
        const uncurated = await loadUncuratedArticles(feedDate);
        if (uncurated.length === 0) {
          res.status(404).json({ ok: false, error: `No uncurated candidates found for ${feedDate}` });
          return;
        }
        const matched = add.indices
          .filter((i) => i >= 1 && i <= uncurated.length)
          .map((i) => uncurated[i - 1]);
        if (matched.length === 0) {
          res.status(400).json({ ok: false, error: `No valid indices. Range: 1–${uncurated.length}` });
          return;
        }
        console.log(`[curation/batch] Resolving ${matched.length} articles from uncurated pool...`);
        rawItems = await Promise.all(matched.map(uncuratedToRawItem));
      } else if (Array.isArray(add.raw) && add.raw.length > 0) {
        rawItems = add.raw.map((a) => ({
          title: a.title,
          description: a.description ?? "",
          link: a.link,
          pubDate: new Date().toISOString(),
          source: a.source,
          imageUrl: a.imageUrl,
        }));
      }

      if (rawItems.length > 0) {
        console.log(`[curation/batch] Enriching ${rawItems.length} articles...`);
        const enriched = await enrichSelectedItems(rawItems, true);
        const addedCount = await mergeFeed(enriched, { stage: 'prod' });
        saveCommittedFeedAsProd();
        markLive();
        result.added = {
          count: addedCount,
          articles: enriched.map((a) => ({ title: a.title, category: a.category, tag: a.tag })),
        };
      }
    }

    // ── Step 3: Focal backfill (incremental — only new/missing) ──────────────
    console.log(`[curation/batch] Running incremental focal backfill...`);
    result.focal = await backfillFocalPointsForToday();

    // ── Step 4: Image verification (HEAD requests) ───────────────────────────
    const { data: articles } = await supabase
      .from("articles")
      .select("id, title, image_url")
      .eq("feed_date", feedDate);

    if (articles && articles.length > 0) {
      result.images.total = articles.length;
      const checkImage = (url: string): Promise<boolean> =>
        new Promise((resolve) => {
          try {
            const req = https.request(url, { method: "HEAD", timeout: 8000 }, (resp) => {
              resolve(resp.statusCode === 200);
            });
            req.on("error", () => resolve(false));
            req.on("timeout", () => { req.destroy(); resolve(false); });
            req.end();
          } catch { resolve(false); }
        });

      const checks = await Promise.all(
        articles.map(async (a: any) => {
          if (!a.image_url) return { id: a.id, title: a.title, ok: false };
          const ok = await checkImage(String(a.image_url));
          return { id: a.id, title: a.title, ok };
        })
      );
      result.images.ok = checks.filter((c) => c.ok).length;
      result.images.failed = checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.title}`);
    }

    res.json({ ok: true, feedDate, ...result });
  } catch (err) {
    console.error("[curation/batch] error:", (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ─── POST /api/shortlist/diagnose ────────────────────────────────────────────
// Given keywords, report the disposition of every matching item in today's
// (or a given date's) audit file: raw_fetched, junk_filtered, deduplicated,
// ranked_out, or sent_to_claude. Lets us answer "why was story X missed?" in
// one call instead of grepping uncurated JSON by hand.

router.post("/shortlist/diagnose", (req, res) => {
  try {
    const {
      keywords,
      feedDate = new Date().toISOString().slice(0, 10),
    } = req.body as { keywords?: string[]; feedDate?: string };

    if (!Array.isArray(keywords) || keywords.length === 0) {
      res.status(400).json({ ok: false, error: 'Provide "keywords" (array of strings to match against titles)' });
      return;
    }

    // Look up the audit file — check /tmp first (fresh run), then data/uncurated (committed).
    const tmpPath = `/tmp/popcorn-audit-${feedDate}.json`;
    const committedPath = path.resolve(process.cwd(), "data", "uncurated", `uncurated-${feedDate}.json`);
    const auditPath = fs.existsSync(tmpPath) ? tmpPath : committedPath;

    if (!fs.existsSync(auditPath)) {
      res.status(404).json({ ok: false, error: `No audit file found for ${feedDate}. Expected at ${committedPath} or ${tmpPath}.` });
      return;
    }

    const audit = JSON.parse(fs.readFileSync(auditPath, "utf-8"));
    const articles: any[] = Array.isArray(audit.articles) ? audit.articles : [];

    const stageReason = (stage: string, extra?: Record<string, unknown>): string => {
      switch (stage) {
        case "selected":
          return "Selected for publishing by Claude.";
        case "sent_to_claude":
          return "Made the candidate pool and was shown to Claude, but not selected.";
        case "ranked_out":
          return `In window and clean, but rank too low to make the pool. ${extra?.rank ? `Rank: ${extra.rank}.` : ""}`.trim();
        case "deduplicated":
          return `Merged with a higher-ranked story with similar title. ${extra?.groupedWith ? `Grouped with: "${extra.groupedWith}" (${extra?.groupedWithSource ?? ""}).` : ""}`.trim();
        case "rejected_by_claude":
          return `Claude chose not to publish. ${extra?.reason ? `Reason: ${extra.reason}` : ""}`.trim();
        default:
          return `Stage: ${stage}`;
      }
    };

    const results: Record<string, unknown> = {};
    for (const kw of keywords) {
      const needle = kw.toLowerCase().trim();
      const matches = articles.filter((a) => String(a.title ?? "").toLowerCase().includes(needle));
      results[kw] = {
        found: matches.length,
        items: matches.map((a: any) => ({
          title: a.title,
          source: a.source,
          pubDate: a.pubDate,
          stage: a.stage,
          rank: a.dedupRank ?? null,
          score: a.dedupScore ?? null,
          groupedWith: a.groupedWith ?? null,
          groupedWithSource: a.groupedWithSource ?? null,
          reason: a.reason ?? stageReason(String(a.stage), a),
        })),
      };
      if (matches.length === 0) {
        (results[kw] as any).hint =
          "No matches in audit. Possible causes: (1) no RSS feed covered this keyword, (2) the story was outside the time window for this feedDate, (3) a junk filter pattern stripped it before audit logging, (4) keyword mis-spelt — try shorter fragments.";
      }
    }

    res.json({
      ok: true,
      feedDate,
      auditFile: auditPath,
      totalAuditedArticles: articles.length,
      keywords: results,
    });
  } catch (err) {
    console.error("[shortlist/diagnose] error:", (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
