import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { articlesTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  GetNewsArticlesQueryParams,
  GetNewsArticleByIdParams,
  LikeNewsArticleParams,
  BookmarkNewsArticleParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/news", async (req, res) => {
  try {
    const query = GetNewsArticlesQueryParams.parse({
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      category: req.query.category,
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    let articles;
    if (query.category && query.category !== "All") {
      articles = await db
        .select()
        .from(articlesTable)
        .where(eq(articlesTable.category, query.category))
        .orderBy(desc(articlesTable.publishedAt))
        .limit(limit + 1)
        .offset(offset);
    } else {
      articles = await db
        .select()
        .from(articlesTable)
        .orderBy(desc(articlesTable.publishedAt))
        .limit(limit + 1)
        .offset(offset);
    }

    const hasMore = articles.length > limit;
    if (hasMore) articles.pop();

    const total = articles.length + offset + (hasMore ? 1 : 0);

    res.json({
      articles,
      total,
      page,
      limit,
      hasMore,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching news articles");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/news/:id", async (req, res) => {
  try {
    const params = GetNewsArticleByIdParams.parse({ id: Number(req.params.id) });
    const [article] = await db
      .select()
      .from(articlesTable)
      .where(eq(articlesTable.id, params.id));

    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    res.json(article);
  } catch (err) {
    req.log.error({ err }, "Error fetching article");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/news/:id/like", async (req, res) => {
  try {
    const params = LikeNewsArticleParams.parse({ id: Number(req.params.id) });
    const [article] = await db
      .select()
      .from(articlesTable)
      .where(eq(articlesTable.id, params.id));

    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    const [updated] = await db
      .update(articlesTable)
      .set({ likes: article.likes + 1 })
      .where(eq(articlesTable.id, params.id))
      .returning({ id: articlesTable.id, likes: articlesTable.likes });

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error liking article");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/news/:id/bookmark", async (req, res) => {
  try {
    const params = BookmarkNewsArticleParams.parse({ id: Number(req.params.id) });
    const [article] = await db
      .select()
      .from(articlesTable)
      .where(eq(articlesTable.id, params.id));

    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    const [updated] = await db
      .update(articlesTable)
      .set({ isBookmarked: !article.isBookmarked })
      .where(eq(articlesTable.id, params.id))
      .returning({ id: articlesTable.id, isBookmarked: articlesTable.isBookmarked });

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error bookmarking article");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/categories", async (_req, res) => {
  res.json({
    categories: ["All", "Models", "Research", "Industry", "Policy", "Tools"],
  });
});

export default router;
