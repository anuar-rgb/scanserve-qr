-- Add ingredients column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients TEXT;
