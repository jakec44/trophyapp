-- ============================================================
-- 010_tournaments.sql
-- Tournament entries and votes — real persistence via Supabase.
-- Enables saving tournament entries and voting.
-- ============================================================

-- 1. TOURNAMENTS (definitions)
CREATE TABLE IF NOT EXISTS tournaments (
  id          text PRIMARY KEY,
  type        text NOT NULL,
  title       text NOT NULL,
  metric_type text NOT NULL DEFAULT 'LENGTH_IN' CHECK (metric_type IN ('LENGTH_IN', 'WEIGHT_LBS', 'VOTES_UP')),
  ends_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. TOURNAMENT_ENTRIES (user submissions)
CREATE TABLE IF NOT EXISTS tournament_entries (
  id             text PRIMARY KEY,
  tournament_id  text NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  catch_id       uuid REFERENCES catches(id) ON DELETE SET NULL,
  username       text NOT NULL,
  avatar_url     text,
  image_url      text NOT NULL,
  species        text,
  weight_lb      numeric(10,2),
  length_in      numeric(10,2),
  up_votes       int NOT NULL DEFAULT 0 CHECK (up_votes >= 0),
  down_votes     int NOT NULL DEFAULT 0 CHECK (down_votes >= 0),
  user_state     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_entries_user_unique UNIQUE(tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS tournament_entries_tournament_idx ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS tournament_entries_user_idx ON tournament_entries(user_id);

-- 3. TOURNAMENT_ENTRY_VOTES (up/down votes)
CREATE TABLE IF NOT EXISTS tournament_entry_votes (
  entry_id  text NOT NULL REFERENCES tournament_entries(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote      text NOT NULL CHECK (vote IN ('UP', 'DOWN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS tournament_entry_votes_user_idx ON tournament_entry_votes(user_id);

-- ── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entry_votes ENABLE ROW LEVEL SECURITY;

-- Tournaments: public read
CREATE POLICY "Anyone can read tournaments"
  ON tournaments FOR SELECT USING (true);

-- Entries: public read; authenticated users insert/update/delete own
CREATE POLICY "Anyone can read tournament entries"
  ON tournament_entries FOR SELECT USING (true);

CREATE POLICY "Authenticated users insert own entries"
  ON tournament_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own entries"
  ON tournament_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own entries"
  ON tournament_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Votes: public read; authenticated users insert/update/delete own
CREATE POLICY "Anyone can read votes"
  ON tournament_entry_votes FOR SELECT USING (true);

CREATE POLICY "Authenticated users insert own votes"
  ON tournament_entry_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own votes"
  ON tournament_entry_votes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own votes"
  ON tournament_entry_votes FOR DELETE
  USING (auth.uid() = user_id);
