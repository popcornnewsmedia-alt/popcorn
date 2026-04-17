-- ─────────────────────────────────────────────────────────────────────────────
-- Popcorn — Profiles table + username availability RPC
-- Run this once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

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

-- Availability RPC. Anonymous-callable so the signup page can use it pre-auth.
-- Reserved list lives inside SQL so it cannot be bypassed client-side.
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
