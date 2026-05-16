-- Add prepayment_method column to orders table
-- Stores the payment method used for partial/full prepayment on preorders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepayment_method TEXT;
