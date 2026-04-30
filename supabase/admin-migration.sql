-- =============================================================================
-- ScanServe Admin Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- =============================================================================

-- 1. New product columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_popular  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_spicy    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Cover image for the restaurant
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- =============================================================================
-- 3. Storage buckets
--    (Creates them if they don't exist yet)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('menu-images', 'menu-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('branding',    'branding',    true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4. Storage RLS policies
--    Allow anon (admin panel uses anon key) to upload & read.
-- =============================================================================

-- menu-images
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'anon insert menu-images'
  ) THEN
    CREATE POLICY "anon insert menu-images" ON storage.objects
      FOR INSERT TO anon WITH CHECK (bucket_id = 'menu-images');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'anon update menu-images'
  ) THEN
    CREATE POLICY "anon update menu-images" ON storage.objects
      FOR UPDATE TO anon USING (bucket_id = 'menu-images');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'public select menu-images'
  ) THEN
    CREATE POLICY "public select menu-images" ON storage.objects
      FOR SELECT USING (bucket_id = 'menu-images');
  END IF;
END $$;

-- branding
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'anon insert branding'
  ) THEN
    CREATE POLICY "anon insert branding" ON storage.objects
      FOR INSERT TO anon WITH CHECK (bucket_id = 'branding');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'anon update branding'
  ) THEN
    CREATE POLICY "anon update branding" ON storage.objects
      FOR UPDATE TO anon USING (bucket_id = 'branding');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'public select branding'
  ) THEN
    CREATE POLICY "public select branding" ON storage.objects
      FOR SELECT USING (bucket_id = 'branding');
  END IF;
END $$;

-- =============================================================================
-- 5. Products table — ensure anon can INSERT and DELETE
--    (UPDATE already works for the existing is_available toggle)
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products'
      AND policyname = 'anon insert products'
  ) THEN
    CREATE POLICY "anon insert products" ON products
      FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products'
      AND policyname = 'anon delete products'
  ) THEN
    CREATE POLICY "anon delete products" ON products
      FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- 6. Categories table — ensure anon can INSERT and DELETE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'categories'
      AND policyname = 'anon insert categories'
  ) THEN
    CREATE POLICY "anon insert categories" ON categories
      FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'categories'
      AND policyname = 'anon delete categories'
  ) THEN
    CREATE POLICY "anon delete categories" ON categories
      FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- 7. Restaurants table — ensure anon can UPDATE (for branding)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'restaurants'
      AND policyname = 'anon update restaurants'
  ) THEN
    CREATE POLICY "anon update restaurants" ON restaurants
      FOR UPDATE TO anon USING (true);
  END IF;
END $$;
