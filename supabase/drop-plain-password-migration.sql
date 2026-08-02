-- Remove plain_password column from staff_users
-- Passwords were stored in plain text — security vulnerability.
-- API already stopped reading/writing this column before this migration.
ALTER TABLE staff_users DROP COLUMN IF EXISTS plain_password;
