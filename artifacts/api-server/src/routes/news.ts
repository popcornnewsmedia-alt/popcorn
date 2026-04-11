import fs from "node:fs";
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
  const { windowStart, publishToday } = req.body as {
    windowStart?: string;
    publishToday?: boolean;
  };
  const wsDate = windowStart ? new Date(windowStart) : undefined;
  triggerRefresh(wsDate, publishToday === true);
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

export default router;
