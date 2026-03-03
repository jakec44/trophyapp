-- Delete 0-byte story files (DEV/cleanup)
-- Run with service_role or storage admin.
-- Use after fixing upload logic to remove corrupted/empty objects.

DELETE FROM storage.objects
WHERE bucket_id = 'stories'
  AND (
    (metadata->>'size')::int = 0
    OR metadata->>'size' IS NULL
  );
