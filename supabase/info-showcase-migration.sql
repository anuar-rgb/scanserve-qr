-- Info Showcase: dynamic info cards managed from admin panel
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS info_showcases (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid        NOT NULL,
  title          jsonb       NOT NULL DEFAULT '{"en":"","ru":"","kz":""}',
  emoji          text        NOT NULL DEFAULT '✨',
  order_index    integer     NOT NULL DEFAULT 0,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz          DEFAULT now()
);

ALTER TABLE info_showcases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "info_showcases_anon_all"
  ON info_showcases FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_info_showcases_restaurant
  ON info_showcases (restaurant_id);
