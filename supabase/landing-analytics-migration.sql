-- Landing page analytics — tracks page views and section scroll depth
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS landing_analytics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT        NOT NULL,
  page        TEXT        NOT NULL DEFAULT '/',
  section     TEXT        NOT NULL,
  device      TEXT,
  referrer    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_analytics_date ON landing_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_analytics_section ON landing_analytics(section);
