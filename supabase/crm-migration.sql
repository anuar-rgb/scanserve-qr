-- Run in: Supabase Dashboard → SQL Editor → New query
-- Creates crm_clients table for Mini-CRM and Web Push notification system

CREATE TABLE IF NOT EXISTS crm_clients (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone             TEXT,
  name              TEXT,
  push_subscription JSONB,
  created_at        TIMESTAMPTZ DEFAULT now(),
  last_visit        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (restaurant_id, phone)
);

-- Allow anon INSERT (guest subscribe) + admin SELECT/UPDATE
ALTER TABLE crm_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON crm_clients FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookups by restaurant
CREATE INDEX IF NOT EXISTS crm_clients_restaurant_idx
  ON crm_clients (restaurant_id, created_at DESC);

-- Partial index for clients with push subscriptions
CREATE INDEX IF NOT EXISTS crm_clients_push_idx
  ON crm_clients (restaurant_id)
  WHERE push_subscription IS NOT NULL;

-- Logic:
--   push_subscription IS NOT NULL → client accepted push notifications
--   phone IS NOT NULL             → client identified (linked via WaiterModal or checkout)
--   last_visit                    → updated on each visit/subscription renewal
