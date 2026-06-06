-- Add email column to guests table for passwordless OTP auth
-- Run this once in Supabase SQL Editor

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS email text;

-- Unique index on email (where not null, to allow legacy rows without email)
CREATE UNIQUE INDEX IF NOT EXISTS guests_email_key
  ON guests (email)
  WHERE email IS NOT NULL;
