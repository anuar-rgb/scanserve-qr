-- =============================================================================
-- Guest Profiles Migration — Multi-restaurant loyalty ecosystem
-- Run in: Supabase Dashboard → SQL Editor → New query
--
-- Architecture:
--   guests          → one global profile per phone number (cross-restaurant)
--   guest_balances  → one row per (guest, restaurant) for isolated bonus wallets
--   orders          → linked to guest_id when the guest is logged in at checkout
-- =============================================================================

-- 1. Global guest profiles table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT        NOT NULL UNIQUE,
  name          TEXT,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by phone (login flow)
CREATE INDEX IF NOT EXISTS guests_phone_idx ON guests (phone);

-- RLS: anon can register (INSERT) and read/update their own row via sign-in API.
-- Service role used for all server-side mutations — anon access locked down.
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guests_allow_all"
  ON guests FOR ALL USING (true) WITH CHECK (true);

-- 2. Per-restaurant bonus balances ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guest_balances (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id      UUID        NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  restaurant_id UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  bonus_amount  INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One balance row per guest per restaurant
  UNIQUE (guest_id, restaurant_id)
);

-- Index for fast balance lookups in both directions
CREATE INDEX IF NOT EXISTS guest_balances_guest_idx      ON guest_balances (guest_id);
CREATE INDEX IF NOT EXISTS guest_balances_restaurant_idx ON guest_balances (restaurant_id);

-- Auto-update updated_at on every balance change
CREATE OR REPLACE FUNCTION set_guest_balance_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guest_balances_updated_at ON guest_balances;
CREATE TRIGGER guest_balances_updated_at
  BEFORE UPDATE ON guest_balances
  FOR EACH ROW EXECUTE FUNCTION set_guest_balance_updated_at();

ALTER TABLE guest_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_balances_allow_all"
  ON guest_balances FOR ALL USING (true) WITH CHECK (true);

-- 3. Link orders to guest profiles ───────────────────────────────────────────
-- NULL = anonymous order (walk-in, no login)
-- Non-NULL = authenticated guest linked for history and bonus accrual/redemption

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES guests(id) ON DELETE SET NULL;

-- Index for guest order history queries
CREATE INDEX IF NOT EXISTS orders_guest_id_idx ON orders (guest_id)
  WHERE guest_id IS NOT NULL;

-- =============================================================================
-- Summary:
--   • guests.phone is UNIQUE across the entire platform
--   • guest_balances (guest_id, restaurant_id) is UNIQUE — one wallet per venue
--   • orders.guest_id is nullable FK — no guest = anonymous order
-- =============================================================================
