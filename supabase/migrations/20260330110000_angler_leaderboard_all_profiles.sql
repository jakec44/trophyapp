-- Ensure leaderboard returns ALL profiles (including 0 AR) for global scope.
-- Local scope with no state filter now falls back to global behavior.

DROP FUNCTION IF EXISTS get_angler_leaderboard(int, text, text);

CREATE OR REPLACE FUNCTION get_angler_leaderboard(
  p_limit_n int DEFAULT 10000,
  p_scope text DEFAULT 'global',
  p_state_filter text DEFAULT NULL
)
RETURNS TABLE (
  rank bigint,
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  angler_rating int,
  wins bigint,
  podiums bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stats AS (
    SELECT
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      COALESCE(p.angler_rating, 0)::int AS ar,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place = 1) AS wins,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place <= 3) AS podiums
    FROM profiles p
    WHERE (p_scope = 'global')
       OR (p_scope = 'local' AND p_state_filter IS NOT NULL AND trim(p_state_filter) <> '' AND p.state IS NOT NULL
           AND lower(trim(p.state)) = lower(trim(p_state_filter)))
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY s.ar DESC, s.wins DESC NULLS LAST)::bigint,
    s.id,
    s.username,
    s.display_name,
    s.avatar_url,
    s.ar,
    s.wins,
    s.podiums
  FROM stats s
  ORDER BY s.ar DESC, s.wins DESC NULLS LAST
  LIMIT p_limit_n;
$$;

GRANT EXECUTE ON FUNCTION get_angler_leaderboard(int, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_angler_leaderboard(int, text, text) TO anon;

COMMENT ON FUNCTION get_angler_leaderboard(int, text, text) IS 'All profiles for leaderboard. scope=global: everyone (incl 0 AR). scope=local: users in state.';
