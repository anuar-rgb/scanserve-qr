-- Adds owner contact and subscription tracking fields to restaurants table.
-- Used by the Super Admin panel (/super-admin) to manage platform clients.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS owner_name             TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone            TEXT,
  ADD COLUMN IF NOT EXISTS monthly_payment_status TEXT DEFAULT 'unpaid'
    CHECK (monthly_payment_status IN ('paid', 'unpaid', 'overdue')),
  ADD COLUMN IF NOT EXISTS payment_due_date       DATE;
