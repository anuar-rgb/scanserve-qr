-- ── Add customer_city to orders ─────────────────────────────────────────────
-- Stores the guest's city for preorder dine-in; pickup/delivery orders store
-- the KZ_CITIES display name. Used to show contact info in admin PreorderDayCard.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_city TEXT;
