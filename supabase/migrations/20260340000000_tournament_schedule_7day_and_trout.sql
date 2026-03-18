-- Tournament schedule: all species 7 days, Biggest Fish Overall 10 days.
-- End days: Redfish Mon, Bass Tue, Snook Wed, Flounder Thu, Striper Fri, Tarpon Sat,
--           Freshwater Trout Mon, Smallest Fish Tue.

-- 1. All species 7 days (10080 min); biggest-fish 10 days (14400 min)
UPDATE tournaments SET duration_minutes = 14400 WHERE id = 'biggest-fish-this-week' AND is_active = true;
UPDATE tournaments SET duration_minutes = 10080 WHERE id != 'biggest-fish-this-week' AND is_active = true;

-- 2. End day of week (0=Sun, 1=Mon, ..., 6=Sat)
UPDATE tournaments SET end_day_of_week = 1 WHERE id = 'tournament-redfish' AND is_active = true;   -- Monday
UPDATE tournaments SET end_day_of_week = 2 WHERE id = 'tournament-bass' AND is_active = true;     -- Tuesday
UPDATE tournaments SET end_day_of_week = 3 WHERE id = 'tournament-snook' AND is_active = true;    -- Wednesday
UPDATE tournaments SET end_day_of_week = 4 WHERE id = 'tournament-flounder' AND is_active = true;  -- Thursday
UPDATE tournaments SET end_day_of_week = 5 WHERE id = 'tournament-striper' AND is_active = true;  -- Friday
UPDATE tournaments SET end_day_of_week = 6 WHERE id = 'tournament-tarpon' AND is_active = true;   -- Saturday
UPDATE tournaments SET end_day_of_week = 2 WHERE id = 'tournament-smallest' AND is_active = true; -- Tuesday (Smallest Fish)

-- 3. Rename smallest tournament to "Smallest Fish"
UPDATE tournaments SET title = 'Smallest Fish' WHERE id = 'tournament-smallest' AND is_active = true;

-- 4. Add Freshwater Trout tournament (ends Monday, 7 days). Compute next Monday 7pm Eastern.
DO $$
DECLARE
  v_now_eastern date;
  v_dow int;
  v_days_ahead int;
  v_end_ts timestamptz;
  v_start_ts timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tournaments WHERE id = 'tournament-freshwater-trout') THEN
    v_now_eastern := (now() AT TIME ZONE 'America/New_York')::date;
    v_dow := extract(dow FROM v_now_eastern)::int;
    v_days_ahead := (1 - v_dow + 7) % 7;
    IF v_days_ahead = 0 THEN
      v_days_ahead := 7;
    END IF;
    v_end_ts := ((v_now_eastern + (v_days_ahead || ' days')::interval)::timestamp + time '19:00') AT TIME ZONE 'America/New_York';
    v_start_ts := v_end_ts - interval '7 days';

    INSERT INTO tournaments (
      id, type, title, metric_type, template_key, cycle_id,
      duration_minutes, end_day_of_week, is_active, cycle_starts_at, cycle_ends_at, created_at
    ) VALUES (
      'tournament-freshwater-trout', 'BIGGEST_TROUT', 'Freshwater Trout', 'LENGTH_IN', 'freshwater_trout', 1,
      10080, 1, true, v_start_ts, v_end_ts, now()
    );
  END IF;
END $$;
