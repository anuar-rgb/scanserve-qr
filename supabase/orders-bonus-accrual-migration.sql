-- Migration: add bonus accrual tracking columns to orders
-- Run this in Supabase SQL Editor

ALTER TABLE orders ADD COLUMN IF NOT EXISTS bonuses_accrued BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bonuses_earned  INTEGER DEFAULT NULL;
