-- Migration: phone number and device tracking for digital signatures
-- Run in Supabase SQL Editor

-- 1. Add phone column to staff_users
ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Ensure employee_signatures has all audit columns
ALTER TABLE employee_signatures
  ADD COLUMN IF NOT EXISTS ip_address    TEXT,
  ADD COLUMN IF NOT EXISTS phone_number  TEXT,
  ADD COLUMN IF NOT EXISTS device_model  TEXT;
