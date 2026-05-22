-- Add checkout tracking to shift_checkins
-- Run in Supabase SQL Editor

ALTER TABLE shift_checkins ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
