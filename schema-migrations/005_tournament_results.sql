-- ============================================================
-- 005_tournament_results.sql
-- Tournament placement results: top-3 per tournament per user.
-- Drives "You Placed!" win screen, profile badges, and XP awards.
-- ============================================================

CREATE TABLE IF NOT EXISTS tournament_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   text        NOT NULL,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place           int         NOT NULL CHECK (place IN (1, 2, 3)),
  -- Snapshot of the entry that won (denormalised for display)
  catch_id        text,
  fish_photo_url  text,
  fish_species    text,
  weight_lbs      numeric(8,2),
  length_in       numeric(8,2),
  unit            text        NOT NULL DEFAULT 'in',
  tournament_name text        NOT NULL,
  -- Lifecycle
  xp_awarded      int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  seen_at         timestamptz           -- NULL = not yet seen by the user
);

-- Index for the "fetch unseen results for current user" query
CREATE INDEX IF NOT EXISTS tournament_results_user_unseen
  ON tournament_results (user_id, seen_at)
  WHERE seen_at IS NULL;

-- ── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;

-- Users can only see their own results
CREATE POLICY "Users read own results"
  ON tournament_results
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role (server-side) can insert results
CREATE POLICY "Service role inserts results"
  ON tournament_results
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Users can update seen_at on their own rows (mark as seen)
CREATE POLICY "Users mark own results seen"
  ON tournament_results
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
