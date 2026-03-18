-- Season rollover function: archive standings, reset AR, create new season
-- Call from cron or Edge Function when current date > end_date of active season

CREATE OR REPLACE FUNCTION season_rollover()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active RECORD;
  v_next_num int;
  v_new_start timestamptz;
  v_new_end timestamptz;
  v_count int;
BEGIN
  -- Find active season whose end_date has passed
  SELECT id, season_number, name, start_date, end_date
  INTO v_active
  FROM seasons
  WHERE is_active = true AND end_date <= now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_rollover_needed', 'message', 'Active season has not ended');
  END IF;

  -- Archive final AR + rank for all users (global scope)
  INSERT INTO season_results (season_id, user_id, final_ar, final_rank)
  SELECT v_active.id, r.id, r.ar::int, r.rn
  FROM (
    SELECT
      p.id,
      COALESCE(p.angler_rating, 0) AS ar,
      ROW_NUMBER() OVER (ORDER BY COALESCE(p.angler_rating, 0) DESC)::bigint AS rn
    FROM profiles p
  ) r
  ON CONFLICT (season_id, user_id) DO UPDATE
  SET final_ar = EXCLUDED.final_ar,
      final_rank = EXCLUDED.final_rank;

  -- Reset all users' AR to 0
  UPDATE profiles SET angler_rating = 0;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark old season inactive
  UPDATE seasons SET is_active = false WHERE id = v_active.id;

  -- Create new season
  v_next_num := v_active.season_number + 1;
  v_new_start := v_active.end_date;
  v_new_end := v_new_start + interval '45 days';

  INSERT INTO seasons (season_number, name, start_date, end_date, is_active)
  VALUES (v_next_num, 'Season ' || v_next_num, v_new_start, v_new_end, true);

  RETURN jsonb_build_object(
    'status', 'success',
    'archived_season', v_active.season_number,
    'new_season', v_next_num,
    'users_reset', v_count
  );
END;
$$;

COMMENT ON FUNCTION season_rollover() IS 'Archives AR/rank to season_results, resets all angler_rating to 0, creates next season. Run via cron when active season ends.';

GRANT EXECUTE ON FUNCTION season_rollover() TO authenticated;
GRANT EXECUTE ON FUNCTION season_rollover() TO service_role;

-- Prestige RPC: user resets level to 1, XP to 0, prestige +1. Requires level 15, prestige < 3.
CREATE OR REPLACE FUNCTION prestige_now()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile RECORD;
  v_level int;
  v_xp_for_l1 int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_signed_in');
  END IF;

  SELECT total_xp, prestige, angler_rating INTO v_profile
  FROM profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'profile_not_found');
  END IF;

  -- Compute level from total_xp using LEVEL_ROADMAP logic (L1 = 0, L2 = 50, ... L15 = 6650)
  -- In app: getLevelFromXp(total_xp). We mirror here with cumulative bounds.
  v_level := 1;
  IF v_profile.total_xp >= 6650 THEN v_level := 15;
  ELSIF v_profile.total_xp >= 5100 THEN v_level := 14;
  ELSIF v_profile.total_xp >= 4400 THEN v_level := 13;
  ELSIF v_profile.total_xp >= 3750 THEN v_level := 12;
  ELSIF v_profile.total_xp >= 3150 THEN v_level := 11;
  ELSIF v_profile.total_xp >= 2600 THEN v_level := 10;
  ELSIF v_profile.total_xp >= 2100 THEN v_level := 9;
  ELSIF v_profile.total_xp >= 1650 THEN v_level := 8;
  ELSIF v_profile.total_xp >= 1250 THEN v_level := 7;
  ELSIF v_profile.total_xp >= 900 THEN v_level := 6;
  ELSIF v_profile.total_xp >= 600 THEN v_level := 5;
  ELSIF v_profile.total_xp >= 350 THEN v_level := 4;
  ELSIF v_profile.total_xp >= 150 THEN v_level := 3;
  ELSIF v_profile.total_xp >= 50 THEN v_level := 2;
  END IF;

  IF v_level < 15 THEN
    RETURN jsonb_build_object('status', 'not_eligible', 'message', 'Must be level 15 to prestige', 'level', v_level);
  END IF;

  IF COALESCE(v_profile.prestige, 0) >= 3 THEN
    RETURN jsonb_build_object('status', 'max_prestige', 'message', 'Already at max prestige (3)');
  END IF;

  -- Prestige: reset total_xp to 0, prestige +1. Level 1 = 0 XP.
  UPDATE profiles
  SET total_xp = 0,
      prestige = LEAST(3, COALESCE(prestige, 0) + 1)
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'prestige', LEAST(3, COALESCE(v_profile.prestige, 0) + 1)
  );
END;
$$;

COMMENT ON FUNCTION prestige_now() IS 'Prestige: reset level to 1 (XP to 0), prestige +1. Requires level 15, prestige < 3.';

GRANT EXECUTE ON FUNCTION prestige_now() TO authenticated;
