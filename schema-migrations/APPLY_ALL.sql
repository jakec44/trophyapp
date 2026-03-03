-- ============================================================
-- APPLY_ALL.sql  —  Snagged complete database setup
-- ============================================================
-- Paste this entire file into the Supabase SQL Editor and
-- click RUN. It is fully idempotent (safe to run more than once).
--
-- What this covers:
--   1.  Base schema  (tables, indexes, base RLS, triggers)
--   2.  Auto-create profile on signup
--   3.  Username + location columns
--   4.  Pro-for-all upload limits
--   5.  Lat/lng + location sharing
--   6.  Friendships: requested_by column + friend request fix
--   7.  Social: public logbook RLS
--   8.  Crew system
--   9.  Tournament results table
--  10.  Messaging + friend RLS fixes
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. EXTENSIONS
-- ════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ════════════════════════════════════════════════════════════
-- 2. BASE TABLES
-- ════════════════════════════════════════════════════════════

-- ── profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name            TEXT,
  username                TEXT UNIQUE,
  avatar_url              TEXT,
  banner_url              TEXT,
  city                    TEXT,
  state                   TEXT,
  location                TEXT,
  bio                     TEXT,
  lat                     FLOAT,
  lng                     FLOAT,
  location_sharing        BOOLEAN DEFAULT false,
  subscription_plan       TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro')),
  pro_verified            BOOLEAN DEFAULT false,
  pro_expires_at          TIMESTAMP WITH TIME ZONE,
  public                  BOOLEAN DEFAULT true,
  generation_usage_this_month INT DEFAULT 0,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add any columns that may be missing on existing installs
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lat FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lng FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_sharing BOOLEAN DEFAULT false;

-- ── catches ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catches (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  species                 TEXT NOT NULL,
  weight_lb               FLOAT NOT NULL,
  length_in               FLOAT,
  location                TEXT,
  notes                   TEXT,
  photo_url               TEXT,
  photo_thumb_url         TEXT,
  background_removed_url  TEXT,
  identified_confidence   FLOAT CHECK (identified_confidence >= 0 AND identified_confidence <= 1),
  compass_direction       TEXT,
  taken_at                TIMESTAMP WITH TIME ZONE,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at              TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_photos CHECK (photo_url IS NULL OR photo_url ~ '^https?://'),
  CONSTRAINT positive_weight CHECK (weight_lb > 0)
);

-- ── mount_slots ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mount_slots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_number  INT NOT NULL CHECK (room_number IN (1, 2, 3)),
  slot_position INT NOT NULL CHECK (slot_position >= 0 AND slot_position < 12),
  catch_id     UUID REFERENCES catches(id) ON DELETE SET NULL,
  label        TEXT,
  position_x   FLOAT DEFAULT 0.5 CHECK (position_x >= 0 AND position_x <= 1),
  position_y   FLOAT DEFAULT 0.5 CHECK (position_y >= 0 AND position_y <= 1),
  scale        FLOAT DEFAULT 1.0 CHECK (scale > 0),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, room_number, slot_position)
);

-- ── friendships ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id_1    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id_2    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT different_users CHECK (user_id_1 != user_id_2),
  CONSTRAINT ordered_pair    CHECK (user_id_1 < user_id_2),
  UNIQUE(user_id_1, user_id_2)
);

-- Add requested_by if upgrading from an older install
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ── friend_invites ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friend_invites (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code               TEXT UNIQUE NOT NULL,
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at         TIMESTAMP WITH TIME ZONE NOT NULL,
  redeemed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  redeemed_at        TIMESTAMP WITH TIME ZONE,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT code_format CHECK (code ~ '^[A-Z0-9]{6}$')
);

-- ── messages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id TEXT,
  sender_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  read_at         TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT different_users    CHECK (sender_id != recipient_id),
  CONSTRAINT non_empty_body     CHECK (LENGTH(TRIM(body)) > 0)
);

-- Fix: if conversation_id was created as UUID (old schema), convert to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages'
      AND column_name = 'conversation_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE messages
      ALTER COLUMN conversation_id TYPE TEXT USING conversation_id::TEXT;
  END IF;
END;
$$;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id TEXT;
ALTER TABLE messages ALTER COLUMN conversation_id DROP NOT NULL;

-- ── leaderboard_entries ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id INT NOT NULL CHECK (competition_id >= 0 AND competition_id <= 6),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weight_lb      FLOAT NOT NULL CHECK (weight_lb > 0),
  length_in      FLOAT,
  catch_id       UUID NOT NULL REFERENCES catches(id) ON DELETE CASCADE,
  rank           INT,
  location       TEXT,
  flagged_count  INT DEFAULT 0 CHECK (flagged_count >= 0),
  hidden         BOOLEAN DEFAULT false,
  computed_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_entry_per_catch UNIQUE(catch_id)
);

-- ── weekly_badges ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_badges (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id INT NOT NULL CHECK (competition_id >= 0 AND competition_id <= 6),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_starting  DATE NOT NULL,
  position       INT NOT NULL CHECK (position IN (1, 2, 3)),
  badge_emoji    TEXT NOT NULL CHECK (badge_emoji IN ('🥇', '🥈', '🥉')),
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(competition_id, user_id, week_starting)
);

-- ── generation_usage ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generation_usage (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month          DATE NOT NULL,
  ai_calls_count INT DEFAULT 0 CHECK (ai_calls_count >= 0),
  uploads_count  INT DEFAULT 0 CHECK (uploads_count >= 0),
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- ── tournament_results ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournament_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   text        NOT NULL,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place           int         NOT NULL CHECK (place IN (1, 2, 3)),
  catch_id        text,
  fish_photo_url  text,
  fish_species    text,
  weight_lbs      numeric(8,2),
  length_in       numeric(8,2),
  unit            text        NOT NULL DEFAULT 'in',
  tournament_name text        NOT NULL,
  xp_awarded      int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  seen_at         timestamptz
);

-- ── crews ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  avatar_url  TEXT,
  is_private  BOOLEAN DEFAULT false,
  level       INT DEFAULT 1 CHECK (level >= 1),
  xp          INT DEFAULT 0 CHECK (xp >= 0),
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invite_code TEXT UNIQUE,
  CONSTRAINT crew_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 32)
);

CREATE TABLE IF NOT EXISTS crew_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id         UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('captain', 'officer', 'member')),
  contribution_xp INT DEFAULT 0 CHECK (contribution_xp >= 0),
  joined_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(crew_id, user_id)
);

CREATE TABLE IF NOT EXISTS crew_invites (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id               UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  invited_user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invited_phone_or_email TEXT,
  invited_by            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at          TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS crew_challenges (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_a_id      UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  crew_b_id      UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  start_date     TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date       TIMESTAMP WITH TIME ZONE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  winner_crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  score_crew_a   INT DEFAULT 0 CHECK (score_crew_a >= 0),
  score_crew_b   INT DEFAULT 0 CHECK (score_crew_b >= 0),
  created_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT different_crews CHECK (crew_a_id != crew_b_id)
);


-- ════════════════════════════════════════════════════════════
-- 3. INDEXES
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_profiles_username         ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_lat_lng          ON profiles(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL AND location_sharing = true AND public = true;
CREATE INDEX IF NOT EXISTS idx_catches_user_id           ON catches(user_id);
CREATE INDEX IF NOT EXISTS idx_catches_created_at        ON catches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catches_deleted_at        ON catches(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_catches_species           ON catches USING gin(species gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mount_slots_user_id       ON mount_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_mount_slots_catch_id      ON mount_slots(catch_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id_1     ON friendships(user_id_1);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id_2     ON friendships(user_id_2);
CREATE INDEX IF NOT EXISTS idx_friendships_requested_by  ON friendships(requested_by);
CREATE INDEX IF NOT EXISTS idx_friendships_status        ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_friend_invites_code       ON friend_invites(code);
CREATE INDEX IF NOT EXISTS idx_friend_invites_user_id    ON friend_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender           ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient        ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at       ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id  ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_created ON messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_competition   ON leaderboard_entries(competition_id, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user          ON leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_badges_user        ON weekly_badges(user_id);
CREATE INDEX IF NOT EXISTS tournament_results_user_unseen ON tournament_results(user_id, seen_at) WHERE seen_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crews_created_by          ON crews(created_by);
CREATE INDEX IF NOT EXISTS idx_crews_level               ON crews(level DESC);
CREATE INDEX IF NOT EXISTS idx_crews_invite_code         ON crews(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crew_members_crew_id      ON crew_members(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_user_id      ON crew_members(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_invites_crew_id      ON crew_invites(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_invites_invited_user ON crew_invites(invited_user_id) WHERE invited_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crew_challenges_crew_a    ON crew_challenges(crew_a_id);
CREATE INDEX IF NOT EXISTS idx_crew_challenges_crew_b    ON crew_challenges(crew_b_id);
CREATE INDEX IF NOT EXISTS idx_crew_challenges_status    ON crew_challenges(status);


-- ════════════════════════════════════════════════════════════
-- 4. ROW-LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

-- ── profiles ────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are publicly readable"  ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"    ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ── catches ─────────────────────────────────────────────────
ALTER TABLE catches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own catches"               ON catches;
DROP POLICY IF EXISTS "Users can read own or public users catches" ON catches;
DROP POLICY IF EXISTS "Users can insert own catches"             ON catches;
DROP POLICY IF EXISTS "Users can update own catches"             ON catches;
DROP POLICY IF EXISTS "Users can delete own catches"             ON catches;

-- Own catches always readable; other users' catches readable if their profile is public
CREATE POLICY "Users can read own or public users catches"
  ON catches FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = catches.user_id AND pr.public = true
    )
  );

CREATE POLICY "Users can insert own catches"
  ON catches FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own catches"
  ON catches FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own catches"
  ON catches FOR DELETE USING (auth.uid() = user_id);

-- ── mount_slots ─────────────────────────────────────────────
ALTER TABLE mount_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own mount slots"   ON mount_slots;
DROP POLICY IF EXISTS "Users can insert own mount slots" ON mount_slots;
DROP POLICY IF EXISTS "Users can update own mount slots" ON mount_slots;

CREATE POLICY "Users can read own mount slots"
  ON mount_slots FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mount slots"
  ON mount_slots FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mount slots"
  ON mount_slots FOR UPDATE USING (auth.uid() = user_id);

-- ── friendships ─────────────────────────────────────────────
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their friendships"     ON friendships;
DROP POLICY IF EXISTS "Users can create friendship requests" ON friendships;
DROP POLICY IF EXISTS "Users can update their friendships"  ON friendships;

CREATE POLICY "Users can see their friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Users can create friendship requests"
  ON friendships FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id_1 OR auth.uid() = user_id_2)
    AND auth.uid() = requested_by
  );

CREATE POLICY "Users can update their friendships"
  ON friendships FOR UPDATE
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Users can delete their friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- ── friend_invites ──────────────────────────────────────────
ALTER TABLE friend_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their invites"  ON friend_invites;
DROP POLICY IF EXISTS "Users can create invites"     ON friend_invites;

CREATE POLICY "Users can see their invites"
  ON friend_invites FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create invites"
  ON friend_invites FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── messages ────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop all old policies (including the broken "must be friends" one)
DROP POLICY IF EXISTS "Users can read their messages"           ON messages;
DROP POLICY IF EXISTS "Users can send messages to friends"      ON messages;
DROP POLICY IF EXISTS "Authenticated users can send messages"   ON messages;
DROP POLICY IF EXISTS "Recipients can mark messages read"       ON messages;

CREATE POLICY "Users can read their messages"
  ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Any authenticated user can send a message as themselves (UI restricts to friends)
CREATE POLICY "Authenticated users can send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Recipients can mark messages as read
CREATE POLICY "Recipients can mark messages read"
  ON messages FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- ── leaderboard_entries ─────────────────────────────────────
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leaderboard entries are public"    ON leaderboard_entries;
DROP POLICY IF EXISTS "Users can insert leaderboard entries" ON leaderboard_entries;

CREATE POLICY "Leaderboard entries are public"
  ON leaderboard_entries FOR SELECT USING (true);

CREATE POLICY "Users can insert leaderboard entries"
  ON leaderboard_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── weekly_badges ───────────────────────────────────────────
ALTER TABLE weekly_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Weekly badges are public" ON weekly_badges;
CREATE POLICY "Weekly badges are public"
  ON weekly_badges FOR SELECT USING (true);

-- ── generation_usage ────────────────────────────────────────
ALTER TABLE generation_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their usage" ON generation_usage;
CREATE POLICY "Users can read their usage"
  ON generation_usage FOR SELECT USING (auth.uid() = user_id);

-- ── tournament_results ──────────────────────────────────────
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own results"       ON tournament_results;
DROP POLICY IF EXISTS "Service role inserts results" ON tournament_results;
DROP POLICY IF EXISTS "Users mark own results seen"  ON tournament_results;

CREATE POLICY "Users read own results"
  ON tournament_results FOR SELECT
  USING (auth.uid() = user_id);

-- App inserts results on behalf of users (e.g. when tournament ends)
-- Using auth.uid() = user_id so the app can write on behalf of the winner
CREATE POLICY "Users insert own results"
  ON tournament_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users mark own results seen"
  ON tournament_results FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── crews ───────────────────────────────────────────────────
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Crews are readable by all"            ON crews;
DROP POLICY IF EXISTS "Authenticated users can create crews" ON crews;
DROP POLICY IF EXISTS "Captains and officers can update crew" ON crews;

CREATE POLICY "Crews are readable by all"
  ON crews FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create crews"
  ON crews FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Captains and officers can update crew"
  ON crews FOR UPDATE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM crew_members cm
      WHERE cm.crew_id = crews.id AND cm.user_id = auth.uid() AND cm.role IN ('captain', 'officer')
    )
  );

DROP POLICY IF EXISTS "Crew members can read their crew members"   ON crew_members;
DROP POLICY IF EXISTS "Captains and officers can manage members"   ON crew_members;
DROP POLICY IF EXISTS "Users can join as member"                   ON crew_members;

CREATE POLICY "Crew members can read their crew members"
  ON crew_members FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM crew_members cm WHERE cm.crew_id = crew_members.crew_id AND cm.user_id = auth.uid())
  );

CREATE POLICY "Captains and officers can manage members"
  ON crew_members FOR ALL USING (
    EXISTS (
      SELECT 1 FROM crew_members cm
      WHERE cm.crew_id = crew_members.crew_id AND cm.user_id = auth.uid() AND cm.role IN ('captain', 'officer')
    )
  );

CREATE POLICY "Users can join as member"
  ON crew_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Invites visible to inviter and invitee" ON crew_invites;
DROP POLICY IF EXISTS "Officers can create invites"            ON crew_invites;
DROP POLICY IF EXISTS "Invitee can update status"              ON crew_invites;

CREATE POLICY "Invites visible to inviter and invitee"
  ON crew_invites FOR SELECT USING (
    auth.uid() = invited_by OR auth.uid() = invited_user_id
  );

CREATE POLICY "Officers can create invites"
  ON crew_invites FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM crew_members cm
      WHERE cm.crew_id = crew_invites.crew_id AND cm.user_id = auth.uid() AND cm.role IN ('captain', 'officer')
    )
  );

CREATE POLICY "Invitee can update status"
  ON crew_invites FOR UPDATE USING (auth.uid() = invited_user_id);

DROP POLICY IF EXISTS "Challenges visible to participating crews" ON crew_challenges;
DROP POLICY IF EXISTS "Captains can create challenges"            ON crew_challenges;

CREATE POLICY "Challenges visible to participating crews"
  ON crew_challenges FOR SELECT USING (
    EXISTS (SELECT 1 FROM crew_members cm WHERE cm.crew_id = crew_challenges.crew_a_id AND cm.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM crew_members cm WHERE cm.crew_id = crew_challenges.crew_b_id AND cm.user_id = auth.uid())
  );

CREATE POLICY "Captains can create challenges"
  ON crew_challenges FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (SELECT 1 FROM crew_members cm WHERE cm.crew_id = crew_challenges.crew_a_id AND cm.user_id = auth.uid() AND cm.role = 'captain')
  );


-- ════════════════════════════════════════════════════════════
-- 5. TRIGGER FUNCTIONS
-- ════════════════════════════════════════════════════════════

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile + unique username on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(COALESCE(
    split_part(NEW.email, '@', 1),
    'user'
  ), '[^a-z0-9]', '', 'g'));
  IF LENGTH(base_username) < 2 THEN
    base_username := 'user';
  END IF;

  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, display_name, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Angler'),
    final_username,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.id
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pro-for-all upload limit (50/month for everyone)
CREATE OR REPLACE FUNCTION check_upload_limit(p_user_id UUID)
RETURNS TABLE (
  can_upload BOOLEAN,
  uploads_remaining INT,
  subscription_plan TEXT
) AS $$
DECLARE
  v_uploads_this_month INT;
BEGIN
  SELECT COALESCE(uploads_count, 0) INTO v_uploads_this_month
  FROM generation_usage
  WHERE user_id = p_user_id AND month = DATE_TRUNC('month', NOW())::DATE;

  RETURN QUERY
  SELECT
    COALESCE(v_uploads_this_month, 0) < 50    AS can_upload,
    GREATEST(0, 50 - COALESCE(v_uploads_this_month, 0)) AS uploads_remaining,
    'pro'::TEXT                               AS subscription_plan;
END;
$$ LANGUAGE plpgsql;

-- Crew invite code generator
CREATE OR REPLACE FUNCTION generate_crew_invite_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  done BOOLEAN := false;
BEGIN
  WHILE NOT done LOOP
    code := upper(substring(md5(random()::text) from 1 for 6));
    IF NOT EXISTS (SELECT 1 FROM crews WHERE invite_code = code) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Leaderboard helper
CREATE OR REPLACE FUNCTION get_leaderboard_entries(
  p_competition_id INT,
  p_location TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID, rank INT, user_id UUID, display_name TEXT,
  avatar_url TEXT, weight_lb FLOAT, location TEXT,
  flagged_count INT, computed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    le.id,
    ROW_NUMBER() OVER (ORDER BY le.weight_lb DESC)::INT AS rank,
    le.user_id, p.display_name, p.avatar_url,
    le.weight_lb, le.location, le.flagged_count, le.computed_at
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


-- ════════════════════════════════════════════════════════════
-- 6. TRIGGERS (attach functions to tables)
-- ════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS on_auth_user_created        ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at  ON profiles;
DROP TRIGGER IF EXISTS update_catches_updated_at   ON catches;
DROP TRIGGER IF EXISTS update_mount_slots_updated_at ON mount_slots;
DROP TRIGGER IF EXISTS update_generation_usage_updated_at ON generation_usage;
DROP TRIGGER IF EXISTS update_crews_updated_at     ON crews;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_catches_updated_at
  BEFORE UPDATE ON catches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_mount_slots_updated_at
  BEFORE UPDATE ON mount_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_generation_usage_updated_at
  BEFORE UPDATE ON generation_usage FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_crews_updated_at
  BEFORE UPDATE ON crews FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ════════════════════════════════════════════════════════════
-- 008 — Fix messages.conversation_id type (UUID → TEXT)
-- ════════════════════════════════════════════════════════════
-- (The DO block + ADD COLUMN above in the table definition
-- already handle this idempotently — no extra SQL needed here.)

-- ════════════════════════════════════════════════════════════
-- 007 — Global XP rank: total_xp on profiles
-- ════════════════════════════════════════════════════════════

-- Add XP column so we can rank users globally
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0;

-- Fast descending index for rank queries
CREATE INDEX IF NOT EXISTS profiles_total_xp_idx
  ON profiles (total_xp DESC);

-- ════════════════════════════════════════════════════════════
-- 009 — Group Chats
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS group_chats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  image_url   TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_chat_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_chat_members_group_idx ON group_chat_members (group_id);
CREATE INDEX IF NOT EXISTS group_chat_members_user_idx  ON group_chat_members (user_id);
CREATE INDEX IF NOT EXISTS group_messages_group_idx     ON group_messages (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_messages_sender_idx    ON group_messages (sender_id);

ALTER TABLE group_chats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chat_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view their group chats"
  ON group_chats FOR SELECT
  USING (EXISTS (SELECT 1 FROM group_chat_members WHERE group_chat_members.group_id = group_chats.id AND group_chat_members.user_id = auth.uid()));

CREATE POLICY "authenticated users can create group chats"
  ON group_chats FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "members can update group chat image"
  ON group_chats FOR UPDATE
  USING (EXISTS (SELECT 1 FROM group_chat_members WHERE group_chat_members.group_id = group_chats.id AND group_chat_members.user_id = auth.uid()));

CREATE POLICY "members can view memberships"
  ON group_chat_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM group_chat_members m2 WHERE m2.group_id = group_chat_members.group_id AND m2.user_id = auth.uid()));

CREATE POLICY "authenticated users can insert members"
  ON group_chat_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "members can view group messages"
  ON group_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM group_chat_members WHERE group_chat_members.group_id = group_messages.group_id AND group_chat_members.user_id = auth.uid()));

CREATE POLICY "members can send group messages"
  ON group_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM group_chat_members WHERE group_chat_members.group_id = group_messages.group_id AND group_chat_members.user_id = auth.uid()));

-- ════════════════════════════════════════════════════════════
-- Done. All tables, indexes, RLS policies, and triggers are
-- now up to date for the Snagged app.
-- ════════════════════════════════════════════════════════════
