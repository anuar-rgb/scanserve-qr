-- Add description column to info_showcases for popup text / Wi-Fi password
ALTER TABLE info_showcases
  ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;
