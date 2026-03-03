-- Trophy Room PostgreSQL Schema
-- Supabase will handle auth.users table automatically

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. PROFILES TABLE
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  city TEXT,
  state TEXT,
  bio TEXT,
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro')),
  pro_verified BOOLEAN DEFAULT false,
  pro_expires_at TIMESTAMP WITH TIME ZONE,
  public BOOLEAN DEFAULT true,
  generation_usage_this_month INT DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CATCHES TABLE
CREATE TABLE catches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  species TEXT NOT NULL,
  weight_lb FLOAT NOT NULL,
  length_in FLOAT,
  location TEXT,
  notes TEXT,
  photo_url TEXT,
  photo_thumb_url TEXT,
  background_removed_url TEXT,
  identified_confidence FLOAT CHECK (identified_confidence >= 0 AND identified_confidence <= 1),
  compass_direction TEXT,
  taken_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_photos CHECK (photo_url IS NULL OR photo_url ~ '^https?://'),
  CONSTRAINT positive_weight CHECK (weight_lb > 0)
);

-- 3. MOUNT_SLOTS TABLE
CREATE TABLE mount_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_number INT NOT NULL CHECK (room_number IN (1, 2, 3)),
  slot_position INT NOT NULL CHECK (slot_position >= 0 AND slot_position < 12),
  catch_id UUID REFERENCES catches(id) ON DELETE SET NULL,
  label TEXT,
  position_x FLOAT DEFAULT 0.5 CHECK (position_x >= 0 AND position_x <= 1),
  position_y FLOAT DEFAULT 0.5 CHECK (position_y >= 0 AND position_y <= 1),
  scale FLOAT DEFAULT 1.0 CHECK (scale > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, room_number, slot_position)
);

-- 4. FRIENDSHIPS TABLE
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id_1 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id_2 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT different_users CHECK (user_id_1 != user_id_2),
  CONSTRAINT ordered_pair CHECK (user_id_1 < user_id_2),
  UNIQUE(user_id_1, user_id_2)
);

-- 5. FRIEND_INVITES TABLE
CREATE TABLE friend_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  redeemed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT code_format CHECK (code ~ '^[A-Z0-9]{6}$')
);

-- 6. MESSAGES TABLE
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT different_users CHECK (sender_id != recipient_id),
  CONSTRAINT non_empty_body CHECK (LENGTH(TRIM(body)) > 0)
);

-- 7. LEADERBOARD_ENTRIES TABLE
CREATE TABLE leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id INT NOT NULL CHECK (competition_id >= 0 AND competition_id <= 6),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weight_lb FLOAT NOT NULL CHECK (weight_lb > 0),
  length_in FLOAT,
  catch_id UUID NOT NULL REFERENCES catches(id) ON DELETE CASCADE,
  rank INT,
  location TEXT,
  flagged_count INT DEFAULT 0 CHECK (flagged_count >= 0),
  hidden BOOLEAN DEFAULT false,
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_entry_per_catch UNIQUE(catch_id)
);

-- 8. WEEKLY_BADGES TABLE
CREATE TABLE weekly_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id INT NOT NULL CHECK (competition_id >= 0 AND competition_id <= 6),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_starting DATE NOT NULL,
  position INT NOT NULL CHECK (position IN (1, 2, 3)),
  badge_emoji TEXT NOT NULL CHECK (badge_emoji IN ('🥇', '🥈', '🥉')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(competition_id, user_id, week_starting)
);

-- 9. GENERATION_USAGE TABLE
CREATE TABLE generation_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  ai_calls_count INT DEFAULT 0 CHECK (ai_calls_count >= 0),
  uploads_count INT DEFAULT 0 CHECK (uploads_count >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, month)
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_catches_user_id ON catches(user_id);
CREATE INDEX idx_catches_created_at ON catches(created_at DESC);
CREATE INDEX idx_catches_species ON catches USING gin(species gin_trgm_ops);
CREATE INDEX idx_mount_slots_user_id ON mount_slots(user_id);
CREATE INDEX idx_mount_slots_catch_id ON mount_slots(catch_id);
CREATE INDEX idx_friendships_user_id_1 ON friendships(user_id_1);
CREATE INDEX idx_friendships_user_id_2 ON friendships(user_id_2);
CREATE INDEX idx_friend_invites_code ON friend_invites(code);
CREATE INDEX idx_friend_invites_user_id ON friend_invites(user_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_leaderboard_competition ON leaderboard_entries(competition_id, rank);
CREATE INDEX idx_leaderboard_user ON leaderboard_entries(user_id);
CREATE INDEX idx_weekly_badges_user ON weekly_badges(user_id);

-- ROW LEVEL SECURITY POLICIES

-- profiles table: public read, own update
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- catches table: own read/write only
ALTER TABLE catches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own catches"
  ON catches FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own catches"
  ON catches FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own catches"
  ON catches FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own catches"
  ON catches FOR DELETE USING (auth.uid() = user_id);

-- mount_slots table: own read/write only
ALTER TABLE mount_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mount slots"
  ON mount_slots FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mount slots"
  ON mount_slots FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mount slots"
  ON mount_slots FOR UPDATE USING (auth.uid() = user_id);

-- friendships table: can see accepted friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their friendships"
  ON friendships FOR SELECT USING (
    auth.uid() = user_id_1 OR auth.uid() = user_id_2
  );

CREATE POLICY "Users can create friendship requests"
  ON friendships FOR INSERT WITH CHECK (
    auth.uid() = user_id_1 OR auth.uid() = user_id_2
  );

CREATE POLICY "Users can update their friendships"
  ON friendships FOR UPDATE USING (
    auth.uid() = user_id_1 OR auth.uid() = user_id_2
  );

-- friend_invites table: own invites visible
ALTER TABLE friend_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their invites"
  ON friend_invites FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create invites"
  ON friend_invites FOR INSERT WITH CHECK (auth.uid() = user_id);

-- messages table: bidirectional messaging
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their messages"
  ON messages FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can send messages to friends"
  ON messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM friendships WHERE 
      (
        (user_id_1 = auth.uid() AND user_id_2 = messages.recipient_id) OR
        (user_id_2 = auth.uid() AND user_id_1 = messages.recipient_id)
      ) AND status = 'accepted'
    )
  );

-- leaderboard_entries: public read
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard entries are public"
  ON leaderboard_entries FOR SELECT USING (true);

CREATE POLICY "Users can insert leaderboard entries"
  ON leaderboard_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

-- weekly_badges: public read
ALTER TABLE weekly_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Weekly badges are public"
  ON weekly_badges FOR SELECT USING (true);

-- generation_usage: own read only
ALTER TABLE generation_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their usage"
  ON generation_usage FOR SELECT USING (auth.uid() = user_id);

-- TRIGGER FUNCTIONS
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_catches_updated_at
  BEFORE UPDATE ON catches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_mount_slots_updated_at
  BEFORE UPDATE ON mount_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_generation_usage_updated_at
  BEFORE UPDATE ON generation_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- HELPER FUNCTIONS

-- Function to get leaderboard entries for a competition
CREATE OR REPLACE FUNCTION get_leaderboard_entries(
  p_competition_id INT,
  p_location TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  rank INT,
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  weight_lb FLOAT,
  location TEXT,
  flagged_count INT,
  computed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    le.id,
    ROW_NUMBER() OVER (ORDER BY le.weight_lb DESC)::INT as rank,
    le.user_id,
    p.display_name,
    p.avatar_url,
    le.weight_lb,
    le.location,
    le.flagged_count,
    le.computed_at
  FROM leaderboard_entries le
  JOIN profiles p ON le.user_id = p.id
  WHERE le.competition_id = p_competition_id
    AND le.hidden = false
    AND le.flagged_count < 5
    AND (p_location IS NULL OR le.location = p_location)
  ORDER BY le.weight_lb DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to check upload limit
CREATE OR REPLACE FUNCTION check_upload_limit(p_user_id UUID)
RETURNS TABLE (
  can_upload BOOLEAN,
  uploads_remaining INT,
  subscription_plan TEXT
) AS $$
DECLARE
  v_plan TEXT;
  v_uploads_this_month INT;
  v_total_uploads INT;
BEGIN
  SELECT subscription_plan INTO v_plan FROM profiles WHERE id = p_user_id;
  
  SELECT COALESCE(uploads_count, 0) INTO v_uploads_this_month
  FROM generation_usage
  WHERE user_id = p_user_id AND month = DATE_TRUNC('month', NOW())::DATE;
  
  SELECT COUNT(*) INTO v_total_uploads FROM catches WHERE user_id = p_user_id;
  
  RETURN QUERY
  SELECT
    CASE
      WHEN v_plan = 'pro' THEN v_uploads_this_month < 50
      ELSE v_total_uploads < 10
    END as can_upload,
    CASE
      WHEN v_plan = 'pro' THEN (50 - v_uploads_this_month)
      ELSE (10 - v_total_uploads)
    END as uploads_remaining,
    v_plan as subscription_plan;
END;
$$ LANGUAGE plpgsql;
