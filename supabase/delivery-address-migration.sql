-- Run in: Supabase Dashboard → SQL Editor → New query
-- Adds delivery_address column to orders table for pickup/delivery orders

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
