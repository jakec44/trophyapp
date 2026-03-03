-- Feed posts: user-created posts visible on profile and feed.
-- photo_path = storage path in media bucket; photo_url = fallback for external URLs.

CREATE TABLE feed_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_path TEXT,
  photo_url TEXT,
  species TEXT NOT NULL DEFAULT '',
  weight_lb FLOAT NOT NULL DEFAULT 0,
  length_in FLOAT,
  caption TEXT,
  location TEXT,
  catch_id UUID REFERENCES catches(id) ON DELETE SET NULL,
  hype_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_feed_posts_user_id ON feed_posts(user_id);
CREATE INDEX idx_feed_posts_created_at ON feed_posts(created_at DESC);

ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read feed posts (public profile grid)
CREATE POLICY "Feed posts are publicly readable"
  ON feed_posts FOR SELECT USING (true);

-- Users can insert their own posts
CREATE POLICY "Users can insert own feed posts"
  ON feed_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts (hype/comment counts or caption edits)
CREATE POLICY "Users can update own feed posts"
  ON feed_posts FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own feed posts"
  ON feed_posts FOR DELETE USING (auth.uid() = user_id);
