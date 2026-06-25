-- Ads targeting: choose which restaurants see the banner
-- NULL = all restaurants, array = specific restaurants only
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS restaurant_ids JSONB DEFAULT NULL;
