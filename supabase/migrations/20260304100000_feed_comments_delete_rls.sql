-- Allow users to delete their own comments (RLS was missing for DELETE)
DROP POLICY IF EXISTS "Users can delete own comment" ON feed_comments;
CREATE POLICY "Users can delete own comment" ON feed_comments FOR DELETE USING (auth.uid() = user_id);
