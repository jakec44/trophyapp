/* Feed interactions: hype, comments, share - save and sync for all accounts */

/* 1. Add share_count to feed_posts */
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS share_count INT NOT NULL DEFAULT 0;

/* 2. Table to track who hyped which post (for isHyped + accurate hype_count) */
CREATE TABLE IF NOT EXISTS feed_post_hypes (
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_feed_post_hypes_post_id ON feed_post_hypes(post_id);

ALTER TABLE feed_post_hypes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read hypes" ON feed_post_hypes;
CREATE POLICY "Anyone can read hypes" ON feed_post_hypes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can insert own hype" ON feed_post_hypes;
CREATE POLICY "Authenticated can insert own hype" ON feed_post_hypes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own hype" ON feed_post_hypes;
CREATE POLICY "Users can delete own hype" ON feed_post_hypes FOR DELETE USING (auth.uid() = user_id);

/* 3. Comments table */
CREATE TABLE IF NOT EXISTS feed_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES feed_comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  likes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post_id ON feed_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_created_at ON feed_comments(created_at);

ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read comments" ON feed_comments;
CREATE POLICY "Anyone can read comments" ON feed_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can insert own comment" ON feed_comments;
CREATE POLICY "Authenticated can insert own comment" ON feed_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

/* 4. RPC: Toggle hype on a post (bypasses RLS for hype_count update) */
CREATE OR REPLACE FUNCTION hype_feed_post(p_post_id UUID, p_hype BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in to hype'; END IF;

  IF p_hype THEN
    INSERT INTO feed_post_hypes (post_id, user_id) VALUES (p_post_id, v_user_id)
    ON CONFLICT (post_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM feed_post_hypes WHERE post_id = p_post_id AND user_id = v_user_id;
  END IF;

  SELECT COUNT(*)::INT INTO v_count FROM feed_post_hypes WHERE post_id = p_post_id;
  UPDATE feed_posts SET hype_count = GREATEST(0, v_count) WHERE id = p_post_id;

  RETURN jsonb_build_object('hypeCount', v_count, 'isHyped', p_hype);
END;
$$;
GRANT EXECUTE ON FUNCTION hype_feed_post(UUID, BOOLEAN) TO authenticated;

/* 5. RPC: Add comment and increment comment_count */
CREATE OR REPLACE FUNCTION add_feed_comment(p_post_id UUID, p_text TEXT, p_parent_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_comment_id UUID;
  v_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in to comment'; END IF;
  IF p_text IS NULL OR LENGTH(TRIM(p_text)) = 0 THEN RAISE EXCEPTION 'Comment text is required'; END IF;

  INSERT INTO feed_comments (post_id, user_id, parent_comment_id, text)
  VALUES (p_post_id, v_user_id, p_parent_id, TRIM(p_text))
  RETURNING id INTO v_comment_id;

  SELECT COUNT(*)::INT INTO v_count FROM feed_comments WHERE post_id = p_post_id;
  UPDATE feed_posts SET comment_count = v_count WHERE id = p_post_id;

  RETURN jsonb_build_object('commentId', v_comment_id, 'commentCount', v_count);
END;
$$;
GRANT EXECUTE ON FUNCTION add_feed_comment(UUID, TEXT, UUID) TO authenticated;

/* 6. RPC: Increment share count */
CREATE OR REPLACE FUNCTION increment_feed_share(p_post_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE feed_posts SET share_count = COALESCE(share_count, 0) + 1 WHERE id = p_post_id
  RETURNING share_count INTO v_count;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;
  RETURN jsonb_build_object('shareCount', v_count);
END;
$$;
GRANT EXECUTE ON FUNCTION increment_feed_share(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_feed_share(UUID) TO anon;
