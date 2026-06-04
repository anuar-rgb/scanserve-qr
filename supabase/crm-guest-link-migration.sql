-- Migration: link crm_clients to guest profiles via guest_id
-- Run this in Supabase SQL editor

-- Step 1: add guest_id column (FK to guests)
ALTER TABLE crm_clients
  ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES guests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_clients_guest_id ON crm_clients(guest_id);

-- Step 2: back-fill existing rows where phone matches a registered guest
UPDATE crm_clients c
SET guest_id = g.id
FROM guests g
WHERE c.phone = g.phone
  AND c.guest_id IS NULL
  AND c.phone IS NOT NULL;
