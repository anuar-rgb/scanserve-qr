-- ── Add customer contact fields to orders ─────────────────────────────────────
-- Used by preorders so admin can call/message the guest about their reservation.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name  TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
