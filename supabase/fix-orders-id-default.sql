-- ── Fix: orders.id must auto-generate when not provided ──────────────────────
-- The POS terminal (hall/page.tsx) inserts orders without an explicit id.
-- Without this DEFAULT, Supabase returns:
--   "null value in column id violates not-null constraint"
--
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE orders
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
