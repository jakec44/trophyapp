-- Moderator access: profiles.is_moderator lets designated users use dev controls,
-- delete any feed post, and delete any tournament entry.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_moderator boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.is_moderator IS 'When true, user can use dev controls in settings, delete any feed post, and delete any tournament entry.';

-- Feed posts: allow delete if owner OR current user is moderator
DROP POLICY IF EXISTS "Users can delete own feed posts" ON feed_posts;
CREATE POLICY "Users can delete own feed posts"
  ON feed_posts FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_moderator = true)
  );

-- Tournament entries: allow delete if owner OR current user is moderator
DROP POLICY IF EXISTS "Users delete own entries" ON tournament_entries;
CREATE POLICY "Users delete own entries"
  ON tournament_entries FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_moderator = true)
  );
