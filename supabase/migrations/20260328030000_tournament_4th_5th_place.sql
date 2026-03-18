-- Add 4th and 5th place for tournaments: badges, XP, AR.
-- XP: 1st 500, 2nd 300, 3rd 150, 4th 100, 5th 50
-- AR: 1st +100, 2nd +60, 3rd +30, 4th +20, 5th +10, 6-10 +10, 11+ -5

-- 1. Allow place 4 and 5 in trophy_badges
ALTER TABLE trophy_badges DROP CONSTRAINT IF EXISTS trophy_badges_place_check;
ALTER TABLE trophy_badges ADD CONSTRAINT trophy_badges_place_check CHECK (place IN (1, 2, 3, 4, 5));

-- Allow trophy_tier 'fourth' and 'fifth'
ALTER TABLE trophy_badges DROP CONSTRAINT IF EXISTS trophy_badges_trophy_tier_check;
ALTER TABLE trophy_badges ADD CONSTRAINT trophy_badges_trophy_tier_check CHECK (trophy_tier IN ('gold', 'silver', 'bronze', 'fourth', 'fifth'));

-- 2. Allow place 4 and 5 in tournament_results
ALTER TABLE tournament_results DROP CONSTRAINT IF EXISTS tournament_results_place_check;
ALTER TABLE tournament_results ADD CONSTRAINT tournament_results_place_check CHECK (place IN (1, 2, 3, 4, 5));

-- 3. Allow place 4 and 5 in trophies
ALTER TABLE trophies DROP CONSTRAINT IF EXISTS trophies_place_check;
ALTER TABLE trophies ADD CONSTRAINT trophies_place_check CHECK (place IN (1, 2, 3, 4, 5));

-- 4. finalize_tournament_cycle: award top 5 with badge, XP, AR
CREATE OR REPLACE FUNCTION finalize_tournament_cycle(p_tournament_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament  RECORD;
  v_place       int;
  v_xp          int;
  v_tier        text;
  v_ar_delta    int;
  v_count       int := 0;
  v_ranked      RECORD;
BEGIN
  SELECT id, type, title, metric_type, cycle_id
  INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  FOR v_ranked IN
    WITH ranked AS (
      SELECT
        e.id AS entry_id,
        e.user_id,
        e.image_url,
        e.species,
        e.weight_lb,
        e.length_in,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE
              WHEN v_tournament.type = 'SMALLEST_FISH' THEN COALESCE(e.length_in, 999)::float
              WHEN v_tournament.metric_type = 'WEIGHT_LBS' THEN (-COALESCE(e.weight_lb, 0))::float
              ELSE (-COALESCE(e.length_in, 0))::float
            END ASC
        ) AS rn
      FROM tournament_entries e
      WHERE e.tournament_id = p_tournament_id AND e.cycle_id = v_tournament.cycle_id
    )
    SELECT ranked.entry_id, ranked.user_id, ranked.image_url, ranked.species,
           ranked.weight_lb, ranked.length_in, ranked.rn::int AS place
    FROM ranked
  LOOP
    v_place := v_ranked.place;

    v_ar_delta := CASE
      WHEN v_place = 1 THEN 100
      WHEN v_place = 2 THEN 60
      WHEN v_place = 3 THEN 30
      WHEN v_place = 4 THEN 20
      WHEN v_place = 5 THEN 10
      WHEN v_place BETWEEN 6 AND 10 THEN 10
      ELSE -5
    END;

    UPDATE profiles
    SET angler_rating = GREATEST(0, COALESCE(angler_rating, 0) + v_ar_delta)
    WHERE id = v_ranked.user_id;

    IF v_place <= 5 THEN
      v_xp   := CASE v_place WHEN 1 THEN 500 WHEN 2 THEN 300 WHEN 3 THEN 150 WHEN 4 THEN 100 ELSE 50 END;
      v_tier := CASE v_place WHEN 1 THEN 'gold' WHEN 2 THEN 'silver' WHEN 3 THEN 'bronze' WHEN 4 THEN 'fourth' ELSE 'fifth' END;

      IF EXISTS (
        SELECT 1 FROM trophy_badges
        WHERE user_id = v_ranked.user_id AND tournament_id = p_tournament_id AND cycle_id = v_tournament.cycle_id
      ) THEN
        v_count := v_count + 1;
        CONTINUE;
      END IF;

      INSERT INTO trophy_badges (
        user_id, tournament_id, entry_id, place, trophy_tier, cycle_id,
        xp_awarded, fish_photo_url, tournament_name
      )
      VALUES (
        v_ranked.user_id, p_tournament_id, v_ranked.entry_id, v_place, v_tier, v_tournament.cycle_id,
        v_xp, v_ranked.image_url, v_tournament.title
      );

      UPDATE profiles
      SET total_xp = COALESCE(total_xp, 0) + v_xp
      WHERE id = v_ranked.user_id;

      INSERT INTO tournament_results (
        tournament_id, user_id, place, catch_id, fish_photo_url, fish_species,
        weight_lbs, length_in, unit, tournament_name, xp_awarded
      )
      VALUES (
        p_tournament_id, v_ranked.user_id, v_place, NULL, v_ranked.image_url, v_ranked.species,
        v_ranked.weight_lb, v_ranked.length_in, 'in', v_tournament.title, v_xp
      );

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 5. claim_tournament_win: allow top 5, no coins, apply AR
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
  v_xp          int;
  v_ar_delta    int;
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

  IF v_place IS NULL OR v_place > 5 THEN
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

  v_xp       := CASE v_place WHEN 1 THEN 500 WHEN 2 THEN 300 WHEN 3 THEN 150 WHEN 4 THEN 100 ELSE 50 END;
  v_ar_delta := CASE v_place WHEN 1 THEN 100 WHEN 2 THEN 60 WHEN 3 THEN 30 WHEN 4 THEN 20 ELSE 10 END;
  v_tier     := CASE v_place WHEN 1 THEN 'gold' WHEN 2 THEN 'silver' WHEN 3 THEN 'bronze' WHEN 4 THEN 'fourth' ELSE 'fifth' END;

  INSERT INTO trophy_badges (
    user_id, tournament_id, entry_id, place, trophy_tier, cycle_id,
    xp_awarded, fish_photo_url, tournament_name
  )
  VALUES (
    v_user_id, p_tournament_id, v_my_entry.id, v_place, v_tier, v_ended_cycle,
    v_xp, v_fish_url, v_tournament_name
  )
  RETURNING id INTO v_badge_id;

  UPDATE profiles
  SET total_xp = COALESCE(total_xp, 0) + v_xp,
      angler_rating = GREATEST(0, COALESCE(angler_rating, 0) + v_ar_delta)
  WHERE id = v_user_id;

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
               xp_awarded, fish_photo_url, tournament_name, created_at, shown_at
        FROM trophy_badges WHERE id = v_badge_id
      ) t
    ))
  );
END;
$$;

COMMENT ON COLUMN profiles.angler_rating IS 'Competitive rating from tournament placements only. 1st +100, 2nd +60, 3rd +30, 4th +20, 5th +10, 6-10 +10, 11+ -5.';
