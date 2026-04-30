-- ============================================================
-- Storefront Migration: product flags + banners table
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT)
-- ============================================================

-- 1. Add is_promo and is_recommended columns to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_promo        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_recommended  boolean NOT NULL DEFAULT false;

-- 2. Create banners table
CREATE TABLE IF NOT EXISTS banners (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  image_url     text,
  title         jsonb       NOT NULL DEFAULT '{"en":"","ru":"","kz":""}',
  subtitle      jsonb,
  link_url      text,
  is_active     boolean     NOT NULL DEFAULT true,
  order_index   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 3. Fast lookup index
CREATE INDEX IF NOT EXISTS banners_restaurant_id_idx ON banners (restaurant_id);

-- 4. Row-Level Security
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scanserve_read_banners_table"   ON banners;
DROP POLICY IF EXISTS "scanserve_insert_banners_table" ON banners;
DROP POLICY IF EXISTS "scanserve_update_banners_table" ON banners;
DROP POLICY IF EXISTS "scanserve_delete_banners_table" ON banners;

CREATE POLICY "scanserve_read_banners_table"
  ON banners FOR SELECT USING (true);

CREATE POLICY "scanserve_insert_banners_table"
  ON banners FOR INSERT WITH CHECK (true);

CREATE POLICY "scanserve_update_banners_table"
  ON banners FOR UPDATE USING (true);

CREATE POLICY "scanserve_delete_banners_table"
  ON banners FOR DELETE USING (true);
