-- Delivery system migration
-- Run in Supabase SQL Editor

-- 1. Add delivery_status column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'new';
-- Values: new | accepted | in_transit | delivered

-- 2. Add push_subscription column to staff_users (for courier push notifications)
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS push_subscription JSONB;
