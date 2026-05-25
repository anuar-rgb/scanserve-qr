-- Add allergens array column to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS allergens TEXT[] NOT NULL DEFAULT '{}';
