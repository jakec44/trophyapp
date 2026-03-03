-- Storage RLS: Allow authenticated users to upload to stories and catch-photos buckets.
-- Path format: {userId}/stories/{storyId}.jpg or {userId}/logs/{catchId}.jpg
-- First path segment must match auth.uid() for user-scoped uploads.

-- Stories bucket: authenticated users can upload to their own folder
CREATE POLICY "Authenticated can upload to stories"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'stories'
  AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

-- Catch-photos bucket: authenticated users can upload to their own folder
CREATE POLICY "Authenticated can upload to catch-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'catch-photos'
  AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

-- Allow SELECT for public read (stories and catch-photos are typically public buckets)
CREATE POLICY "Public read stories"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stories');

CREATE POLICY "Public read catch-photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'catch-photos');

-- Allow UPDATE for upsert (overwrite existing files)
CREATE POLICY "Authenticated can update own stories"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'stories'
  AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

CREATE POLICY "Authenticated can update own catch-photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'catch-photos'
  AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);
