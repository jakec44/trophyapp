-- Trophy Room — Final Schema (after all migrations)
-- REFERENCE ONLY. Do NOT run this file directly; it documents the cumulative schema.
-- Do NOT manually edit Supabase tables in the dashboard except to RUN migrations.
-- Apply changes via new SQL migrations in supabase/migrations/.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- 1. PROFILES
-- =============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  banner_url TEXT,
  city TEXT,
  state TEXT,
  bio TEXT,
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro')),
  pro_verified BOOLEAN DEFAULT false,
  pro_expires_at TIMESTAMP WITH TIME ZONE,
  public BOOLEAN DEFAULT true,
  is_private BOOLEAN DEFAULT false,
  is_mock BOOLEAN DEFAULT false,
  generation_usage_this_month INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;

-- =============================================================================
-- 2. CATCHES
-- =============================================================================
CREATE TABLE catches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  species TEXT NOT NULL,
  weight_lb FLOAT NOT NULL,
  length_in FLOAT,
  location TEXT,
  notes TEXT,
  photo_url TEXT,
  photo_path TEXT,
  photo_thumb_url TEXT,
  background_removed_url TEXT,
  enhanced_url TEXT,
  identified_confidence FLOAT CHECK (identified_confidence >= 0 AND identified_confidence <= 1),
  compass_direction TEXT,
  taken_at TIMESTAMP WITH TIME ZONE,
  upload_status TEXT DEFAULT 'complete' CHECK (upload_status IN ('pending_upload', 'complete', 'failed')),
  ai_status TEXT DEFAULT 'done' CHECK (ai_status IN ('pending', 'done', 'failed')),
  estimated_weight_lb FLOAT,
  estimated_length_in FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_photos CHECK (photo_url IS NULL OR photo_url ~ '^https?://'),
  CONSTRAINT positive_weight CHECK (weight_lb > 0)
);

CREATE INDEX idx_catches_user_id ON catches(user_id);
CREATE INDEX idx_catches_created_at ON catches(created_at DESC);
CREATE INDEX idx_catches_species ON catches USING gin(species gin_trgm_ops);

-- =============================================================================
-- 3. STORIES
-- =============================================================================
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL DEFAULT '',
  media_path TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_stories_user_id ON stories(user_id);
CREATE INDEX idx_stories_expires_at ON stories(expires_at);

-- =============================================================================
-- 4. MOUNT_SLOTS
-- =============================================================================
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

CREATE INDEX idx_mount_slots_user_id ON mount_slots(user_id);
CREATE INDEX idx_mount_slots_catch_id ON mount_slots(catch_id);

-- =============================================================================
-- 5. FRIENDSHIPS
-- =============================================================================
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id_1 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id_2 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT different_users CHECK (user_id_1 != user_id_2),
  CONSTRAINT ordered_pair CHECK (user_id_1 < user_id_2),
  UNIQUE(user_id_1, user_id_2)
);

CREATE INDEX idx_friendships_user_id_1 ON friendships(user_id_1);
CREATE INDEX idx_friendships_user_id_2 ON friendships(user_id_2);

-- =============================================================================
-- 6. FRIEND_INVITES
-- =============================================================================
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

CREATE INDEX idx_friend_invites_code ON friend_invites(code);
CREATE INDEX idx_friend_invites_user_id ON friend_invites(user_id);

-- =============================================================================
-- 7. MESSAGES
-- =============================================================================
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

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- =============================================================================
-- 8. LEADERBOARD_ENTRIES
-- =============================================================================
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

CREATE INDEX idx_leaderboard_competition ON leaderboard_entries(competition_id, rank);
CREATE INDEX idx_leaderboard_user ON leaderboard_entries(user_id);

-- =============================================================================
-- 9. WEEKLY_BADGES
-- =============================================================================
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

CREATE INDEX idx_weekly_badges_user ON weekly_badges(user_id);

-- =============================================================================
-- 10. GENERATION_USAGE
-- =============================================================================
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

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE catches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE mount_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_usage ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, own update
CREATE POLICY "Profiles are publicly readable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Catches: owner + public/friend read
CREATE POLICY "Users can read own catches" ON catches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read public or friend catches" ON catches FOR SELECT USING (
  auth.uid() != user_id AND (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = catches.user_id AND p.public = true)
    OR EXISTS (
      SELECT 1 FROM friendships f WHERE f.status = 'accepted'
      AND ((f.user_id_1 = auth.uid() AND f.user_id_2 = catches.user_id) OR (f.user_id_2 = auth.uid() AND f.user_id_1 = catches.user_id))
    )
  )
);
CREATE POLICY "Users can insert own catches" ON catches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own catches" ON catches FOR UPDATE USING (auth.uid() = user_id);

-- Stories: see 002_stories.sql for full RLS
CREATE POLICY "Users can insert own story" ON stories FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own story" ON stories FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can read own stories" ON stories FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can read public or friend stories" ON stories FOR SELECT TO authenticated USING (
  user_id != auth.uid() AND (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = stories.user_id AND COALESCE(p.public, true) = true)
    OR EXISTS (
      SELECT 1 FROM friendships f WHERE f.status = 'accepted'
      AND ((f.user_id_1 = auth.uid() AND f.user_id_2 = stories.user_id) OR (f.user_id_2 = auth.uid() AND f.user_id_1 = stories.user_id))
    )
  )
);

-- Mount slots, friendships, friend_invites, messages, leaderboard, weekly_badges, generation_usage
-- (see root schema.sql for full policies; this file documents final structure)

-- =============================================================================
-- TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_catches_updated_at BEFORE UPDATE ON catches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_mount_slots_updated_at BEFORE UPDATE ON mount_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_generation_usage_updated_at BEFORE UPDATE ON generation_usage FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username, is_mock)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(REPLACE(NEW.id::text, '-', ''), 1, 12)),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STORAGE BUCKETS (created via migrations)
-- avatars, catch-photos, stories, banners, catches
-- =============================================================================
