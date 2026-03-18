-- Fix dev test cycle: reset must respect short duration (<= 60 min) for biggest-fish.
-- Add optional 20-second dev cycle via p_duration_seconds.

-- 1. reset_expired_tournaments: for biggest-fish when duration_minutes <= 60 (dev), use it for next cycle end
CREATE OR REPLACE FUNCTION reset_expired_tournaments()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  n int := 0;
  v_date_eastern date;
  v_dow int;
  v_days_ahead int;
  v_end_ts timestamptz;
BEGIN
  FOR r IN
    SELECT id, cycle_id, cycle_ends_at, duration_minutes, end_day_of_week
    FROM tournaments
    WHERE is_active = true AND cycle_ends_at <= now()
  LOOP
    -- Dev short cycle: biggest-fish with duration_minutes <= 60 → next end = now() + that many minutes
    IF r.id = 'biggest-fish-this-week' AND r.duration_minutes IS NOT NULL AND r.duration_minutes <= 60 THEN
      v_end_ts := now() + (r.duration_minutes || ' minutes')::interval;
    ELSIF r.id = 'biggest-fish-this-week' THEN
      v_date_eastern := (r.cycle_ends_at AT TIME ZONE 'America/New_York')::date;
      v_end_ts := ((v_date_eastern + interval '10 days')::timestamp + time '19:00') AT TIME ZONE 'America/New_York';
    ELSE
      v_date_eastern := (r.cycle_ends_at AT TIME ZONE 'America/New_York')::date;
      v_dow := extract(dow FROM v_date_eastern)::int;
      v_days_ahead := (r.end_day_of_week - v_dow + 7) % 7;
      IF v_days_ahead = 0 THEN
        v_days_ahead := 7;
      END IF;
      v_end_ts := ((v_date_eastern + (v_days_ahead || ' days')::interval)::timestamp + time '19:00') AT TIME ZONE 'America/New_York';
    END IF;

    UPDATE tournaments
    SET last_ended_cycle_id = r.cycle_id,
        cycle_id = r.cycle_id + 1,
        cycle_starts_at = r.cycle_ends_at,
        cycle_ends_at = v_end_ts
    WHERE tournaments.id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- 2. force_restart_tournament: add optional p_duration_seconds (1–3600). When set, advance cycle by that many seconds and skip reset.
CREATE OR REPLACE FUNCTION force_restart_tournament(
  p_template_key text,
  p_duration_minutes int DEFAULT 10,
  p_duration_seconds int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_cycle_id int;
  v_finalized int;
BEGIN
  IF p_duration_seconds IS NOT NULL THEN
    IF p_duration_seconds < 1 OR p_duration_seconds > 3600 THEN
      RAISE EXCEPTION 'force_restart_tournament: p_duration_seconds must be 1–3600 (dev only)';
    END IF;
  ELSIF p_duration_minutes > 60 THEN
    RAISE EXCEPTION 'force_restart_tournament: duration must be <= 60 minutes (dev only)';
  END IF;

  SELECT id, cycle_id INTO v_id, v_cycle_id
  FROM tournaments
  WHERE template_key = p_template_key AND is_active = true
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tournament not found');
  END IF;

  v_finalized := finalize_tournament_cycle(v_id);

  IF p_duration_seconds IS NOT NULL THEN
    UPDATE tournaments
    SET last_ended_cycle_id = v_cycle_id,
        cycle_id = v_cycle_id + 1,
        cycle_starts_at = now(),
        cycle_ends_at = now() + (p_duration_seconds || ' seconds')::interval
    WHERE id = v_id;
    RETURN jsonb_build_object(
      'ok', true,
      'tournament_id', v_id,
      'duration_seconds', p_duration_seconds,
      'winners_awarded', v_finalized
    );
  END IF;

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

COMMENT ON FUNCTION force_restart_tournament(text, int, int) IS 'Dev/test: finalize current cycle, then start new one. Use p_duration_seconds (1–3600) for short test (e.g. 20), or p_duration_minutes (≤60) for minute-based.';
