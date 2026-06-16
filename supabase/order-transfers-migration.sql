-- Migration: create order_transfers table
-- Logs every item-level transfer between tables for audit trail

CREATE TABLE IF NOT EXISTS order_transfers (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID          NOT NULL,
  source_order_id     TEXT          NOT NULL,
  target_order_id     TEXT          NOT NULL,
  item_name           TEXT          NOT NULL,
  item_price          NUMERIC       NOT NULL,
  item_qty            INTEGER       NOT NULL DEFAULT 1,
  from_table          TEXT,
  to_table            TEXT          NOT NULL,
  transferred_by      UUID,
  transferred_by_name TEXT,
  transferred_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_transfers_restaurant
  ON order_transfers (restaurant_id, transferred_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_transfers_source
  ON order_transfers (source_order_id);

CREATE INDEX IF NOT EXISTS idx_order_transfers_target
  ON order_transfers (target_order_id);
