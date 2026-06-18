-- ─────────────────────────────────────────────────────────────────────────────
-- Popcorn — User likes (per-user article likes)
-- Run this once in the Supabase SQL editor.
--
-- Mirrors `saved_articles`: a row here = "this user has liked this article".
-- Replaces the old client-only `localLiked` useState which lived in component
-- state (and therefore never synced between the feed, the article reader, or
-- across devices). Deleting the user (auth.users CASCADE) or the article
-- (articles CASCADE) removes the like automatically.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_likes (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id BIGINT      NOT NULL REFERENCES articles(id)   ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, article_id)
);

-- Newest-liked-first listing for the Likes tab.
CREATE INDEX IF NOT EXISTS user_likes_user_created_idx
  ON user_likes (user_id, created_at DESC);

ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;

-- Users can only see / modify their own likes. Anonymous callers get nothing.
DROP POLICY IF EXISTS "user_likes_select_own" ON user_likes;
CREATE POLICY "user_likes_select_own"
  ON user_likes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_likes_insert_own" ON user_likes;
CREATE POLICY "user_likes_insert_own"
  ON user_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_likes_delete_own" ON user_likes;
CREATE POLICY "user_likes_delete_own"
  ON user_likes FOR DELETE USING (auth.uid() = user_id);
