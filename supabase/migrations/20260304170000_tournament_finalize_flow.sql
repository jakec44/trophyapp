-- =============================================================================
-- Tournament finalization: server-side flow when a cycle ends
-- 1. finalize_tournament_cycle(tournament_id) — rank entries, award top 3, write results
-- 2. finalize_ended_tournaments() — finalize all tournaments where cycle_ends_at <= now()
-- 3. reset_expired_tournaments() — already exists; advances cycle (run AFTER finalize)
-- 4. force_restart_tournament — now runs finalize for current cycle, then end + reset
--
-- CRON (required): Run every minute so "Ended" tournaments get processed.
--   Option A — pg_cron (Dashboard > Database > Extensions > pg_cron, then SQL):
--     SELECT cron.schedule('run_tournament_cycle_end', '* * * * *', $$SELECT run_tournament_cycle_end()$$);
--   Option B — Edge Function: invoke run_tournament_cycle_end() every minute (e.g. Supabase cron trigger).
-- =============================================================================

-- Allow backend (postgres/cron) to insert into tournament_results for any winner
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Backend insert tournament results" ON tournament_results;
CREATE POLICY "Backend insert tournament results"
  ON tournament_results FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
  );

-- Allow backend to insert into trophy_badges (finalize_tournament_cycle); existing "No user insert" stays for client
DROP POLICY IF EXISTS "Backend insert trophy badges" ON trophy_badges;
CREATE POLICY "Backend insert trophy badges"
  ON trophy_badges FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
  );

-- Finalize one tournament's current cycle: rank entries, award top 3 (trophy_badges + tournament_results + profiles)
CREATE OR REPLACE FUNCTION finalize_tournament_cycle(p_tournament_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament  RECORD;
  v_place       int;
  v_coins       int;
  v_xp          int;
  v_tier        text;
  v_count       int := 0;
  v_entry       RECORD;
  v_ranked      RECORD;
BEGIN
  SELECT id, type, title, metric_type, cycle_id
  INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Top 3 for this cycle (same ranking as claim_tournament_win)
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
    WHERE ranked.rn <= 3
  LOOP
    v_place := v_ranked.place;
    v_coins := CASE v_place WHEN 1 THEN 500 WHEN 2 THEN 300 ELSE 150 END;
    v_xp    := CASE v_place WHEN 1 THEN 500 WHEN 2 THEN 300 ELSE 150 END;
    v_tier  := CASE v_place WHEN 1 THEN 'gold' WHEN 2 THEN 'silver' ELSE 'bronze' END;

    -- Skip if already awarded (idempotent)
    IF EXISTS (
      SELECT 1 FROM trophy_badges
      WHERE user_id = v_ranked.user_id AND tournament_id = p_tournament_id AND cycle_id = v_tournament.cycle_id
    ) THEN
      CONTINUE;
    END IF;

    -- Insert trophy_badges
    INSERT INTO trophy_badges (
      user_id, tournament_id, entry_id, place, trophy_tier, cycle_id,
      coins_awarded, xp_awarded, fish_photo_url, tournament_name
    )
    VALUES (
      v_ranked.user_id, p_tournament_id, v_ranked.entry_id, v_place, v_tier, v_tournament.cycle_id,
      v_coins, v_xp, v_ranked.image_url, v_tournament.title
    );

    -- Update profiles (coins + XP)
    UPDATE profiles
    SET coins = COALESCE(coins, 0) + v_coins,
        total_xp = COALESCE(total_xp, 0) + v_xp
    WHERE id = v_ranked.user_id;

    -- Insert tournament_results (for TournamentWinQueue / placement card)
    INSERT INTO tournament_results (
      tournament_id, user_id, place, catch_id, fish_photo_url, fish_species,
      weight_lbs, length_in, unit, tournament_name, xp_awarded
    )
    VALUES (
      p_tournament_id, v_ranked.user_id, v_place, NULL, v_ranked.image_url, v_ranked.species,
      v_ranked.weight_lb, v_ranked.length_in, 'in', v_tournament.title, v_xp
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
COMMENT ON FUNCTION finalize_tournament_cycle(text) IS 'Server-side: rank entries for current cycle, award top 3 (trophy_badges, tournament_results, profiles). Idempotent.';

-- Finalize all tournaments that have ended (cycle_ends_at <= now()) and not yet advanced
CREATE OR REPLACE FUNCTION finalize_ended_tournaments()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  n int := 0;
BEGIN
  FOR r IN
    SELECT id
    FROM tournaments
    WHERE is_active = true
      AND cycle_ends_at <= now()
      AND last_ended_cycle_id IS NULL
  LOOP
    n := n + finalize_tournament_cycle(r.id);
  END LOOP;
  RETURN n;
END;
$$;
COMMENT ON FUNCTION finalize_ended_tournaments() IS 'Finalize all ended tournaments (award top 3). Run before reset_expired_tournaments() in cron.';

-- Single job that runs finalize then reset (for pg_cron: run this every minute)
CREATE OR REPLACE FUNCTION run_tournament_cycle_end()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_finalized int;
  v_reset     int;
BEGIN
  v_finalized := finalize_ended_tournaments();
  v_reset     := reset_expired_tournaments();
  RETURN jsonb_build_object('finalized_count', v_finalized, 'reset_count', v_reset);
END;
$$;
COMMENT ON FUNCTION run_tournament_cycle_end() IS 'Cron entrypoint: finalize ended tournaments (award winners), then advance cycles. Schedule: * * * * * (every minute).';

-- Dev button: finalize current cycle for this tournament, THEN end timer and run reset
CREATE OR REPLACE FUNCTION force_restart_tournament(p_template_key text, p_duration_minutes int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_prev_ends timestamptz;
  v_finalized int;
BEGIN
  IF p_duration_minutes > 60 THEN
    RAISE EXCEPTION 'force_restart_tournament: duration must be <= 60 minutes (dev only)';
  END IF;

  SELECT id, cycle_ends_at INTO v_id, v_prev_ends
  FROM tournaments
  WHERE template_key = p_template_key AND is_active = true
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tournament not found');
  END IF;

  -- 1) Finalize current cycle (calculate winners, award badges + tournament_results)
  v_finalized := finalize_tournament_cycle(v_id);

  -- 2) End current cycle and advance to next
  UPDATE tournaments
  SET cycle_ends_at = now(),
      duration_minutes = p_duration_minutes
  WHERE id = v_id;

  PERFORM reset_expired_tournaments();

  RETURN jsonb_build_object(
    'ok', true,
    'tournament_id', v_id,
    'duration_minutes', p_duration_minutes,
    'winners_awarded', v_finalized
  );
END;
$$;
COMMENT ON FUNCTION force_restart_tournament(text, int) IS 'Dev/test: finalize current cycle (award top 3), then end cycle and start new one.';

GRANT EXECUTE ON FUNCTION finalize_tournament_cycle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_tournament_cycle(text) TO service_role;
GRANT EXECUTE ON FUNCTION finalize_ended_tournaments() TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_ended_tournaments() TO service_role;
GRANT EXECUTE ON FUNCTION run_tournament_cycle_end() TO service_role;
GRANT EXECUTE ON FUNCTION run_tournament_cycle_end() TO postgres;
