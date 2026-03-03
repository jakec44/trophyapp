-- Crew System Migration
-- Run this in Supabase SQL Editor after base schema

-- 1. CREWS TABLE
CREATE TABLE IF NOT EXISTS crews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  is_private BOOLEAN DEFAULT false,
  level INT DEFAULT 1 CHECK (level >= 1),
  xp INT DEFAULT 0 CHECK (xp >= 0),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invite_code TEXT UNIQUE,
  CONSTRAINT crew_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 32)
);

-- 2. CREW_MEMBERS TABLE
CREATE TABLE IF NOT EXISTS crew_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('captain', 'officer', 'member')),
  contribution_xp INT DEFAULT 0 CHECK (contribution_xp >= 0),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(crew_id, user_id)
);

-- 3. CREW_INVITES TABLE
CREATE TABLE IF NOT EXISTS crew_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invited_phone_or_email TEXT,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- 4. CREW_CHALLENGES TABLE
CREATE TABLE IF NOT EXISTS crew_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_a_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  crew_b_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  winner_crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  score_crew_a INT DEFAULT 0 CHECK (score_crew_a >= 0),
  score_crew_b INT DEFAULT 0 CHECK (score_crew_b >= 0),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT different_crews CHECK (crew_a_id != crew_b_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_crews_created_by ON crews(created_by);
CREATE INDEX IF NOT EXISTS idx_crews_level ON crews(level DESC);
CREATE INDEX IF NOT EXISTS idx_crews_invite_code ON crews(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crew_members_crew_id ON crew_members(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_user_id ON crew_members(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_invites_crew_id ON crew_invites(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_invites_invited_user ON crew_invites(invited_user_id) WHERE invited_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crew_challenges_crew_a ON crew_challenges(crew_a_id);
CREATE INDEX IF NOT EXISTS idx_crew_challenges_crew_b ON crew_challenges(crew_b_id);
CREATE INDEX IF NOT EXISTS idx_crew_challenges_status ON crew_challenges(status);

-- RLS
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_challenges ENABLE ROW LEVEL SECURITY;

-- Crews: public read (for Find Crew), members can update
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

-- Crew members: members can read their crew
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

-- Crew invites: inviter and invitee can see
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

-- Crew challenges: participants can read
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

-- Trigger for updated_at
CREATE TRIGGER update_crews_updated_at
  BEFORE UPDATE ON crews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to generate invite code
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
