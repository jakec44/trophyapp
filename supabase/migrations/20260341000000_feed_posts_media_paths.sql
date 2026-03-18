-- Store multiple media per feed post (ordered list of storage paths).
-- photo_path remains the first/primary; media_paths is the full ordered list when >1 item.

ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS media_paths TEXT[] DEFAULT NULL;

COMMENT ON COLUMN feed_posts.media_paths IS 'Ordered storage paths for multi-image/video posts. When set, photo_path should match first element.';
