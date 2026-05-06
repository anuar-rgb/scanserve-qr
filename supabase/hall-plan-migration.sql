-- ── Restaurant Tables (Hall Plan) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id             TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  restaurant_id  TEXT        NOT NULL,
  label          TEXT        NOT NULL,          -- display label: "1", "A3", "Терраса"
  seats          INTEGER     NOT NULL DEFAULT 4,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;

-- authenticated role (service/JWT users)
DROP POLICY IF EXISTS "auth read restaurant_tables"   ON restaurant_tables;
CREATE POLICY "auth read restaurant_tables"
  ON restaurant_tables FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth write restaurant_tables"  ON restaurant_tables;
CREATE POLICY "auth write restaurant_tables"
  ON restaurant_tables FOR ALL TO authenticated
  WITH CHECK (true);

-- anon role (frontend / admin panel using anon key)
DROP POLICY IF EXISTS "anon read restaurant_tables"   ON restaurant_tables;
CREATE POLICY "anon read restaurant_tables"
  ON restaurant_tables FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "anon write restaurant_tables"  ON restaurant_tables;
CREATE POLICY "anon write restaurant_tables"
  ON restaurant_tables FOR ALL TO anon
  WITH CHECK (true);

-- ── Index ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS restaurant_tables_restaurant_id
  ON restaurant_tables (restaurant_id);
