import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const articlesTable = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  source: text("source").notNull(),
  readTimeMinutes: integer("read_time_minutes").notNull().default(3),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
  likes: integer("likes").notNull().default(0),
  isBookmarked: boolean("is_bookmarked").notNull().default(false),
  gradientStart: text("gradient_start").notNull().default("#2d4a3e"),
  gradientEnd: text("gradient_end").notNull().default("#8fb8a0"),
  tag: text("tag").notNull().default("ANALYSIS"),
});

export const insertArticleSchema = createInsertSchema(articlesTable).omit({ id: true });
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articlesTable.$inferSelect;
