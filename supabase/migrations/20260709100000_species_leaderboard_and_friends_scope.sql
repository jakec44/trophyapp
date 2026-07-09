-- Species leaderboard (best all-time catch), friends scope for AR leaderboard, tarpon weight fix.

UPDATE tournaments SET metric_type = 'WEIGHT_LBS' WHERE id = 'tournament-tarpon';

-- ---------------------------------------------------------------------------
-- get_angler_leaderboard — add friends scope + p_user_id
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_angler_leaderboard(int, text, text);

CREATE OR REPLACE FUNCTION get_angler_leaderboard(
  p_limit_n int DEFAULT 10000,
  p_scope text DEFAULT 'global',
  p_state_filter text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
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
  WITH friend_ids AS (
    SELECT p_user_id AS fid
    WHERE p_scope = 'friends' AND p_user_id IS NOT NULL
    UNION
    SELECT CASE WHEN f.user_id_1 = p_user_id THEN f.user_id_2 ELSE f.user_id_1 END
    FROM friendships f
    WHERE p_scope = 'friends'
      AND p_user_id IS NOT NULL
      AND f.status = 'accepted'
      AND (f.user_id_1 = p_user_id OR f.user_id_2 = p_user_id)
  ),
  stats AS (
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
       OR (p_scope = 'friends' AND p_user_id IS NOT NULL AND p.id IN (SELECT fid FROM friend_ids))
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

GRANT EXECUTE ON FUNCTION get_angler_leaderboard(int, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_angler_leaderboard(int, text, text, uuid) TO anon;

COMMENT ON FUNCTION get_angler_leaderboard(int, text, text, uuid) IS
  'Angler Rating leaderboard. scope=global|local|friends. friends requires p_user_id.';

-- ---------------------------------------------------------------------------
-- get_angler_rank — add friends scope + p_user_id
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_angler_rank(uuid, text, text);

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
  WITH friend_ids AS (
    SELECT p_user_id AS fid
    WHERE p_scope = 'friends' AND p_user_id IS NOT NULL
    UNION
    SELECT CASE WHEN f.user_id_1 = p_user_id THEN f.user_id_2 ELSE f.user_id_1 END
    FROM friendships f
    WHERE p_scope = 'friends'
      AND p_user_id IS NOT NULL
      AND f.status = 'accepted'
      AND (f.user_id_1 = p_user_id OR f.user_id_2 = p_user_id)
  ),
  ordered AS (
    SELECT
      p.id,
      COALESCE(p.angler_rating, 0) AS ar,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place = 1) AS w,
      (SELECT COUNT(*) FROM trophy_badges tb WHERE tb.user_id = p.id AND tb.place <= 3) AS pod
    FROM profiles p
    WHERE (p_scope = 'global')
       OR (p_scope = 'local' AND p_state_filter IS NOT NULL AND trim(p_state_filter) <> '' AND p.state IS NOT NULL
           AND lower(trim(p.state)) = lower(trim(p_state_filter)))
       OR (p_scope = 'friends' AND p_user_id IS NOT NULL AND p.id IN (SELECT fid FROM friend_ids))
  ),
  ranked AS (
    SELECT o.id, o.ar, o.w, o.pod, ROW_NUMBER() OVER (ORDER BY o.ar DESC, o.w DESC NULLS LAST)::bigint AS rn
    FROM ordered o
  )
  SELECT r.rn AS rank, r.ar::int AS angler_rating, r.w AS wins, r.pod AS podiums
  FROM ranked r
  WHERE r.id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION get_angler_rank(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_angler_rank(uuid, text, text) TO anon;

-- ---------------------------------------------------------------------------
-- get_species_leaderboard — best all-time catch per species
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_species_leaderboard(
  p_species text,
  p_scope text DEFAULT 'global',
  p_state_filter text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_limit_n int DEFAULT 10000
)
RETURNS TABLE (
  rank bigint,
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  state text,
  metric_value numeric,
  catch_id uuid,
  metric_unit text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH friend_ids AS (
    SELECT p_user_id AS fid
    WHERE p_scope = 'friends' AND p_user_id IS NOT NULL
    UNION
    SELECT CASE WHEN f.user_id_1 = p_user_id THEN f.user_id_2 ELSE f.user_id_1 END
    FROM friendships f
    WHERE p_scope = 'friends'
      AND p_user_id IS NOT NULL
      AND f.status = 'accepted'
      AND (f.user_id_1 = p_user_id OR f.user_id_2 = p_user_id)
  ),
  species_catches AS (
    SELECT
      c.user_id,
      c.id AS catch_id,
      CASE
        WHEN lower(p_species) IN ('bass', 'tarpon') THEN c.weight_lb
        ELSE c.length_in
      END AS metric_value
    FROM catches c
    JOIN profiles p ON p.id = c.user_id
    WHERE c.deleted_at IS NULL
      AND (
        (lower(p_species) = 'bass' AND lower(c.species) LIKE '%bass%')
        OR (lower(p_species) = 'redfish' AND lower(c.species) LIKE '%redfish%')
        OR (lower(p_species) = 'tarpon' AND lower(c.species) LIKE '%tarpon%')
        OR (lower(p_species) = 'snook' AND lower(c.species) LIKE '%snook%')
      )
      AND (
        (lower(p_species) IN ('bass', 'tarpon') AND c.weight_lb IS NOT NULL AND c.weight_lb > 0)
        OR (lower(p_species) IN ('redfish', 'snook') AND c.length_in IS NOT NULL AND c.length_in > 0)
      )
      AND (
        p_scope = 'global'
        OR (p_scope = 'local' AND p_state_filter IS NOT NULL AND trim(p_state_filter) <> ''
            AND p.state IS NOT NULL AND lower(trim(p.state)) = lower(trim(p_state_filter)))
        OR (p_scope = 'friends' AND p_user_id IS NOT NULL AND c.user_id IN (SELECT fid FROM friend_ids))
      )
  ),
  best_per_user AS (
    SELECT DISTINCT ON (sc.user_id)
      sc.user_id,
      sc.catch_id,
      sc.metric_value
    FROM species_catches sc
    ORDER BY sc.user_id, sc.metric_value DESC NULLS LAST
  ),
  ranked AS (
    SELECT
      b.user_id,
      b.catch_id,
      b.metric_value,
      p.username,
      p.display_name,
      p.avatar_url,
      p.state,
      ROW_NUMBER() OVER (ORDER BY b.metric_value DESC NULLS LAST)::bigint AS rn
    FROM best_per_user b
    JOIN profiles p ON p.id = b.user_id
  )
  SELECT
    r.rn,
    r.user_id,
    r.username,
    r.display_name,
    r.avatar_url,
    r.state,
    r.metric_value,
    r.catch_id,
    CASE WHEN lower(p_species) IN ('bass', 'tarpon') THEN 'lbs' ELSE 'in' END
  FROM ranked r
  ORDER BY r.rn
  LIMIT p_limit_n;
$$;

GRANT EXECUTE ON FUNCTION get_species_leaderboard(text, text, text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_species_leaderboard(text, text, text, uuid, int) TO anon;

COMMENT ON FUNCTION get_species_leaderboard(text, text, text, uuid, int) IS
  'Best all-time catch per user for bass/redfish/tarpon/snook. bass+tarpon=weight, redfish+snook=length.';
