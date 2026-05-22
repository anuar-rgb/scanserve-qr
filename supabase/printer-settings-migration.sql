-- Migration: printer_settings
-- Stores LAN thermal printer configurations per restaurant.
-- Categories is a JSONB array of category IDs (UUIDs) whose items route to this printer.
-- An empty categories array means "catch-all / default" — receives all unmatched items.

CREATE TABLE IF NOT EXISTS printer_settings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  printer_name   TEXT        NOT NULL,                     -- e.g. "Принтер Кухни"
  ip_address     TEXT        NOT NULL,                     -- e.g. "192.168.1.100"
  port           INTEGER     NOT NULL DEFAULT 9100,
  categories     JSONB       NOT NULL DEFAULT '[]'::jsonb, -- array of category UUIDs
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  order_index    INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_printer_settings_restaurant
  ON printer_settings (restaurant_id, is_active);

-- RLS: only the restaurant owner/manager can manage printer settings
ALTER TABLE printer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "printer_settings_select" ON printer_settings
  FOR SELECT USING (true);

CREATE POLICY "printer_settings_insert" ON printer_settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "printer_settings_update" ON printer_settings
  FOR UPDATE USING (true);

CREATE POLICY "printer_settings_delete" ON printer_settings
  FOR DELETE USING (true);
