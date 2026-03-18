-- Tournament end times: end at 7pm Eastern.
-- Biggest fish overall: 4 days. Rest: 1 day.

-- 1. Update duration_minutes
UPDATE tournaments SET duration_minutes = 5760  -- 4 days
WHERE id = 'biggest-fish-this-week';

UPDATE tournaments SET duration_minutes = 1440  -- 1 day
WHERE id != 'biggest-fish-this-week';

-- 2. Update reset_expired_tournaments() so new cycles end at 7pm Eastern
CREATE OR REPLACE FUNCTION reset_expired_tournaments()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  n int := 0;
  v_duration_days int;
  v_date_eastern date;
  v_end_ts timestamptz;
BEGIN
  FOR r IN
    SELECT id, cycle_id, cycle_ends_at, duration_minutes
    FROM tournaments
    WHERE is_active = true AND cycle_ends_at <= now()
  LOOP
    -- 4 days for biggest-fish-this-week, 1 day for others
    v_duration_days := CASE WHEN r.id = 'biggest-fish-this-week' THEN 4 ELSE 1 END;

    -- End at 7pm Eastern, X days from the end date of the cycle that just ended
    v_date_eastern := (r.cycle_ends_at AT TIME ZONE 'America/New_York')::date;
    v_end_ts := ((v_date_eastern + (v_duration_days || ' days')::interval)::timestamp + time '19:00') AT TIME ZONE 'America/New_York';

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

COMMENT ON FUNCTION reset_expired_tournaments() IS 'Rolls cycle forward for expired tournaments. New cycles end at 7pm Eastern. Biggest fish: 4 days, rest: 1 day.';
