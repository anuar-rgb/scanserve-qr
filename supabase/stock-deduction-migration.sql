-- Stage 2: Automatic stock deduction on order payment
-- Run in Supabase SQL Editor

-- ─── 1. Stock movements log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id   uuid          NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  ingredient_id   uuid          NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  amount          NUMERIC       NOT NULL,           -- negative = deduction, positive = supply
  type            TEXT          NOT NULL,           -- 'sale' | 'waste' | 'supply'
  order_id        uuid          REFERENCES orders(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_restaurant_id_idx   ON stock_movements(restaurant_id);
CREATE INDEX IF NOT EXISTS stock_movements_ingredient_id_idx   ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS stock_movements_order_id_idx        ON stock_movements(order_id);
CREATE INDEX IF NOT EXISTS stock_movements_created_at_idx      ON stock_movements(created_at DESC);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON stock_movements;
CREATE POLICY "allow_all" ON stock_movements FOR ALL USING (true) WITH CHECK (true);


-- ─── 2. RPC: deduct stock on order payment ────────────────────────────────────
--
-- Called from the frontend after order.status is set to 'completed'.
-- Returns: { ok: boolean, warnings: [{ ingredient, stock, unit }], error?: string }
--
-- Unit-aware conversion:
--   recipe_items.weight_gross is always in grams (kg/liter ingredients) or pieces (pcs)
--   ingredients.current_stock is stored in kg / liters / pieces
--   → for kg & liter: deduct weight_gross * qty / 1000
--   → for pcs:        deduct weight_gross * qty
--
-- Idempotent: safe to call twice for the same order.
--
CREATE OR REPLACE FUNCTION deduct_order_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_restaurant_id uuid;
  v_items         jsonb;
  v_item          jsonb;
  v_product_id    uuid;
  v_qty           numeric;
  v_rec           RECORD;
  v_deduction     numeric;
  v_stock_after   numeric;
  v_warnings      jsonb := '[]'::jsonb;
BEGIN
  -- Load order
  SELECT restaurant_id, items_json
    INTO v_restaurant_id, v_items
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;

  -- Idempotency guard: skip if already processed
  IF EXISTS (
    SELECT 1 FROM stock_movements
    WHERE order_id = p_order_id AND type = 'sale'
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true, 'warnings', '[]'::jsonb);
  END IF;

  -- Validate items_json shape
  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' THEN
    RETURN jsonb_build_object('ok', true, 'warnings', '[]'::jsonb);
  END IF;

  -- Iterate order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    -- Only process items that carry a product_id (set by admin POS since Stage 2)
    CONTINUE WHEN v_item->>'product_id' IS NULL;

    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    v_qty := COALESCE((v_item->>'qty')::numeric, 1);
    CONTINUE WHEN v_qty <= 0;

    -- For each recipe ingredient of this product
    FOR v_rec IN
      SELECT ri.ingredient_id,
             ri.weight_gross,
             i.unit,
             i.name AS ing_name
      FROM recipe_items ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE ri.product_id = v_product_id
    LOOP
      -- Convert grams/ml → kg/liter; pcs stays as-is
      v_deduction := CASE v_rec.unit
        WHEN 'pcs' THEN v_rec.weight_gross * v_qty
        ELSE             v_rec.weight_gross * v_qty / 1000
      END;

      -- Deduct from stock
      UPDATE ingredients
         SET current_stock = current_stock - v_deduction
       WHERE id = v_rec.ingredient_id
      RETURNING current_stock INTO v_stock_after;

      -- Log the movement
      INSERT INTO stock_movements (ingredient_id, amount, type, order_id, notes, restaurant_id)
      VALUES (
        v_rec.ingredient_id,
        -v_deduction,
        'sale',
        p_order_id,
        'Авто-списание: ' || COALESCE(v_item->>'name', '?') || ' ×' || v_qty::text,
        v_restaurant_id
      );

      -- Collect warnings for ingredients that hit zero or below
      IF v_stock_after <= 0 THEN
        v_warnings := v_warnings || jsonb_build_array(
          jsonb_build_object(
            'ingredient', v_rec.ing_name,
            'stock',      ROUND(v_stock_after::numeric, 3),
            'unit',       v_rec.unit
          )
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'warnings', v_warnings);

EXCEPTION WHEN OTHERS THEN
  -- Never block the payment flow; log and return error info
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_order_stock(uuid) TO anon, authenticated;
