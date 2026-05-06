-- ── Orders table (create if missing) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  restaurant_id     TEXT        NOT NULL,
  table_number      TEXT,
  items_json        JSONB       NOT NULL DEFAULT '[]',
  total_price       INTEGER     NOT NULL DEFAULT 0,
  status            TEXT        NOT NULL DEFAULT 'pending',
  type              TEXT        NOT NULL DEFAULT 'dine-in',
  order_type        TEXT        DEFAULT 'asap',
  preorder_date     DATE,
  preorder_time     TIME,
  customer_comments TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Add preorder columns to existing orders table ─────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type        TEXT    DEFAULT 'asap';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_date     DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_time     TIME;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_comments TEXT;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (guests placing orders)
DROP POLICY IF EXISTS "anon insert orders" ON orders;
CREATE POLICY "anon insert orders"
  ON orders FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anonymous selects (for order history on client)
DROP POLICY IF EXISTS "anon select orders" ON orders;
CREATE POLICY "anon select orders"
  ON orders FOR SELECT TO anon
  USING (true);

-- ── Index for faster restaurant queries ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS orders_restaurant_id_created_at
  ON orders (restaurant_id, created_at DESC);
