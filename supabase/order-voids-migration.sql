-- Migration: order_voids table
-- Tracks every item removed from a saved order (anti-fraud / void logging)

CREATE TABLE IF NOT EXISTS order_voids (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id   TEXT        NOT NULL,
  order_id        TEXT        NOT NULL,
  item_name       TEXT        NOT NULL,
  item_price      NUMERIC     NOT NULL,
  quantity        INTEGER     NOT NULL DEFAULT 1,
  reason          TEXT        NOT NULL,        -- 'Ошибка официанта' | 'Брак кухни' | 'Отказ гостя'
  voided_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_by_name  TEXT,
  table_number    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_order_voids_restaurant_created
  ON order_voids (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_voids_order_id
  ON order_voids (order_id);

-- RLS
ALTER TABLE order_voids ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API routes)
CREATE POLICY "Service role full access" ON order_voids
  FOR ALL USING (true) WITH CHECK (true);
