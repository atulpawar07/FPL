-- Supabase Migration: 20261013000000_tournament_assets_storage_bucket.sql
-- Target: Supabase Postgres DB
-- Description: P0 Performance Fix — Create public tournament-assets Storage bucket.
--
-- Purpose:
--   Tournament banner images and payment QR images were previously stored as
--   base64 data URIs directly in the tournaments.banner_url and
--   tournaments.payment_qr_url TEXT columns, causing the public tournament
--   API to return ~607 KB per request. This migration provisions a dedicated
--   Storage bucket so those images are served from Supabase CDN instead.
--
-- Safety:
--   - Does NOT modify existing buckets: payment-screenshots, team-logos, profile-images.
--   - Does NOT modify any application table (tournaments, registrations, payments, etc.)
--   - Additive only: creates a new bucket and new policies.
--   - Idempotent: ON CONFLICT / DROP POLICY IF EXISTS / CREATE POLICY are safe to re-run.

-- ==========================================
-- 1. CREATE tournament-assets BUCKET
-- ==========================================

-- Public bucket: tournament banners and payment QR codes must be publicly viewable
-- without authentication. All uploads are performed exclusively via the server-side
-- admin/service-role client — no anonymous client-side upload is permitted.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tournament-assets',
  'tournament-assets',
  true,
  5242880, -- 5 MB in bytes (matches project-wide image size policy)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ==========================================
-- 2. STORAGE RLS POLICIES
-- ==========================================

-- Note: RLS on storage.objects is enabled by default in Supabase Storage.

-- 2.1 Public SELECT for tournament assets (banners and QR codes are not sensitive).
DROP POLICY IF EXISTS "Public Read Tournament Assets" ON storage.objects;
CREATE POLICY "Public Read Tournament Assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'tournament-assets');

-- No INSERT / UPDATE / DELETE client policies.
-- All writes are performed exclusively via the service-role key from server-side
-- admin API routes (api/admin/tournaments and the one-time migration script).
-- This ensures no unauthenticated or user-level writes can occur.

-- ==========================================
-- 3. NOTIFY POSTGREST
-- ==========================================

NOTIFY pgrst, 'reload schema';
