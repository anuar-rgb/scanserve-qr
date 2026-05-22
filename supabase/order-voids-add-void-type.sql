-- Migration: add void_type column to order_voids
-- Distinguishes input errors (no stock impact) from actual waste (stock deducted)

ALTER TABLE order_voids
  ADD COLUMN IF NOT EXISTS void_type TEXT NOT NULL DEFAULT 'waste';

-- Index for filtering by type in analytics
CREATE INDEX IF NOT EXISTS idx_order_voids_void_type
  ON order_voids (restaurant_id, void_type);
