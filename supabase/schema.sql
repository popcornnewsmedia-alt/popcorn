-- ─────────────────────────────────────────────────────────────────────────────
-- Popcorn — Supabase Schema
-- Run this once in the Supabase SQL editor for the popcorn project.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Published articles ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id              BIGSERIAL PRIMARY KEY,
  feed_date       DATE        NOT NULL,
  stage           TEXT        NOT NULL DEFAULT 'dev',
  title           TEXT        NOT NULL,
  summary         TEXT,
  content         TEXT,
  category        TEXT,
  source          TEXT,
  read_time_minutes INT        DEFAULT 3,
  published_at    TIMESTAMPTZ NOT NULL,
  likes           INT         DEFAULT 1000,
  gradient_start  TEXT,
  gradient_end    TEXT,
  tag             TEXT        DEFAULT 'FEATURE',
  image_url       TEXT,
  image_width     INT,
  image_height    INT,
  image_focal_x   float8,
  image_focal_y   float8,
  image_safe_w    float8,
  image_safe_h    float8,
  key_points      JSONB       DEFAULT '[]',
  signal_score    FLOAT,
  impact          TEXT,
  wiki_search_query TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Migration: add focal point + impact columns if upgrading an existing DB ───
-- Run these if the table already exists without these columns:
--   ALTER TABLE articles
--     ADD COLUMN IF NOT EXISTS image_focal_x   float8,
--     ADD COLUMN IF NOT EXISTS image_focal_y   float8,
--     ADD COLUMN IF NOT EXISTS image_safe_w    float8,
--     ADD COLUMN IF NOT EXISTS image_safe_h    float8,
--     ADD COLUMN IF NOT EXISTS impact          TEXT;

CREATE INDEX IF NOT EXISTS articles_feed_date_idx    ON articles (feed_date DESC);
CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles (published_at DESC);

-- ── Uncurated / audit articles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uncurated_articles (
  id          BIGSERIAL PRIMARY KEY,
  feed_date   DATE        NOT NULL,
  title       TEXT        NOT NULL,
  source      TEXT,
  pub_date    TEXT,
  link        TEXT,
  dedup_rank  INT,
  dedup_score FLOAT,
  stage       TEXT        NOT NULL,   -- selected | rejected_by_claude | ranked_out | deduplicated
  reason      TEXT,
  raw_item    JSONB,
  fetched_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS uncurated_feed_date_idx ON uncurated_articles (feed_date DESC);
CREATE INDEX IF NOT EXISTS uncurated_stage_idx     ON uncurated_articles (stage);

-- ── Comments (two-level: top-level + replies) ────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id              BIGSERIAL PRIMARY KEY,
  article_id      BIGINT      NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  parent_id       BIGINT      REFERENCES comments(id) ON DELETE CASCADE,
  author_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name     TEXT        NOT NULL,
  author_initials TEXT        NOT NULL,
  body            TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  upvotes         INT         NOT NULL DEFAULT 0,
  downvotes       INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comments_article_created_idx ON comments (article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_parent_idx          ON comments (parent_id);
CREATE INDEX IF NOT EXISTS comments_author_idx          ON comments (author_id);

-- Enforce max depth = 2 (a reply cannot itself be replied to)
CREATE OR REPLACE FUNCTION enforce_two_level_threading()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent_parent BIGINT;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT parent_id INTO parent_parent FROM comments WHERE id = NEW.parent_id;
    IF parent_parent IS NOT NULL THEN
      RAISE EXCEPTION 'Nested replies not allowed';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_two_level ON comments;
CREATE TRIGGER trg_enforce_two_level
BEFORE INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION enforce_two_level_threading();

-- ── Comment votes (one row per user+comment) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS comment_votes (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id BIGINT      NOT NULL REFERENCES comments(id)   ON DELETE CASCADE,
  direction  SMALLINT    NOT NULL CHECK (direction IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);
CREATE INDEX IF NOT EXISTS comment_votes_comment_idx ON comment_votes (comment_id);

-- ── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id                BIGSERIAL PRIMARY KEY,
  recipient_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind              TEXT        NOT NULL DEFAULT 'reply',
  article_id        BIGINT      NOT NULL REFERENCES articles(id)  ON DELETE CASCADE,
  parent_comment_id BIGINT      NOT NULL REFERENCES comments(id)  ON DELETE CASCADE,
  reply_comment_id  BIGINT      NOT NULL REFERENCES comments(id)  ON DELETE CASCADE,
  actor_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_name        TEXT        NOT NULL,
  preview           TEXT        NOT NULL,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx
  ON notifications (recipient_id, read_at, created_at DESC);

-- Auto-create notification on reply insert (skip self-replies)
CREATE OR REPLACE FUNCTION create_reply_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent_author UUID;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT author_id INTO parent_author FROM comments WHERE id = NEW.parent_id;
  IF parent_author IS NULL OR parent_author = NEW.author_id THEN RETURN NEW; END IF;
  INSERT INTO notifications (recipient_id, kind, article_id, parent_comment_id,
    reply_comment_id, actor_id, actor_name, preview)
  VALUES (parent_author, 'reply', NEW.article_id, NEW.parent_id, NEW.id,
    NEW.author_id, NEW.author_name, left(NEW.body, 120));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reply_notification ON comments;
CREATE TRIGGER trg_reply_notification
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION create_reply_notification();

-- Atomic vote cast/change/undo — returns refreshed counts + my_vote
-- NOTE: The RETURNS TABLE output columns (`upvotes`, `downvotes`, `my_vote`)
-- collide with the `comments` table's column names, so every table-column
-- reference on the RIGHT-hand side of an UPDATE ... SET ... must be
-- explicitly qualified with the table name (e.g. `comments.upvotes`).
-- Otherwise PL/pgSQL raises `column reference "upvotes" is ambiguous`.
CREATE OR REPLACE FUNCTION cast_vote(p_comment_id BIGINT, p_direction SMALLINT)
RETURNS TABLE (upvotes INT, downvotes INT, my_vote SMALLINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing SMALLINT; uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF p_direction NOT IN (-1, 0, 1) THEN RAISE EXCEPTION 'Bad direction'; END IF;
  SELECT direction INTO existing FROM comment_votes WHERE user_id = uid AND comment_id = p_comment_id;
  IF existing IS NOT NULL THEN
    UPDATE comments SET
      upvotes   = comments.upvotes   - CASE WHEN existing =  1 THEN 1 ELSE 0 END,
      downvotes = comments.downvotes - CASE WHEN existing = -1 THEN 1 ELSE 0 END
    WHERE id = p_comment_id;
    DELETE FROM comment_votes WHERE user_id = uid AND comment_id = p_comment_id;
  END IF;
  IF p_direction <> 0 AND (existing IS NULL OR existing <> p_direction) THEN
    INSERT INTO comment_votes (user_id, comment_id, direction) VALUES (uid, p_comment_id, p_direction);
    UPDATE comments SET
      upvotes   = comments.upvotes   + CASE WHEN p_direction =  1 THEN 1 ELSE 0 END,
      downvotes = comments.downvotes + CASE WHEN p_direction = -1 THEN 1 ELSE 0 END
    WHERE id = p_comment_id;
  END IF;
  RETURN QUERY
    SELECT c.upvotes, c.downvotes,
      COALESCE((SELECT direction FROM comment_votes
                 WHERE user_id = uid AND comment_id = p_comment_id), 0::SMALLINT)
    FROM comments c WHERE c.id = p_comment_id;
END $$;

-- Reply-to-reply mention notification.
-- The INSERT trigger already notifies the TOP-LEVEL parent's author. When a
-- user replies to a sibling reply (via @mention in the composer), the sibling
-- reply's author also needs a notification. Clients can't INSERT into
-- `notifications` directly (no RLS insert policy) so this RPC is the only
-- path. Server-side validation prevents spam:
--   • Caller must be authenticated.
--   • Caller must be the author of the reply being attributed (`p_reply_comment_id`).
--   • Recipient must have previously commented on the same article
--     (prevents random-user notification spam).
--   • Skip if recipient == caller (no self-notify).
--   • Skip if recipient already got a notification from the INSERT trigger
--     (i.e. they're the top-level parent's author).
CREATE OR REPLACE FUNCTION notify_mention(p_recipient_id UUID, p_reply_comment_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  r RECORD;
  top_parent_author UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  SELECT article_id, parent_id, author_id, author_name, body
    INTO r FROM comments WHERE id = p_reply_comment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comment not found'; END IF;
  IF r.author_id <> uid THEN RAISE EXCEPTION 'Caller is not comment author'; END IF;
  IF p_recipient_id = uid THEN RETURN; END IF;
  IF r.parent_id IS NOT NULL THEN
    SELECT author_id INTO top_parent_author FROM comments WHERE id = r.parent_id;
    IF top_parent_author = p_recipient_id THEN RETURN; END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM comments
    WHERE article_id = r.article_id AND author_id = p_recipient_id
  ) THEN
    RAISE EXCEPTION 'Recipient has not participated in this thread';
  END IF;
  INSERT INTO notifications (recipient_id, kind, article_id, parent_comment_id,
    reply_comment_id, actor_id, actor_name, preview)
  VALUES (p_recipient_id, 'reply', r.article_id,
    COALESCE(r.parent_id, p_reply_comment_id),
    p_reply_comment_id, uid, r.author_name, left(r.body, 120));
END $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comments_read   ON comments;
DROP POLICY IF EXISTS comments_insert ON comments;
DROP POLICY IF EXISTS comments_delete ON comments;
CREATE POLICY comments_read   ON comments FOR SELECT USING (true);
CREATE POLICY comments_insert ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY comments_delete ON comments FOR DELETE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS votes_read   ON comment_votes;
DROP POLICY IF EXISTS votes_insert ON comment_votes;
DROP POLICY IF EXISTS votes_delete ON comment_votes;
CREATE POLICY votes_read   ON comment_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY votes_insert ON comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY votes_delete ON comment_votes FOR DELETE USING (auth.uid() = user_id);

-- Notifications: recipient-only; NO insert policy (trigger is the only insert path)
DROP POLICY IF EXISTS notif_read   ON notifications;
DROP POLICY IF EXISTS notif_update ON notifications;
DROP POLICY IF EXISTS notif_delete ON notifications;
CREATE POLICY notif_read   ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY notif_update ON notifications FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY notif_delete ON notifications FOR DELETE USING (auth.uid() = recipient_id);

-- Realtime: add both tables to the publication
-- (Safe to run repeatedly; ALTER PUBLICATION errors if the table is already added,
-- so wrap in a DO block.)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── Profiles (user handles) ──────────────────────────────────────────────────
-- See also supabase/migrations/20260417_add_profiles.sql for the incremental
-- migration. Mirrored here so schema.sql stays the canonical reference.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS profiles (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   CITEXT      NOT NULL UNIQUE
               CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles (username);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"  ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"  ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION username_available(candidate TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT candidate ~ '^[a-z0-9_]{3,20}$'
    AND candidate NOT IN (
      'admin','popcorn','root','api','support','system','null','undefined',
      'moderator','staff','help','about','terms','privacy','login','signup'
    )
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE username = candidate::citext);
$$;

GRANT EXECUTE ON FUNCTION username_available(TEXT) TO anon, authenticated;
