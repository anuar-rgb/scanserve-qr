-- ============================================================
-- Migration: waiter revenue tracking per shift
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add opened_by column to orders (tracks which staff member created the order)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS opened_by UUID;

-- FK to staff_users (nullable — legacy orders won't have this)
DO $$
BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT fk_orders_opened_by
    FOREIGN KEY (opened_by) REFERENCES staff_users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_opened_by ON orders(opened_by);

-- 2. Snapshot table: waiter revenue per shift
CREATE TABLE IF NOT EXISTS waiter_shift_revenues (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id     UUID          NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  waiter_id    UUID          NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  cash_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  card_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  orders_count INTEGER       NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(shift_id, waiter_id)
);

CREATE INDEX IF NOT EXISTS idx_wsr_shift_id   ON waiter_shift_revenues(shift_id);
CREATE INDEX IF NOT EXISTS idx_wsr_waiter_id  ON waiter_shift_revenues(waiter_id);
CREATE INDEX IF NOT EXISTS idx_wsr_created_at ON waiter_shift_revenues(created_at DESC);
