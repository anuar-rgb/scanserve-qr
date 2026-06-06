-- When admin creates/resets a staff password, staff must change it on first login.
-- This ensures only the employee knows their own password.

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing staff as needing a password change (optional — remove if you don't want this)
-- UPDATE staff_users SET must_change_password = true WHERE role != 'owner';
