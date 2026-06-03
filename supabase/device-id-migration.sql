-- Add persistent device_id to employee_signatures
-- Run this in your Supabase SQL Editor.

ALTER TABLE employee_signatures
  ADD COLUMN IF NOT EXISTS device_id text;
