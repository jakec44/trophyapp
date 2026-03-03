-- =============================================================================
-- LEVEL B: Clear storage objects (DEV ONLY)
-- =============================================================================
--
-- Removes all objects from app storage buckets.
-- Does NOT delete the buckets themselves.
--
-- Buckets cleared: avatars, catch-photos, banners, catches, stories
--
-- Run after reset_app_data.sql for a full dev reset.
-- Requires service_role or storage admin.
-- =============================================================================

-- Delete all objects in each bucket
DELETE FROM storage.objects WHERE bucket_id = 'avatars';
DELETE FROM storage.objects WHERE bucket_id = 'catch-photos';
DELETE FROM storage.objects WHERE bucket_id = 'banners';
DELETE FROM storage.objects WHERE bucket_id = 'catches';
DELETE FROM storage.objects WHERE bucket_id = 'stories';
