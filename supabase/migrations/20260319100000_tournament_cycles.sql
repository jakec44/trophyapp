-- =============================================================================
-- Server-authoritative tournament timing + automatic resets (cycles)
-- Source of truth: cycle_starts_at, cycle_ends_at, duration_minutes.
-- Resets roll cycle forward and keep history via cycle_id (badges still work).
-- =============================================================================

-- 1. TOURNAMENTS: add cycle and timing columns
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS template_key text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cycle_id int NOT NULL DEFAULT 1;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS last_ended_cycle_id int;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cycle_starts_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cycle_ends_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS duration_minutes int;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Backfill: derive from existing ends_at, set template_key and durations
UPDATE tournaments SET
  template_key = CASE id
    WHEN 'biggest-fish-this-week' THEN 'biggest_fish'
    WHEN 'tournament-bass' THEN 'bass'
    WHEN 'tournament-tarpon' THEN 'tarpon'
    WHEN 'tournament-snook' THEN 'snook'
    WHEN 'tournament-redfish' THEN 'redfish'
    WHEN 'tournament-flounder' THEN 'flounder'
    WHEN 'tournament-striper' THEN 'striper'
    WHEN 'tournament-smallest' THEN 'smallest_fish'
    ELSE id
  END,
  cycle_starts_at = COALESCE(ends_at - interval '5 days', now()),
  cycle_ends_at = COALESCE(ends_at, now() + interval '5 days'),
  duration_minutes = CASE
    WHEN id IN ('tournament-bass', 'tournament-tarpon', 'tournament-snook') THEN 1440
    ELSE 2880
  END
WHERE cycle_starts_at IS NULL OR cycle_ends_at IS NULL OR duration_minutes IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE tournaments
  ALTER COLUMN cycle_starts_at SET NOT NULL,
  ALTER COLUMN cycle_ends_at SET NOT NULL,
  ALTER COLUMN duration_minutes SET NOT NULL;

-- Biggest fish: default 2880 in migration; use force_restart_tournament('biggest_fish', 10) in dev for 10-min test
UPDATE tournaments SET duration_minutes = 2880 WHERE id = 'biggest-fish-this-week' AND (duration_minutes IS NULL OR duration_minutes = 0);

CREATE INDEX IF NOT EXISTS idx_tournaments_cycle_ends_at ON tournaments(cycle_ends_at ASC) WHERE is_active = true;

-- 2. TOURNAMENT_ENTRIES: add cycle_id (one entry per user per tournament per cycle)
ALTER TABLE tournament_entries ADD COLUMN IF NOT EXISTS cycle_id int NOT NULL DEFAULT 1;
UPDATE tournament_entries SET cycle_id = 1 WHERE cycle_id IS NULL OR cycle_id = 0;

CREATE UNIQUE INDEX IF NOT EXISTS tournament_entries_tournament_cycle_user_key
  ON tournament_entries(tournament_id, cycle_id, user_id);

-- 3. TROPHY_BADGES: add cycle_id (one badge per user per tournament per cycle)
ALTER TABLE trophy_badges ADD COLUMN IF NOT EXISTS cycle_id int NOT NULL DEFAULT 1;
UPDATE trophy_badges SET cycle_id = 1 WHERE cycle_id IS NULL OR cycle_id = 0;

ALTER TABLE trophy_badges DROP CONSTRAINT IF EXISTS trophy_badges_user_id_tournament_id_key;
ALTER TABLE trophy_badges DROP CONSTRAINT IF EXISTS "trophy_badges_user_id_tournament_id_key";
-- Unique per (user, tournament, cycle)
CREATE UNIQUE INDEX IF NOT EXISTS trophy_badges_user_tournament_cycle_key
  ON trophy_badges(user_id, tournament_id, cycle_id);

-- 4. reset_expired_tournaments(): roll cycle forward for tournaments where cycle_ends_at <= now()
CREATE OR REPLACE FUNCTION reset_expired_tournaments()
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
    SELECT id, cycle_id, cycle_ends_at, duration_minutes
    FROM tournaments
    WHERE is_active = true AND cycle_ends_at <= now()
  LOOP
    UPDATE tournaments
    SET last_ended_cycle_id = r.cycle_id,
        cycle_id = r.cycle_id + 1,
        cycle_starts_at = r.cycle_ends_at,
        cycle_ends_at = r.cycle_ends_at + (r.duration_minutes || ' minutes')::interval
    WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
COMMENT ON FUNCTION reset_expired_tournaments() IS 'Rolls cycle forward for expired tournaments. Call via pg_cron or Edge Function.';

-- 5. claim_tournament_win: use ended cycle; rank entries by cycle_id; badge per (user, tournament, cycle)
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

  -- Allow claim when current cycle has ended (cycle_ends_at <= now) OR reset already ran (last_ended_cycle_id set)
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

-- 6. create_tournament_entry: use current cycle_id from tournaments; replace entry in current cycle
CREATE OR REPLACE FUNCTION create_tournament_entry(
  p_id text,
  p_tournament_id text,
  p_catch_id uuid DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_image_url text DEFAULT '',
  p_species text DEFAULT NULL,
  p_weight_lb numeric DEFAULT NULL,
  p_length_in numeric DEFAULT NULL,
  p_user_state text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_tournament RECORD;
  v_count     int;
  v_row       RECORD;
  v_username  text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to enter a tournament';
  END IF;

  SELECT id, cycle_id, cycle_ends_at INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;
  IF v_tournament.cycle_ends_at <= now() THEN
    RAISE EXCEPTION 'Tournament cycle has ended; wait for next cycle';
  END IF;

  v_username := NULLIF(TRIM(COALESCE(p_username, '')), '');
  IF v_username IS NULL THEN
    SELECT COALESCE(display_name, username, 'Angler') INTO v_username
    FROM profiles WHERE id = v_user_id;
  END IF;

  -- Free tier: one entry per user per tournament per cycle
  IF NOT is_pro(v_user_id) THEN
    SELECT COUNT(*)::int INTO v_count
    FROM tournament_entries
    WHERE tournament_id = p_tournament_id AND user_id = v_user_id AND cycle_id = v_tournament.cycle_id;
    IF v_count >= 1 THEN
      RAISE EXCEPTION 'FREE_TOURNAMENT_LIMIT: Pro unlocks unlimited tournament entries';
    END IF;
  END IF;

  -- Replace: delete existing entry for this user in this cycle
  DELETE FROM tournament_entries
  WHERE tournament_id = p_tournament_id AND user_id = v_user_id AND cycle_id = v_tournament.cycle_id;

  INSERT INTO tournament_entries (
    id, tournament_id, user_id, cycle_id, catch_id, username, avatar_url, image_url,
    species, weight_lb, length_in, up_votes, down_votes, user_state
  )
  VALUES (
    p_id, p_tournament_id, v_user_id, v_tournament.cycle_id, p_catch_id, v_username, p_avatar_url,
    COALESCE(NULLIF(TRIM(p_image_url), ''), ''),
    p_species, p_weight_lb, p_length_in, 0, 0, p_user_state
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

-- 7. force_restart_tournament (dev/testing): set cycle to end now and run reset so new cycle starts with given duration
--    Call only from service role or dev tooling. Restricts duration <= 60 to reduce prod misuse.
CREATE OR REPLACE FUNCTION force_restart_tournament(p_template_key text, p_duration_minutes int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_prev_ends timestamptz;
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

  UPDATE tournaments
  SET cycle_ends_at = now(),
      duration_minutes = p_duration_minutes
  WHERE id = v_id;

  PERFORM reset_expired_tournaments();

  RETURN jsonb_build_object('ok', true, 'tournament_id', v_id, 'duration_minutes', p_duration_minutes);
END;
$$;
COMMENT ON FUNCTION force_restart_tournament(text, int) IS 'Dev/test only: end current cycle now and start new cycle with duration_minutes (max 60).';

GRANT EXECUTE ON FUNCTION reset_expired_tournaments() TO authenticated;
GRANT EXECUTE ON FUNCTION force_restart_tournament(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION force_restart_tournament(text, int) TO service_role;

-- 8. pg_cron: run reset every minute (testing). For production use '*/5 * * * *' (every 5 min).
--    Enable pg_cron in Supabase Dashboard (Database > Extensions) then run:
--    SELECT cron.schedule('reset_expired_tournaments', '* * * * *', $$SELECT reset_expired_tournaments()$$);
--    To switch to every 5 min: SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'reset_expired_tournaments'), job_schedule := '*/5 * * * *');

-- =============================================================================
-- HOW TO TEST (10-minute Biggest Fish cycle)
-- =============================================================================
-- 1. Apply this migration (supabase db push or run the SQL).
-- 2. Enable pg_cron (Dashboard > Database > Extensions > pg_cron).
-- 3. Schedule the job (SQL Editor): SELECT cron.schedule('reset_expired_tournaments', '* * * * *', $$SELECT reset_expired_tournaments()$$);
-- 4. In the app (dev only): call forceRestartTournament('biggest_fish', 10) (e.g. from a dev menu or console).
--    This ends the current cycle now and starts a new 10-minute cycle.
-- 5. Enter the Biggest Fish tournament, wait ~10 minutes (or run force_restart again to end early).
-- 6. When cycle_ends_at passes, the cron runs reset_expired_tournaments(); next app open (or foreground)
--    triggers useTournamentWinCheck -> claim_tournament_win -> winner screen if you placed top 3.
-- 7. Confirm tournament resets: cycle_id increments, new entries use the new cycle_id, countdown shows
--    the new cycle_ends_at (same for all users).
