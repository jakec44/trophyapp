-- Seasons + Prestige system
-- Seasons: 45-day cycles, AR resets each season
-- Prestige: max 3, at level 15 can reset level to 1 and gain prestige

-- 1. seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_number int NOT NULL UNIQUE,
  name text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_seasons_dates ON seasons (start_date, end_date);

COMMENT ON TABLE seasons IS '45-day seasonal cycles. AR resets at season rollover.';

-- 2. season_results table (archive prior season standings)
CREATE TABLE IF NOT EXISTS season_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  final_ar int NOT NULL DEFAULT 0,
  final_rank bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_season_results_season ON season_results (season_id);
CREATE INDEX IF NOT EXISTS idx_season_results_user ON season_results (user_id);

COMMENT ON TABLE season_results IS 'Archived AR and rank at end of each season.';

-- 3. prestige column on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS prestige int NOT NULL DEFAULT 0;

-- Constraint: prestige 0-3
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_prestige_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_prestige_check
  CHECK (prestige >= 0 AND prestige <= 3);

COMMENT ON COLUMN profiles.prestige IS 'Prestige level (0-3). Earned by resetting from level 15 to 1.';

-- 4. RLS for seasons (read-only for everyone)
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read seasons" ON seasons;
CREATE POLICY "Anyone can read seasons"
  ON seasons FOR SELECT USING (true);

-- RLS for season_results (read-only)
ALTER TABLE season_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read season results" ON season_results;
CREATE POLICY "Anyone can read season results"
  ON season_results FOR SELECT USING (true);

-- 5. Seed first season if none exist
INSERT INTO seasons (season_number, name, start_date, end_date, is_active)
SELECT 1, 'Season 1', date_trunc('day', now())::timestamptz, date_trunc('day', now())::timestamptz + interval '45 days', true
WHERE NOT EXISTS (SELECT 1 FROM seasons LIMIT 1);
