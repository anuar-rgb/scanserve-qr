-- Add description column to info_showcases
-- Run once in Supabase SQL Editor

ALTER TABLE info_showcases
  ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;
