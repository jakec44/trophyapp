-- Local scope requires state: when scope='local' and state_filter is null/empty, return 0 rows.
-- Ensures "local" features (leaderboard, AR rank, competitions) only show users in the user's state.

-- 1. get_angler_leaderboard: local with no state filter -> 0 rows
DROP FUNCTION IF EXISTS get_angler_leaderboard(int, text, text);

CREATE OR REPLACE FUNCTION get_angler_leaderboard(
  p_limit_n int DEFAULT 100,
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
      COALESCE(p.angler_rating, 0) AS ar,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place = 1) AS wins,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place <= 3) AS podiums
    FROM profiles p
    WHERE (p_scope = 'global')
       OR (p_scope = 'local' AND p_state_filter IS NOT NULL AND trim(p_state_filter) <> '' AND p.state IS NOT NULL AND trim(p.state) = trim(p_state_filter))
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY s.ar DESC, s.wins DESC NULLS LAST)::bigint,
    s.id,
    s.username,
    s.display_name,
    s.avatar_url,
    s.ar::int,
    s.wins,
    s.podiums
  FROM stats s
  ORDER BY s.ar DESC, s.wins DESC NULLS LAST
  LIMIT p_limit_n;
$$;

COMMENT ON FUNCTION get_angler_leaderboard(int, text, text) IS 'Angler Rating leaderboard. scope=global: all users. scope=local: only users in state (state_filter required).';

-- 2. get_angler_rank: local with no state filter -> no row
CREATE OR REPLACE FUNCTION get_angler_rank(
  p_user_id uuid,
  p_scope text DEFAULT 'global',
  p_state_filter text DEFAULT NULL
)
RETURNS TABLE (rank bigint, angler_rating int, wins bigint, podiums bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT
      p.id,
      COALESCE(p.angler_rating, 0) AS ar,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place = 1) AS w,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place <= 3) AS pod
    FROM profiles p
    WHERE (p_scope = 'global')
       OR (p_scope = 'local' AND p_state_filter IS NOT NULL AND trim(p_state_filter) <> '' AND p.state IS NOT NULL AND trim(p.state) = trim(p_state_filter))
  ),
  ranked AS (
    SELECT o.id, o.ar, o.w, o.pod, ROW_NUMBER() OVER (ORDER BY o.ar DESC, o.w DESC NULLS LAST)::bigint AS rn
    FROM ordered o
  )
  SELECT r.rn AS rank, r.ar::int AS angler_rating, r.w AS wins, r.pod AS podiums
  FROM ranked r
  WHERE r.id = p_user_id;
$$;

COMMENT ON FUNCTION get_angler_rank(uuid, text, text) IS 'Single user AR rank. scope=local requires state_filter (user state).';
