-- Add payment_bank and payment_phone columns to orders table
-- These store the remote payment bank (kaspi/halyk) and invoice phone
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_bank text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_phone text;
