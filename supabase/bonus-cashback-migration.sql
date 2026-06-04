-- ── Bonus cashback migration ──────────────────────────────────────────────────
-- Adds used_bonuses / bonuses_deducted columns to orders,
-- cashback_percent to restaurants, and a trigger that on order completion:
--   1. Deducts bonuses_deducted from guest_balances
--   2. Credits cashback_percent % of net cash amount back to guest_balances

-- ── 1. Orders: bonus columns ──────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS used_bonuses    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bonuses_deducted INTEGER NOT NULL DEFAULT 0;

-- ── 2. Restaurants: configurable cashback percentage ──────────────────────────

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS cashback_percent INTEGER NOT NULL DEFAULT 5;

-- ── 3. Trigger function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_order_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cashback_percent  INTEGER;
  v_bonus_deducted    INTEGER;
  v_net_amount        INTEGER;
  v_cashback_earned   INTEGER;
BEGIN
  -- Only run when status transitions to 'completed' and a guest is linked
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.guest_id IS NOT NULL
  THEN
    -- Lookup cashback rate for this restaurant (default 5 if missing)
    SELECT COALESCE(cashback_percent, 5)
      INTO v_cashback_percent
      FROM restaurants
     WHERE id = NEW.restaurant_id;

    v_bonus_deducted := COALESCE(NEW.bonuses_deducted, 0);

    -- Step A: deduct spent bonuses from the guest's wallet
    IF NEW.used_bonuses = TRUE AND v_bonus_deducted > 0 THEN
      UPDATE guest_balances
         SET bonus_amount = GREATEST(0, bonus_amount - v_bonus_deducted),
             updated_at   = NOW()
       WHERE guest_id      = NEW.guest_id
         AND restaurant_id = NEW.restaurant_id;
    END IF;

    -- Step B: calculate cashback on net cash paid
    -- Net = (total_price) − (bonuses used) — tips are included per business rule
    v_net_amount    := GREATEST(0, NEW.total_price - v_bonus_deducted);
    v_cashback_earned := FLOOR(v_net_amount::NUMERIC * v_cashback_percent / 100);

    IF v_cashback_earned > 0 THEN
      INSERT INTO guest_balances (guest_id, restaurant_id, bonus_amount)
      VALUES (NEW.guest_id, NEW.restaurant_id, v_cashback_earned)
      ON CONFLICT (guest_id, restaurant_id)
      DO UPDATE SET
        bonus_amount = guest_balances.bonus_amount + EXCLUDED.bonus_amount,
        updated_at   = NOW();
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- ── 4. Attach trigger ─────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_order_completion ON orders;

CREATE TRIGGER trg_order_completion
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_completion();
