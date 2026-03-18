-- =============================================================================
-- Paste this ENTIRE script in Supabase Dashboard → SQL Editor → New query → Run
-- Adds angler_rating column + leaderboard RPC (correct param order for PostgREST)
-- =============================================================================

-- 1. Add angler_rating and state to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS angler_rating int NOT NULL DEFAULT 0;
UPDATE profiles SET angler_rating = 0 WHERE angler_rating IS NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state text;
CREATE INDEX IF NOT EXISTS idx_profiles_angler_rating_desc ON profiles (angler_rating DESC NULLS LAST);

-- 2. finalize_tournament_cycle: apply AR for all entrants (1st +100, 2nd +60, 3rd +30, 4-10 +10, 11+ -5)
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

  IF NOT FOUND THEN RETURN 0; END IF;

  FOR v_ranked IN
    WITH ranked AS (
      SELECT e.id AS entry_id, e.user_id, e.image_url, e.species, e.weight_lb, e.length_in,
        ROW_NUMBER() OVER (
          ORDER BY CASE
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
    v_ar_delta := CASE WHEN v_place = 1 THEN 100 WHEN v_place = 2 THEN 60 WHEN v_place = 3 THEN 30
                       WHEN v_place BETWEEN 4 AND 10 THEN 10 ELSE -5 END;

    UPDATE profiles
    SET angler_rating = GREATEST(0, COALESCE(angler_rating, 0) + v_ar_delta)
    WHERE id = v_ranked.user_id;

    IF v_place <= 3 THEN
      v_xp   := CASE v_place WHEN 1 THEN 500 WHEN 2 THEN 300 ELSE 150 END;
      v_tier := CASE v_place WHEN 1 THEN 'gold' WHEN 2 THEN 'silver' ELSE 'bronze' END;

      IF EXISTS (SELECT 1 FROM trophy_badges
                 WHERE user_id = v_ranked.user_id AND tournament_id = p_tournament_id AND cycle_id = v_tournament.cycle_id) THEN
        v_count := v_count + 1;
        CONTINUE;
      END IF;

      INSERT INTO trophy_badges (user_id, tournament_id, entry_id, place, trophy_tier, cycle_id, xp_awarded, fish_photo_url, tournament_name)
      VALUES (v_ranked.user_id, p_tournament_id, v_ranked.entry_id, v_place, v_tier, v_tournament.cycle_id, v_xp, v_ranked.image_url, v_tournament.title);

      UPDATE profiles SET total_xp = COALESCE(total_xp, 0) + v_xp WHERE id = v_ranked.user_id;

      INSERT INTO tournament_results (tournament_id, user_id, place, catch_id, fish_photo_url, fish_species, weight_lbs, length_in, unit, tournament_name, xp_awarded)
      VALUES (p_tournament_id, v_ranked.user_id, v_place, NULL, v_ranked.image_url, v_ranked.species, v_ranked.weight_lb, v_ranked.length_in, 'in', v_tournament.title, v_xp);

      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 3. claim_tournament_win: apply AR when creating new badge
CREATE OR REPLACE FUNCTION claim_tournament_win(p_tournament_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid; v_tournament RECORD; v_ended_cycle int; v_my_entry RECORD; v_place int;
  v_xp int; v_ar_delta int; v_tier text; v_fish_url text; v_tournament_name text; v_existing RECORD; v_badge_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('status', 'not_signed_in'); END IF;

  SELECT id, type, title, metric_type, cycle_id, last_ended_cycle_id, cycle_ends_at INTO v_tournament
  FROM tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'tournament_not_found'); END IF;
  IF v_tournament.cycle_ends_at > now() AND v_tournament.last_ended_cycle_id IS NULL THEN
    RETURN jsonb_build_object('status', 'tournament_not_ended');
  END IF;
  v_ended_cycle := COALESCE(v_tournament.last_ended_cycle_id, v_tournament.cycle_id);

  SELECT e.id, e.image_url, e.species, e.weight_lb, e.length_in INTO v_my_entry
  FROM tournament_entries e
  WHERE e.tournament_id = p_tournament_id AND e.user_id = v_user_id AND e.cycle_id = v_ended_cycle;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_winner'); END IF;

  v_fish_url := v_my_entry.image_url;
  v_tournament_name := v_tournament.title;

  WITH ranked AS (
    SELECT id, user_id,
      ROW_NUMBER() OVER (ORDER BY CASE
        WHEN v_tournament.type = 'SMALLEST_FISH' THEN COALESCE(length_in, 999)::float
        WHEN v_tournament.metric_type = 'WEIGHT_LBS' THEN (-COALESCE(weight_lb, 0))::float
        ELSE (-COALESCE(length_in, 0))::float END ASC) AS rn
    FROM tournament_entries
    WHERE tournament_id = p_tournament_id AND cycle_id = v_ended_cycle
  )
  SELECT ranked.rn::int INTO v_place FROM ranked WHERE ranked.id = v_my_entry.id;

  IF v_place IS NULL OR v_place > 3 THEN RETURN jsonb_build_object('status', 'not_winner'); END IF;

  SELECT * INTO v_existing FROM trophy_badges
  WHERE user_id = v_user_id AND tournament_id = p_tournament_id AND cycle_id = v_ended_cycle;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'claimed', 'badge', to_jsonb(v_existing));
  END IF;

  v_xp       := CASE v_place WHEN 1 THEN 500 WHEN 2 THEN 300 ELSE 150 END;
  v_ar_delta := CASE v_place WHEN 1 THEN 100 WHEN 2 THEN 60 ELSE 30 END;
  v_tier     := CASE v_place WHEN 1 THEN 'gold' WHEN 2 THEN 'silver' ELSE 'bronze' END;

  INSERT INTO trophy_badges (user_id, tournament_id, entry_id, place, trophy_tier, cycle_id, xp_awarded, fish_photo_url, tournament_name)
  VALUES (v_user_id, p_tournament_id, v_my_entry.id, v_place, v_tier, v_ended_cycle, v_xp, v_fish_url, v_tournament_name)
  RETURNING id INTO v_badge_id;

  UPDATE profiles
  SET total_xp = COALESCE(total_xp, 0) + v_xp,
      angler_rating = GREATEST(0, COALESCE(angler_rating, 0) + v_ar_delta)
  WHERE id = v_user_id;

  RETURN jsonb_build_object('status', 'awarded', 'badge', to_jsonb((
    SELECT row_to_json(t) FROM (
      SELECT id, user_id, tournament_id, entry_id, place, trophy_tier, cycle_id, xp_awarded, fish_photo_url, tournament_name, created_at, shown_at
      FROM trophy_badges WHERE id = v_badge_id
    ) t
  )));
END;
$$;

-- 4. Leaderboard RPC — param order (p_limit_n, p_scope, p_state_filter) so PostgREST finds it
DROP FUNCTION IF EXISTS get_angler_leaderboard(text, text, int);

CREATE OR REPLACE FUNCTION get_angler_leaderboard(
  p_limit_n int DEFAULT 100,
  p_scope text DEFAULT 'global',
  p_state_filter text DEFAULT NULL
)
RETURNS TABLE (rank bigint, id uuid, username text, display_name text, avatar_url text, angler_rating int, wins bigint, podiums bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH stats AS (
    SELECT p.id, p.username, p.display_name, p.avatar_url,
      COALESCE(p.angler_rating, 0) AS ar,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place = 1) AS wins,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place <= 3) AS podiums
    FROM profiles p
    WHERE (p_scope = 'global')
       OR (p_scope = 'local' AND (p_state_filter IS NULL OR trim(COALESCE(p_state_filter, '')) = ''))
       OR (p_scope = 'local' AND p_state_filter IS NOT NULL AND trim(p_state_filter) <> '' AND p.state IS NOT NULL AND trim(p.state) = trim(p_state_filter))
  )
  SELECT ROW_NUMBER() OVER (ORDER BY s.ar DESC, s.wins DESC NULLS LAST)::bigint, s.id, s.username, s.display_name, s.avatar_url, s.ar::int, s.wins, s.podiums
  FROM stats s
  ORDER BY s.ar DESC, s.wins DESC NULLS LAST
  LIMIT p_limit_n;
$$;

GRANT EXECUTE ON FUNCTION get_angler_leaderboard(int, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_angler_leaderboard(int, text, text) TO anon;

-- 5. get_angler_rank for profile/leaderboard "your rank"
CREATE OR REPLACE FUNCTION get_angler_rank(p_user_id uuid, p_scope text DEFAULT 'global', p_state_filter text DEFAULT NULL)
RETURNS TABLE (rank bigint, angler_rating int, wins bigint, podiums bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ordered AS (
    SELECT p.id, COALESCE(p.angler_rating, 0) AS ar,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place = 1) AS w,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place <= 3) AS pod
    FROM profiles p
    WHERE (p_scope = 'global')
       OR (p_scope = 'local' AND (p_state_filter IS NULL OR trim(COALESCE(p_state_filter, '')) = ''))
       OR (p_scope = 'local' AND p_state_filter IS NOT NULL AND trim(p_state_filter) <> '' AND p.state IS NOT NULL AND trim(p.state) = trim(p_state_filter))
  ),
  ranked AS (
    SELECT o.id, o.ar, o.w, o.pod, ROW_NUMBER() OVER (ORDER BY o.ar DESC, o.w DESC NULLS LAST)::bigint AS rn FROM ordered o
  )
  SELECT r.rn AS rank, r.ar::int AS angler_rating, r.w AS wins, r.pod AS podiums FROM ranked r WHERE r.id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION get_angler_rank(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_angler_rank(uuid, text, text) TO anon;
