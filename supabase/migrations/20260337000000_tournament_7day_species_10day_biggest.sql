-- Tournaments: species = 7 days, fixed end day (Redfish Sat, Bass Mon, Snook Tue, ...).
-- Biggest Fish = 10 days. All end at 7pm Eastern.

-- 1. Add end_day_of_week (0=Sun, 1=Mon, ..., 6=Sat). NULL for biggest-fish (uses duration only).
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS end_day_of_week int CHECK (end_day_of_week >= 0 AND end_day_of_week <= 6);

-- 2. Set durations: biggest-fish 10 days, species 7 days
-- 10 days = 14400 min, 7 days = 10080 min
UPDATE tournaments SET duration_minutes = 14400
WHERE id = 'biggest-fish-this-week';

UPDATE tournaments SET duration_minutes = 10080
WHERE id != 'biggest-fish-this-week';

-- 3. Set end day of week for species (Redfish=Sat, Bass=Mon, Snook=Tue, Flounder=Wed, Striper=Thu, Tarpon=Fri, Smallest=Sun)
UPDATE tournaments SET end_day_of_week = 6 WHERE id = 'tournament-redfish';   -- Saturday
UPDATE tournaments SET end_day_of_week = 1 WHERE id = 'tournament-bass';    -- Monday
UPDATE tournaments SET end_day_of_week = 2 WHERE id = 'tournament-snook';    -- Tuesday
UPDATE tournaments SET end_day_of_week = 3 WHERE id = 'tournament-flounder'; -- Wednesday
UPDATE tournaments SET end_day_of_week = 4 WHERE id = 'tournament-striper'; -- Thursday
UPDATE tournaments SET end_day_of_week = 5 WHERE id = 'tournament-tarpon';  -- Friday
UPDATE tournaments SET end_day_of_week = 0 WHERE id = 'tournament-smallest'; -- Sunday

-- biggest-fish-this-week keeps end_day_of_week NULL (next end = +10 days at 7pm)

-- 4. reset_expired_tournaments(): next cycle ends at 7pm Eastern.
--    Biggest fish: (cycle_ends_at date + 10 days) at 7pm Eastern.
--    Species: next occurrence of end_day_of_week at 7pm Eastern.
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
    v_date_eastern := (r.cycle_ends_at AT TIME ZONE 'America/New_York')::date;

    IF r.id = 'biggest-fish-this-week' THEN
      -- Biggest fish: 10 days from cycle end date, at 7pm Eastern
      v_end_ts := ((v_date_eastern + interval '10 days')::timestamp + time '19:00') AT TIME ZONE 'America/New_York';
    ELSE
      -- Species: next occurrence of end_day_of_week at 7pm Eastern (dow 0=Sun .. 6=Sat)
      v_dow := extract(dow FROM v_date_eastern)::int;  -- 0=Sun, 6=Sat
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

COMMENT ON FUNCTION reset_expired_tournaments() IS 'Rolls cycle forward. Biggest Fish: 10 days, end 7pm ET. Species: 7 days, end on fixed weekday (Redfish Sat, Bass Mon, Snook Tue, etc.) at 7pm ET.';
