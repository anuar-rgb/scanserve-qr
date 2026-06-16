-- Platform-wide ad banners shown in the guest menu between popular dishes and info cards.
-- Managed from the Super Admin panel (/super-admin/ads).

CREATE TABLE IF NOT EXISTS advertisements (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url     TEXT        NOT NULL,
  target_url    TEXT,
  title         TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  placement     TEXT        NOT NULL DEFAULT 'menu_middle',
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Guests can read only active banners; writes go through service role (super-admin API)
CREATE POLICY "public_read_active_ads" ON advertisements
  FOR SELECT USING (is_active = true);
