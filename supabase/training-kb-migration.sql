-- Knowledge Base (База знаний) for staff training
-- Replaces the old allergen-filter training view.
-- Run this in your Supabase SQL Editor.

-- 1. Table
CREATE TABLE IF NOT EXISTS training_articles (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid        NOT NULL,
  title          text        NOT NULL DEFAULT '',
  content        text        NOT NULL DEFAULT '',
  links          jsonb       NOT NULL DEFAULT '[]',   -- [{name: text, url: text}]
  images         text[]      NOT NULL DEFAULT '{}',   -- array of public storage URLs
  order_index    integer     NOT NULL DEFAULT 0,
  created_at     timestamptz          DEFAULT now(),
  updated_at     timestamptz          DEFAULT now()
);

ALTER TABLE training_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_articles_anon_all"
  ON training_articles FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_training_articles_restaurant
  ON training_articles (restaurant_id, order_index);

-- 2. Storage bucket for training images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-images',
  'training-images',
  true,
  5242880,
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS for training-images bucket
CREATE POLICY "scanserve_read_training_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'training-images');

CREATE POLICY "scanserve_insert_training_images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'training-images');

CREATE POLICY "scanserve_update_training_images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'training-images');

CREATE POLICY "scanserve_delete_training_images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'training-images');
