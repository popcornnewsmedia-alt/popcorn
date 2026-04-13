/**
 * Curation API — streamlined endpoints for manual editorial curation.
 *
 * POST   /api/curation/add          — add articles from uncurated pool or raw data
 * DELETE /api/curation/remove       — remove articles by Supabase ID
 * POST   /api/curation/reset-image  — re-select image for one article
 * PATCH  /api/curation/set-image    — set a specific image URL (through Sharp pipeline)
 * GET    /api/curation/feed         — list feed with stable Supabase IDs
 */

import { Router, type IRouter } from "express";
import {
  loadUncuratedArticles,
  uncuratedToRawItem,
  resolveArticleBySupabaseId,
} from "../lib/curation-helpers.js";
import { enrichSelectedItems, selectBestImageForRerun, detectImageFocalPoint, type EnrichedArticle } from "../lib/rss-enricher.js";
import { mergeFeed, saveCommittedFeed, removeArticlesBySupabaseId, updateArticleImageInMemory } from "../lib/curated-store.js";
import { markLive } from "../lib/article-store.js";
import { processAndUploadImage } from "../lib/image-processor.js";
import { supabase } from "../lib/supabase-client.js";

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
      // Variant A: by sequence number from uncurated file
      const uncurated = loadUncuratedArticles(feedDate);
      if (uncurated.length === 0) {
        res.status(404).json({ ok: false, error: `No uncurated file found for ${feedDate}` });
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

    console.log(`[curation/add] Enriching ${rawItems.length} articles...`);
    const enriched = await enrichSelectedItems(rawItems, true);
    const added = mergeFeed(enriched);
    saveCommittedFeed();
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

export default router;
