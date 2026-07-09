-- Add admin contact and restaurant phone fields to restaurants table
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS admin_name TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS admin_phone TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS restaurant_phone TEXT;
