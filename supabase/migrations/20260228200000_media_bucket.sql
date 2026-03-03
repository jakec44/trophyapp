-- ============================================================
-- Create the single `media` storage bucket (replaces stories,
-- avatars, catch-photos, catches).
-- All objects are public-readable; writes are owner-scoped.
-- Path convention:
--   {userId}/stories/{storyId}.jpg
--   {userId}/avatars/main.jpg
--   {userId}/banners/main.jpg
--   {userId}/catches/{catchId}.jpg
--   {userId}/tournaments/{tournamentId}/{id}.jpg
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop any stale policies that might have been created manually
DO $$
BEGIN
  DROP POLICY IF EXISTS "media: public read"               ON storage.objects;
  DROP POLICY IF EXISTS "media: owner insert"              ON storage.objects;
  DROP POLICY IF EXISTS "media: owner update"              ON storage.objects;
  DROP POLICY IF EXISTS "media: owner delete"              ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

-- Anyone can read files in the media bucket
CREATE POLICY "media: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Authenticated users can upload into their own folder ({userId}/...)
CREATE POLICY "media: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

-- Authenticated users can overwrite/update their own files
CREATE POLICY "media: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

-- Authenticated users can delete their own files
CREATE POLICY "media: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );
