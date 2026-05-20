-- Run in: Supabase Dashboard → SQL Editor → New query
-- Adds subcategory support (parent_id) and modifiers system

-- ── 1. Subcategories ──────────────────────────────────────────────────────────
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- ── 2. Modifiers table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modifiers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  order_index   INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='modifiers' AND policyname='anon select modifiers') THEN
    CREATE POLICY "anon select modifiers" ON modifiers FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='modifiers' AND policyname='anon insert modifiers') THEN
    CREATE POLICY "anon insert modifiers" ON modifiers FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='modifiers' AND policyname='anon update modifiers') THEN
    CREATE POLICY "anon update modifiers" ON modifiers FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='modifiers' AND policyname='anon delete modifiers') THEN
    CREATE POLICY "anon delete modifiers" ON modifiers FOR DELETE TO anon USING (true);
  END IF;
END $$;
