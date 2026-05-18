-- Shift check-ins — run in Supabase SQL Editor
-- Adds opened_by to shifts and a per-waiter check-in tracking table.

-- 1. Track which manager opened each shift
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS opened_by TEXT;

-- 2. Individual waiter check-ins per shift (one row per waiter per shift)
CREATE TABLE IF NOT EXISTS shift_checkins (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        UUID        NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  staff_user_id   TEXT        NOT NULL,
  restaurant_id   TEXT        NOT NULL,
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shift_id, staff_user_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_checkins_shift        ON shift_checkins(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_checkins_staff        ON shift_checkins(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_shift_checkins_restaurant   ON shift_checkins(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_shift_checkins_checked_in   ON shift_checkins(checked_in_at DESC);
