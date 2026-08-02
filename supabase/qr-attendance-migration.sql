-- Add qr_checkin_enabled flag to restaurants
-- When true (default): staff must scan QR at entrance to start working.
-- When false: CheckinGate is bypassed — staff access the system without QR scan.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_checkin_enabled boolean NOT NULL DEFAULT true;
