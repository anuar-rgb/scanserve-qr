-- Run in: Supabase Dashboard → SQL Editor → New query
-- Adds product_id to modifiers for per-dish binding

ALTER TABLE modifiers
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;

-- Logic:
--   product_id IS NOT NULL  → modifier shown only for that specific dish
--   product_id IS NULL, category_id IS NOT NULL → modifier shown for all dishes in that category
--   product_id IS NULL, category_id IS NULL      → modifier shown for all dishes (any category)
