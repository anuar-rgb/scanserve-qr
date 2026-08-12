-- Race condition fixes — run once in Supabase SQL Editor
-- Adds two PostgreSQL functions that replace JS read-then-write patterns
-- with atomic SQL operations.

-- ── 1. decrement_product_qty ──────────────────────────────────────────────────
-- Used by /api/orders/decrement-limits instead of JS Math.max read-then-write.
-- PostgreSQL row-level lock inside UPDATE makes this atomic — two concurrent
-- calls for the same product_id are serialized and both decrements are applied.
CREATE OR REPLACE FUNCTION decrement_product_qty(p_product_id uuid, p_qty integer)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE products
  SET remaining_qty = GREATEST(0, remaining_qty - p_qty),
      is_available  = (GREATEST(0, remaining_qty - p_qty) > 0)
  WHERE id              = p_product_id
    AND remaining_qty IS NOT NULL;
$$;

-- ── 2. adjust_guest_balance ───────────────────────────────────────────────────
-- Used by accrue-bonuses and refund routes instead of SELECT+upsert pattern.
-- Atomically increments (positive delta) or decrements (negative delta) the balance.
-- INSERT ... ON CONFLICT ... DO UPDATE is atomic — no lost updates under concurrent calls.
-- Returns the new balance after adjustment.
CREATE OR REPLACE FUNCTION adjust_guest_balance(
  p_guest_id      uuid,
  p_restaurant_id uuid,
  p_delta         integer
) RETURNS integer
LANGUAGE sql
AS $$
  INSERT INTO guest_balances (guest_id, restaurant_id, bonus_amount)
  VALUES (p_guest_id, p_restaurant_id, p_delta)
  ON CONFLICT (guest_id, restaurant_id)
  DO UPDATE SET bonus_amount = guest_balances.bonus_amount + EXCLUDED.bonus_amount
  RETURNING bonus_amount;
$$;
