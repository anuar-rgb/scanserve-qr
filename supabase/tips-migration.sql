-- Migration: Add tips_amount column to orders table
-- Run in Supabase SQL Editor

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tips_amount NUMERIC DEFAULT 0;

COMMENT ON COLUMN orders.tips_amount IS 'Guest-entered tip amount added on top of order total';
