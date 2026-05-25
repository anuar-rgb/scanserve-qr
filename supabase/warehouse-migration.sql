-- Warehouse / Ingredient management
-- Run in Supabase SQL Editor

-- 1. Ingredients (складские позиции)
CREATE TABLE IF NOT EXISTS ingredients (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id   uuid          NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT          NOT NULL,
  unit            TEXT          NOT NULL DEFAULT 'kg', -- 'kg' | 'liter' | 'pcs'
  current_stock   NUMERIC       NOT NULL DEFAULT 0,
  purchase_price  NUMERIC       NOT NULL DEFAULT 0,   -- price per unit (kg/liter/pcs)
  created_at      timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingredients_restaurant_id_idx ON ingredients(restaurant_id);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON ingredients;
CREATE POLICY "allow_all" ON ingredients FOR ALL USING (true) WITH CHECK (true);

-- 2. Recipe items / калькуляция (технологическая карта)
CREATE TABLE IF NOT EXISTS recipe_items (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id      uuid          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id   uuid          NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  weight_gross    NUMERIC       NOT NULL DEFAULT 0,  -- grams / ml / pcs
  weight_net      NUMERIC       NOT NULL DEFAULT 0,
  created_at      timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipe_items_product_id_idx ON recipe_items(product_id);

ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON recipe_items;
CREATE POLICY "allow_all" ON recipe_items FOR ALL USING (true) WITH CHECK (true);
