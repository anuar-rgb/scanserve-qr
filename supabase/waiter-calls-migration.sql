-- Run in: Supabase Dashboard → SQL Editor → New query
-- Creates waiter_calls table for in-app waiter call notifications

CREATE TABLE IF NOT EXISTS waiter_calls (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_label   TEXT NOT NULL,
  action        TEXT NOT NULL DEFAULT 'come',
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Allow all operations for anon key (guest menu insert + admin panel select/update)
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON waiter_calls FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;

-- Index for fast lookups by restaurant + status
CREATE INDEX IF NOT EXISTS waiter_calls_restaurant_status_idx
  ON waiter_calls (restaurant_id, status, created_at DESC);

-- Logic:
--   status = 'pending'  → call is active, bell rings in admin/waiter panel
--   status = 'resolved' → admin clicked "Принять вызов", bell clears
--   action:
--     'clean' → "Убрать со стола"
--     'bill'  → "Принесите счёт"
--     'come'  → "Подойдите к столу"
--     other   → free-text from guest ("Другое")
