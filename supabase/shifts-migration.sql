-- Shift Management (Z-Report) — run in Supabase SQL Editor

-- Shifts table tracks financial days / cash register sessions
CREATE TABLE IF NOT EXISTS shifts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID        NOT NULL,
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at         TIMESTAMPTZ,
  status            TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  -- Saved totals (written on shift close)
  total_revenue     NUMERIC(12,2),
  orders_count      INTEGER,
  revenue_by_type   JSONB,       -- e.g. {"dine_in": 45000, "pickup": 12000}
  revenue_by_payment JSONB,      -- e.g. {"cash": 30000, "kaspi": 27000}
  prepayments_total NUMERIC(12,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shifts_restaurant_status_idx
  ON shifts(restaurant_id, status);

CREATE INDEX IF NOT EXISTS shifts_restaurant_opened_idx
  ON shifts(restaurant_id, opened_at DESC);

-- Link orders to shifts (nullable — legacy orders have no shift)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_id UUID;

CREATE INDEX IF NOT EXISTS orders_shift_id_idx ON orders(shift_id);
