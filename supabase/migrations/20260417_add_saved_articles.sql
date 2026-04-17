-- ─────────────────────────────────────────────────────────────────────────────
-- Popcorn — Saved articles (per-user bookmarks)
-- Run this once in the Supabase SQL editor.
--
-- Replaces the old client-only `isBookmarked` which never synced between
-- devices. A row here = "this user has saved this article". Deleting the
-- user (auth.users CASCADE) or the article (articles CASCADE) removes the
-- save automatically.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_articles (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id BIGINT      NOT NULL REFERENCES articles(id)   ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, article_id)
);

-- Newest-saved-first listing for the Saved tab.
CREATE INDEX IF NOT EXISTS saved_articles_user_created_idx
  ON saved_articles (user_id, created_at DESC);

ALTER TABLE saved_articles ENABLE ROW LEVEL SECURITY;

-- Users can only see / modify their own saves. Anonymous callers get nothing.
DROP POLICY IF EXISTS "saved_articles_select_own" ON saved_articles;
CREATE POLICY "saved_articles_select_own"
  ON saved_articles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_articles_insert_own" ON saved_articles;
CREATE POLICY "saved_articles_insert_own"
  ON saved_articles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_articles_delete_own" ON saved_articles;
CREATE POLICY "saved_articles_delete_own"
  ON saved_articles FOR DELETE USING (auth.uid() = user_id);
