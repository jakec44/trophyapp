-- Expand live tournament chips for Home → Tournaments:
-- Weekly Rarest, Bluegill, Catfish (Weekly Biggest + Bass/Snook/Tarpon already exist).

DO $$
DECLARE
  v_now_eastern timestamptz := now() AT TIME ZONE 'America/New_York';
  v_end_ts timestamptz;
  v_start_ts timestamptz;
  v_days_ahead int;
BEGIN
  -- Next Monday 7pm Eastern as a shared cycle anchor for new weekly species boards
  v_days_ahead := (8 - EXTRACT(DOW FROM v_now_eastern)::int) % 7;
  IF v_days_ahead = 0 THEN
    v_days_ahead := 7;
  END IF;
  v_end_ts := ((v_now_eastern + (v_days_ahead || ' days')::interval)::timestamp + time '19:00') AT TIME ZONE 'America/New_York';
  v_start_ts := v_end_ts - interval '7 days';

  INSERT INTO tournaments (
    id, type, title, metric_type, template_key, cycle_id,
    duration_minutes, end_day_of_week, is_active, cycle_starts_at, cycle_ends_at, created_at
  ) VALUES
    (
      'tournament-rarest', 'RAREST_FISH', 'Weekly Rarest', 'LENGTH_IN', 'rarest', 1,
      10080, 0, true, v_start_ts, v_end_ts, now()
    ),
    (
      'tournament-bluegill', 'BIGGEST_BLUEGILL', 'Bluegill', 'LENGTH_IN', 'bluegill', 1,
      10080, 3, true, v_start_ts, v_end_ts, now()
    ),
    (
      'tournament-catfish', 'BIGGEST_CATFISH', 'Catfish', 'WEIGHT_LBS', 'catfish', 1,
      10080, 4, true, v_start_ts, v_end_ts, now()
    )
  ON CONFLICT (id) DO UPDATE SET
    type = EXCLUDED.type,
    title = EXCLUDED.title,
    metric_type = EXCLUDED.metric_type,
    template_key = EXCLUDED.template_key,
    duration_minutes = EXCLUDED.duration_minutes,
    end_day_of_week = EXCLUDED.end_day_of_week,
    is_active = true;

  -- Ensure Weekly Biggest stays active and titled clearly for the chip UI
  UPDATE tournaments
  SET title = 'Weekly Biggest',
      is_active = true
  WHERE id = 'biggest-fish-this-week';
END $$;
