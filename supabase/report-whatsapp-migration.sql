-- Add report_whatsapp column to restaurants table
-- This phone number receives the automated WhatsApp shift report when a shift is closed
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS report_whatsapp text;
