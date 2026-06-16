-- Fix: bonus cashback trigger fails with "operator does not exist: uuid = text"
-- Root cause: orders.restaurant_id is TEXT but restaurants.id and
-- guest_balances.restaurant_id are UUID. The trigger compares them directly.
-- Fix: cast NEW.restaurant_id to uuid in all comparisons.
--
-- Run in: Supabase Dashboard → SQL Editor → New query

CREATE OR REPLACE FUNCTION handle_order_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cashback_percent  INTEGER;
  v_bonus_deducted    INTEGER;
  v_net_amount        INTEGER;
  v_cashback_earned   INTEGER;
  v_restaurant_uuid   UUID;
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.guest_id IS NOT NULL
  THEN
    -- Cast text restaurant_id to uuid once
    BEGIN
      v_restaurant_uuid := NEW.restaurant_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN NEW; -- malformed uuid, skip silently
    END;

    SELECT COALESCE(cashback_percent, 5)
      INTO v_cashback_percent
      FROM restaurants
     WHERE id = v_restaurant_uuid;

    v_bonus_deducted := COALESCE(NEW.bonuses_deducted, 0);

    IF NEW.used_bonuses = TRUE AND v_bonus_deducted > 0 THEN
      UPDATE guest_balances
         SET bonus_amount = GREATEST(0, bonus_amount - v_bonus_deducted),
             updated_at   = NOW()
       WHERE guest_id      = NEW.guest_id
         AND restaurant_id = v_restaurant_uuid;
    END IF;

    v_net_amount      := GREATEST(0, NEW.total_price - v_bonus_deducted);
    v_cashback_earned := FLOOR(v_net_amount::NUMERIC * COALESCE(v_cashback_percent, 5) / 100);

    IF v_cashback_earned > 0 THEN
      INSERT INTO guest_balances (guest_id, restaurant_id, bonus_amount)
      VALUES (NEW.guest_id, v_restaurant_uuid, v_cashback_earned)
      ON CONFLICT (guest_id, restaurant_id)
      DO UPDATE SET
        bonus_amount = guest_balances.bonus_amount + EXCLUDED.bonus_amount,
        updated_at   = NOW();
    END IF;

  END IF;

  RETURN NEW;
END;
$$;
