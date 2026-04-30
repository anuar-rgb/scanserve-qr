-- ============================================================
-- Supabase Storage: Buckets + RLS Policies
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create buckets (idempotent — safe to re-run)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('branding',    'branding',    true, 5242880, ARRAY['image/png','image/jpeg','image/webp']),
  ('banners',     'banners',     true, 5242880, ARRAY['image/png','image/jpeg','image/webp']),
  ('menu-images', 'menu-images', true, 5242880, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Drop existing policies to avoid conflicts on re-run
DO $$
DECLARE
  pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'scanserve_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol);
  END LOOP;
END $$;

-- 3. SELECT — public read for all three buckets
CREATE POLICY "scanserve_read_branding"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'branding');

CREATE POLICY "scanserve_read_banners"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

CREATE POLICY "scanserve_read_menu_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

-- 4. INSERT — allow anon + authenticated
--    NOTE: once you add Supabase Auth to the admin panel,
--    replace `true` with `auth.role() = 'authenticated'`
CREATE POLICY "scanserve_insert_branding"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'branding');

CREATE POLICY "scanserve_insert_banners"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'banners');

CREATE POLICY "scanserve_insert_menu_images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-images');

-- 5. UPDATE
CREATE POLICY "scanserve_update_branding"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'branding');

CREATE POLICY "scanserve_update_banners"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'banners');

CREATE POLICY "scanserve_update_menu_images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'menu-images');

-- 6. DELETE
CREATE POLICY "scanserve_delete_branding"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'branding');

CREATE POLICY "scanserve_delete_banners"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'banners');

CREATE POLICY "scanserve_delete_menu_images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'menu-images');
