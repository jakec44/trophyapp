-- Daily quest progress: one row per user per UTC date.
-- Tracks fish count, unique species, tournament entry; xp_awarded_quest_ids prevents double XP.

CREATE TABLE IF NOT EXISTS daily_quest_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT (current_date AT TIME ZONE 'UTC'),
  fish_logged_count int NOT NULL DEFAULT 0,
  species_logged text[] NOT NULL DEFAULT '{}',
  entered_tournament boolean NOT NULL DEFAULT false,
  xp_awarded_quest_ids text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_quest_progress_user_date ON daily_quest_progress(user_id, date);

ALTER TABLE daily_quest_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily_quest_progress"
  ON daily_quest_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily_quest_progress"
  ON daily_quest_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily_quest_progress"
  ON daily_quest_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE daily_quest_progress IS 'Tracks daily quest progress: fish count, species, tournament entry; xp_awarded_quest_ids = quest ids we already gave XP for.';
