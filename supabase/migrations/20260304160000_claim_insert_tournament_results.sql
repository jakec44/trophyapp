-- Allow claim_tournament_win to insert into tournament_results when awarding (user_id = auth.uid()).
-- Table may already exist from schema-migrations; ensure RLS allows insert from authenticated RPC.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tournament_results') THEN
    CREATE TABLE tournament_results (
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
    ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users read own results" ON tournament_results FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Users mark own results seen" ON tournament_results FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Policy: allow insert when row's user_id = calling user (so claim_tournament_win can insert for the winner)
DROP POLICY IF EXISTS "Service role inserts results" ON tournament_results;
DROP POLICY IF EXISTS "Users insert own result" ON tournament_results;
CREATE POLICY "Users insert own result"
  ON tournament_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update claim_tournament_win to insert into tournament_results when awarding (so placement card / TournamentWinQueue works)
CREATE OR REPLACE FUNCTION claim_tournament_win(p_tournament_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_tournament  RECORD;
  v_ended_cycle int;
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

  SELECT id, type, title, metric_type, cycle_id, last_ended_cycle_id, cycle_ends_at
  INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'tournament_not_found');
  END IF;

  IF v_tournament.cycle_ends_at > now() AND v_tournament.last_ended_cycle_id IS NULL THEN
    RETURN jsonb_build_object('status', 'tournament_not_ended');
  END IF;
  v_ended_cycle := COALESCE(v_tournament.last_ended_cycle_id, v_tournament.cycle_id);

  SELECT e.id, e.image_url, e.species, e.weight_lb, e.length_in
  INTO v_my_entry
  FROM tournament_entries e
  WHERE e.tournament_id = p_tournament_id AND e.user_id = v_user_id AND e.cycle_id = v_ended_cycle;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_winner');
  END IF;

  v_fish_url := v_my_entry.image_url;
  v_tournament_name := v_tournament.title;

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
    WHERE tournament_id = p_tournament_id AND cycle_id = v_ended_cycle
  )
  SELECT ranked.rn::int INTO v_place
  FROM ranked
  WHERE ranked.id = v_my_entry.id;

  IF v_place IS NULL OR v_place > 3 THEN
    RETURN jsonb_build_object('status', 'not_winner');
  END IF;

  SELECT * INTO v_existing
  FROM trophy_badges
  WHERE user_id = v_user_id AND tournament_id = p_tournament_id AND cycle_id = v_ended_cycle;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'claimed',
      'badge', to_jsonb(v_existing)
    );
  END IF;

  v_coins := CASE v_place WHEN 1 THEN 500 WHEN 2 THEN 300 ELSE 150 END;
  v_xp    := CASE v_place WHEN 1 THEN 500 WHEN 2 THEN 300 ELSE 150 END;
  v_tier  := CASE v_place WHEN 1 THEN 'gold' WHEN 2 THEN 'silver' ELSE 'bronze' END;

  INSERT INTO trophy_badges (
    user_id, tournament_id, entry_id, place, trophy_tier, cycle_id,
    coins_awarded, xp_awarded, fish_photo_url, tournament_name
  )
  VALUES (
    v_user_id, p_tournament_id, v_my_entry.id, v_place, v_tier, v_ended_cycle,
    v_coins, v_xp, v_fish_url, v_tournament_name
  )
  RETURNING id INTO v_badge_id;

  UPDATE profiles
  SET coins = COALESCE(coins, 0) + v_coins,
      total_xp = COALESCE(total_xp, 0) + v_xp
  WHERE id = v_user_id;

  -- Insert into tournament_results so TournamentWinQueue / placement card can show (unseen result)
  INSERT INTO tournament_results (
    tournament_id, user_id, place, catch_id, fish_photo_url, fish_species,
    weight_lbs, length_in, unit, tournament_name, xp_awarded
  )
  VALUES (
    p_tournament_id, v_user_id, v_place, NULL, v_fish_url, v_my_entry.species,
    v_my_entry.weight_lb, v_my_entry.length_in, 'in', v_tournament_name, v_xp
  );

  RETURN jsonb_build_object(
    'status', 'awarded',
    'badge', to_jsonb((
      SELECT row_to_json(t) FROM (
        SELECT id, user_id, tournament_id, entry_id, place, trophy_tier, cycle_id,
               coins_awarded, xp_awarded, fish_photo_url, tournament_name, created_at, shown_at
        FROM trophy_badges WHERE id = v_badge_id
      ) t
    ))
  );
END;
$$;
