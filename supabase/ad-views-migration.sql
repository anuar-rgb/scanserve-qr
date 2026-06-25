-- Ad banner view tracking
CREATE TABLE IF NOT EXISTS ad_views (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id           UUID        NOT NULL,
  restaurant_id   TEXT        NOT NULL,
  device          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_views_ad ON ad_views(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_views_date ON ad_views(created_at DESC);
