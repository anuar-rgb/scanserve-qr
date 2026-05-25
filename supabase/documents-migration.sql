-- ============================================================
-- Module: Electronic Documents & Digital Signatures
-- Run this in Supabase SQL Editor
-- ============================================================

-- Document templates created by the manager/owner
CREATE TABLE IF NOT EXISTS company_documents (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID        NOT NULL,
  title         TEXT        NOT NULL,
  content       TEXT        NOT NULL,
  is_required   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_documents_restaurant
  ON company_documents (restaurant_id);

-- Per-employee signature records (one per staff × document)
CREATE TABLE IF NOT EXISTS employee_signatures (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id   UUID        NOT NULL,
  document_id     UUID        NOT NULL REFERENCES company_documents(id) ON DELETE CASCADE,
  staff_user_id   UUID        NOT NULL,
  sign_token      TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  signature_image TEXT,                    -- base64 PNG from canvas
  signed_at       TIMESTAMPTZ,
  ip_address      TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'signed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, staff_user_id)      -- one record per staff per document
);

CREATE INDEX IF NOT EXISTS idx_employee_signatures_restaurant
  ON employee_signatures (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_employee_signatures_staff
  ON employee_signatures (staff_user_id);
CREATE INDEX IF NOT EXISTS idx_employee_signatures_token
  ON employee_signatures (sign_token);
