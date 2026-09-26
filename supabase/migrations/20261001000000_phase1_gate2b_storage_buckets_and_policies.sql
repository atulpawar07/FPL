-- Supabase Migration: 20261001000000_phase1_gate2b_storage_buckets_and_policies.sql
-- Target: Supabase Postgres DB
-- Description: Gate 2B Storage Buckets Creation & RLS Security Policies

-- ==========================================
-- 1. CREATE STORAGE BUCKETS
-- ==========================================

-- Private Bucket: payment-screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-screenshots',
  'payment-screenshots',
  false,
  5242880, -- 5 MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Public Bucket: team-logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-logos',
  'team-logos',
  true,
  5242880, -- 5 MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Public Bucket: profile-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,
  5242880, -- 5 MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ==========================================
-- 2. STORAGE RLS SECURITY POLICIES
-- ==========================================

-- Note: RLS on storage.objects is enabled by default in Supabase Storage

-- 2.1 payment-screenshots Policies (Strictly Private)
DROP POLICY IF EXISTS "Admin Select Payment Screenshots" ON storage.objects;
CREATE POLICY "Admin Select Payment Screenshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-screenshots'
    AND public.is_admin(auth.uid()) = true
  );

-- 2.2 team-logos Policies (Public Read)
DROP POLICY IF EXISTS "Public Read Team Logos" ON storage.objects;
CREATE POLICY "Public Read Team Logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'team-logos');

-- 2.3 profile-images Policies (Public Read)
DROP POLICY IF EXISTS "Public Read Profile Images" ON storage.objects;
CREATE POLICY "Public Read Profile Images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profile-images');

-- Notify PostgREST schema reload
NOTIFY pgrst, 'reload schema';
