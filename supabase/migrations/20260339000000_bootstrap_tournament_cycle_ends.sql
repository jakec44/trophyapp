-- Bootstrap: 7-day species (end on fixed weekday), 10-day biggest-fish. All end 7pm Eastern.
-- Run once so UI shows "X days and Y hr" instead of 24hr. Does not change cycle_id.

-- 1. Ensure duration_minutes (7d = 10080, biggest-fish = 14400) and end_day_of_week
UPDATE tournaments SET duration_minutes = 14400 WHERE id = 'biggest-fish-this-week' AND is_active = true;
UPDATE tournaments SET duration_minutes = 10080 WHERE id != 'biggest-fish-this-week' AND is_active = true;

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS end_day_of_week int CHECK (end_day_of_week >= 0 AND end_day_of_week <= 6);
UPDATE tournaments SET end_day_of_week = 6 WHERE id = 'tournament-redfish' AND is_active = true;
UPDATE tournaments SET end_day_of_week = 1 WHERE id = 'tournament-bass' AND is_active = true;
UPDATE tournaments SET end_day_of_week = 2 WHERE id = 'tournament-snook' AND is_active = true;
UPDATE tournaments SET end_day_of_week = 3 WHERE id = 'tournament-flounder' AND is_active = true;
UPDATE tournaments SET end_day_of_week = 4 WHERE id = 'tournament-striper' AND is_active = true;
UPDATE tournaments SET end_day_of_week = 5 WHERE id = 'tournament-tarpon' AND is_active = true;
UPDATE tournaments SET end_day_of_week = 0 WHERE id = 'tournament-smallest' AND is_active = true;

-- 2. Set current cycle_ends_at / cycle_starts_at to next 7pm on correct weekday (species) or +10 days (biggest-fish)
DO $$
DECLARE
  r RECORD;
  v_now_eastern date;
  v_dow int;
  v_days_ahead int;
  v_end_ts timestamptz;
  v_start_ts timestamptz;
BEGIN
  v_now_eastern := (now() AT TIME ZONE 'America/New_York')::date;

  FOR r IN
    SELECT id, end_day_of_week
    FROM tournaments
    WHERE is_active = true
  LOOP
    IF r.id = 'biggest-fish-this-week' THEN
      v_end_ts := ((v_now_eastern + interval '10 days')::timestamp + time '19:00') AT TIME ZONE 'America/New_York';
      v_start_ts := v_end_ts - interval '10 days';
    ELSIF r.end_day_of_week IS NOT NULL THEN
      v_dow := extract(dow FROM v_now_eastern)::int;
      v_days_ahead := (r.end_day_of_week - v_dow + 7) % 7;
      IF v_days_ahead = 0 THEN
        v_days_ahead := 7;
      END IF;
      v_end_ts := ((v_now_eastern + (v_days_ahead || ' days')::interval)::timestamp + time '19:00') AT TIME ZONE 'America/New_York';
      v_start_ts := v_end_ts - interval '7 days';
    ELSE
      CONTINUE;
    END IF;

    UPDATE tournaments
    SET cycle_starts_at = v_start_ts,
        cycle_ends_at = v_end_ts
    WHERE id = r.id;
  END LOOP;
END $$;
