-- =============================================================================
-- Tournament Winner system: trophy_badges, claim RPC, rewards (coins + XP)
-- Rewards: 1st 500 coins + 500 XP (gold), 2nd 300+300 (silver), 3rd 150+150 (bronze)
-- =============================================================================

-- 1. Ensure profiles has total_xp and coins for server-side rewards
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_xp INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coins INT NOT NULL DEFAULT 0;

-- 2. Trophy badges table (tournament_id and entry_id are TEXT to match existing schema)
CREATE TABLE IF NOT EXISTS trophy_badges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id   text NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  entry_id        text NOT NULL REFERENCES tournament_entries(id) ON DELETE CASCADE,
  place           int NOT NULL CHECK (place IN (1, 2, 3)),
  trophy_tier     text NOT NULL CHECK (trophy_tier IN ('gold', 'silver', 'bronze')),
  coins_awarded   int NOT NULL,
  xp_awarded      int NOT NULL,
  fish_photo_url   text,
  tournament_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  shown_at        timestamptz,
  UNIQUE(user_id, tournament_id)
);

CREATE INDEX IF NOT EXISTS idx_trophy_badges_user_created
  ON trophy_badges(user_id, created_at DESC);

ALTER TABLE trophy_badges ENABLE ROW LEVEL SECURITY;

-- Users can read only their own badges
DROP POLICY IF EXISTS "Users read own trophy badges" ON trophy_badges;
CREATE POLICY "Users read own trophy badges"
  ON trophy_badges FOR SELECT
  USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE by users; only via RPCs
DROP POLICY IF EXISTS "No user insert trophy badges" ON trophy_badges;
CREATE POLICY "No user insert trophy badges"
  ON trophy_badges FOR INSERT
  WITH CHECK (false);

-- No direct UPDATE by users; shown_at is set only via set_trophy_shown RPC
DROP POLICY IF EXISTS "No user update trophy badges" ON trophy_badges;
CREATE POLICY "No user update trophy badges"
  ON trophy_badges FOR UPDATE
  USING (false);

-- 3. RPC: claim_tournament_win(p_tournament_id)
-- Returns badge row if top-3 and (new or existing); status 'not_winner' if place > 3
CREATE OR REPLACE FUNCTION claim_tournament_win(p_tournament_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_tournament  RECORD;
  v_my_entry    RECORD;
  v_place       int;
  v_coins       int;
  v_xp          int;
  v_tier        text;
  v_fish_url    text;
  v_tournament_name text;
  v_existing    RECORD;
  v_badge_id    uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_signed_in');
  END IF;

  SELECT id, type, title, metric_type, ends_at
  INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'tournament_not_found');
  END IF;

  IF v_tournament.ends_at IS NULL OR v_tournament.ends_at > now() THEN
    RETURN jsonb_build_object('status', 'tournament_not_ended');
  END IF;

  SELECT e.id, e.image_url, e.species, e.weight_lb, e.length_in
  INTO v_my_entry
  FROM tournament_entries e
  WHERE e.tournament_id = p_tournament_id AND e.user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_winner');
  END IF;

  v_fish_url := v_my_entry.image_url;
  v_tournament_name := v_tournament.title;

  -- Compute final place: SMALLEST_FISH = ascending length; else descending weight or length
  WITH ranked AS (
    SELECT
      id,
      user_id,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE
            WHEN v_tournament.type = 'SMALLEST_FISH' THEN COALESCE(length_in, 999)::float
            WHEN v_tournament.metric_type = 'WEIGHT_LBS' THEN (-COALESCE(weight_lb, 0))::float
            ELSE (-COALESCE(length_in, 0))::float
          END ASC
      ) AS rn
    FROM tournament_entries
    WHERE tournament_id = p_tournament_id
  )
  SELECT ranked.rn::int INTO v_place
  FROM ranked
  WHERE ranked.id = v_my_entry.id;

  IF v_place IS NULL OR v_place > 3 THEN
    RETURN jsonb_build_object('status', 'not_winner');
  END IF;

  -- Already claimed?
  SELECT * INTO v_existing
  FROM trophy_badges
  WHERE user_id = v_user_id AND tournament_id = p_tournament_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'claimed',
      'badge', to_jsonb(v_existing)
    );
  END IF;

  -- Rewards: 1st 500/500/gold, 2nd 300/300/silver, 3rd 150/150/bronze
  v_coins := CASE v_place WHEN 1 THEN 500 WHEN 2 THEN 300 ELSE 150 END;
  v_xp    := CASE v_place WHEN 1 THEN 500 WHEN 2 THEN 300 ELSE 150 END;
  v_tier  := CASE v_place WHEN 1 THEN 'gold' WHEN 2 THEN 'silver' ELSE 'bronze' END;

  INSERT INTO trophy_badges (
    user_id, tournament_id, entry_id, place, trophy_tier,
    coins_awarded, xp_awarded, fish_photo_url, tournament_name
  )
  VALUES (
    v_user_id, p_tournament_id, v_my_entry.id, v_place, v_tier,
    v_coins, v_xp, v_fish_url, v_tournament_name
  )
  RETURNING id INTO v_badge_id;

  UPDATE profiles
  SET coins = COALESCE(coins, 0) + v_coins,
      total_xp = COALESCE(total_xp, 0) + v_xp
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'status', 'awarded',
    'badge', to_jsonb((
      SELECT row_to_json(t) FROM (
        SELECT id, user_id, tournament_id, entry_id, place, trophy_tier,
               coins_awarded, xp_awarded, fish_photo_url, tournament_name, created_at, shown_at
        FROM trophy_badges WHERE id = v_badge_id
      ) t
    ))
  );
END;
$$;

COMMENT ON FUNCTION claim_tournament_win(text) IS 'Claim tournament win reward if user placed top 3. Idempotent.';
GRANT EXECUTE ON FUNCTION claim_tournament_win(text) TO authenticated;

-- 4. RPC: set_trophy_shown(p_badge_id uuid) — mark badge as shown so winner screen does not reappear
CREATE OR REPLACE FUNCTION set_trophy_shown(p_badge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE trophy_badges
  SET shown_at = now()
  WHERE id = p_badge_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION set_trophy_shown(uuid) TO authenticated;

-- No-op so migration runner has no empty final statement
SELECT 1;
