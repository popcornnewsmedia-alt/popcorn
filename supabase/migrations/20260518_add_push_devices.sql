-- ─────────────────────────────────────────────────────────────────────────────
-- Popcorn — push_devices + push_deliveries
-- iOS APNs token registry and delivery log.
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_devices (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform     TEXT NOT NULL DEFAULT 'ios',          -- 'ios' for now; 'android' future
  apns_env     TEXT NOT NULL DEFAULT 'production',   -- 'production' | 'development'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_token)
);

CREATE INDEX IF NOT EXISTS push_devices_user_idx  ON push_devices (user_id);
CREATE INDEX IF NOT EXISTS push_devices_token_idx ON push_devices (device_token);

CREATE TABLE IF NOT EXISTS push_deliveries (
  id         BIGSERIAL PRIMARY KEY,
  device_id  BIGINT REFERENCES push_devices(id) ON DELETE SET NULL,
  feed_date  DATE NOT NULL,
  status     TEXT NOT NULL,        -- 'sent' | 'invalid_token' | 'error'
  apns_id    TEXT,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_deliveries_feed_date_idx
  ON push_deliveries (feed_date, created_at DESC);

-- RLS: server-only access via service-role key (which bypasses RLS).
-- No client-side policies needed; we never read these tables from the app.
ALTER TABLE push_devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_deliveries ENABLE ROW LEVEL SECURITY;
