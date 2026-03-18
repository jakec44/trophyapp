-- =============================================================================
-- Trophies (tournament wins) + user_profile_display_items (pinned badges/trophies row)
-- Trophies populated via trigger when trophy_badges rows are inserted.
-- =============================================================================

-- 1. TROPHIES (one row per user tournament win; tournament_id/entry_id text to match schema)
CREATE TABLE IF NOT EXISTS trophies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id   text NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  entry_id        text NOT NULL REFERENCES tournament_entries(id) ON DELETE CASCADE,
  place           int NOT NULL CHECK (place IN (1, 2, 3)),
  awarded_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tournament_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_trophies_user_id ON trophies(user_id);
CREATE INDEX IF NOT EXISTS idx_trophies_tournament_id ON trophies(tournament_id);

ALTER TABLE trophies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own trophies" ON trophies;
CREATE POLICY "Users read own trophies"
  ON trophies FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own trophies (dev)" ON trophies;
CREATE POLICY "Users insert own trophies (dev)"
  ON trophies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 2. USER_PROFILE_DISPLAY_ITEMS (pinned items for the profile "Trophies & Badges" row; max 5 enforced in app)
CREATE TABLE IF NOT EXISTS user_profile_display_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type   text NOT NULL CHECK (item_type IN ('badge', 'trophy')),
  badge_key   text,
  trophy_id   uuid REFERENCES trophies(id) ON DELETE CASCADE,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT display_item_badge_or_trophy CHECK (
    (item_type = 'badge' AND badge_key IS NOT NULL AND trophy_id IS NULL) OR
    (item_type = 'trophy' AND trophy_id IS NOT NULL AND badge_key IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_display_items_user_badge
  ON user_profile_display_items(user_id, badge_key)
  WHERE badge_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_display_items_user_trophy
  ON user_profile_display_items(user_id, trophy_id)
  WHERE trophy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_display_items_user_sort
  ON user_profile_display_items(user_id, sort_order, created_at);

ALTER TABLE user_profile_display_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own display items" ON user_profile_display_items;
CREATE POLICY "Users manage own display items"
  ON user_profile_display_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Trigger: when a row is inserted into trophy_badges, insert corresponding row into trophies
CREATE OR REPLACE FUNCTION sync_trophy_badge_to_trophies()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO trophies (user_id, tournament_id, entry_id, place, awarded_at)
  VALUES (NEW.user_id, NEW.tournament_id, NEW.entry_id, NEW.place, NEW.created_at)
  ON CONFLICT (user_id, tournament_id, entry_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_trophy_badge_to_trophies ON trophy_badges;
CREATE TRIGGER trg_sync_trophy_badge_to_trophies
  AFTER INSERT ON trophy_badges
  FOR EACH ROW
  EXECUTE FUNCTION sync_trophy_badge_to_trophies();

-- Backfill: insert existing trophy_badges into trophies
INSERT INTO trophies (user_id, tournament_id, entry_id, place, awarded_at)
SELECT user_id, tournament_id, entry_id, place, created_at
FROM trophy_badges
ON CONFLICT (user_id, tournament_id, entry_id) DO NOTHING;

-- 4. Dev stub: create a trophy for current user (for testing when no claim has run yet)
CREATE OR REPLACE FUNCTION create_dev_trophy(p_tournament_id text, p_entry_id text, p_place int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_place NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'place must be 1, 2, or 3';
  END IF;
  INSERT INTO trophies (user_id, tournament_id, entry_id, place, awarded_at)
  VALUES (auth.uid(), p_tournament_id, p_entry_id, p_place, now())
  ON CONFLICT (user_id, tournament_id, entry_id) DO UPDATE SET awarded_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION create_dev_trophy(text, text, int) TO authenticated;
COMMENT ON FUNCTION create_dev_trophy IS 'Dev only: create or upsert a trophy for current user for testing.';
