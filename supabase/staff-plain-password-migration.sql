-- Stores the last set plain-text password for super-admin visibility.
-- Super-admin needs to distribute credentials to restaurant owners.

ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS plain_password TEXT;
