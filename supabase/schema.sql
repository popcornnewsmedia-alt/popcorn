-- ─────────────────────────────────────────────────────────────────────────────
-- Popcorn — Supabase Schema
-- Run this once in the Supabase SQL editor for the popcorn project.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Published articles ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id              BIGSERIAL PRIMARY KEY,
  feed_date       DATE        NOT NULL,
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
  key_points      JSONB       DEFAULT '[]',
  signal_score    FLOAT,
  wiki_search_query TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

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
