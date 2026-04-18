-- Add source_image_url so we can backfill / re-process article images at
-- a higher quality target without re-running Claude enrichment.
-- Populated at publish time with the third-party URL the image was
-- fetched from before it was resized and uploaded to Supabase Storage.

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS source_image_url TEXT;
