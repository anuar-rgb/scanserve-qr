-- ─────────────────────────────────────────────────────────────────────────────
-- Invoices (Накладные) — supplier expense tracking
-- Run once in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. invoices — one row per supplier invoice
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id   uuid          NOT NULL,
  invoice_number  text,
  supplier_name   text          NOT NULL,
  total_amount    decimal(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz   DEFAULT now() NOT NULL,
  created_by      text
);

CREATE INDEX IF NOT EXISTS invoices_restaurant_id_idx ON invoices (restaurant_id);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx    ON invoices (created_at);

-- 2. invoice_items — line items belonging to an invoice
CREATE TABLE IF NOT EXISTS invoice_items (
  id               uuid           DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id       uuid           NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_name        text           NOT NULL,
  quantity         decimal(12,3)  NOT NULL DEFAULT 0,
  unit             text           NOT NULL DEFAULT 'шт',
  price_per_unit   decimal(12,2)  NOT NULL DEFAULT 0,
  total_item_price decimal(12,2)  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON invoice_items (invoice_id);

-- 3. Row-level security (open read/write, same pattern as other tables)
ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'public_all_invoices') THEN
    CREATE POLICY public_all_invoices ON invoices FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_items' AND policyname = 'public_all_invoice_items') THEN
    CREATE POLICY public_all_invoice_items ON invoice_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
