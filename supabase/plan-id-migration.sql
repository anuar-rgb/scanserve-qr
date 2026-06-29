-- Add plan_id column to restaurants for plan-based feature gating
-- Run in Supabase SQL Editor

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'standard';
