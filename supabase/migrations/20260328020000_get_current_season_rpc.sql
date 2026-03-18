-- RPC: get_current_season() returns active season info for UI

CREATE OR REPLACE FUNCTION get_current_season()
RETURNS TABLE (
  id uuid,
  season_number int,
  name text,
  start_date timestamptz,
  end_date timestamptz,
  days_remaining int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.season_number,
    s.name,
    s.start_date,
    s.end_date,
    GREATEST(0, EXTRACT(days FROM (s.end_date - now()))::int) AS days_remaining
  FROM seasons s
  WHERE s.is_active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_current_season() IS 'Returns active season info for UI: name, days_remaining, etc.';

GRANT EXECUTE ON FUNCTION get_current_season() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_season() TO anon;
