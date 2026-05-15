-- ── Add paid_amount to orders ──────────────────────────────────────────────────
-- Tracks prepayments/deposits on preorders. remaining_amount is computed in UI.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
