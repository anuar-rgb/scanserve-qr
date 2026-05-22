-- Migration: add assigned_waiter_id to restaurant_tables
-- Permanently binds a waiter to a specific table (independent of individual orders)

ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS assigned_waiter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_assigned_waiter
  ON restaurant_tables (restaurant_id, assigned_waiter_id)
  WHERE assigned_waiter_id IS NOT NULL;
