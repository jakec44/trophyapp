-- Expand species leaderboard for Rankings tab species list.
-- Bass/Tarpon/Catfish = weight; Snook/Bluegill/Jack Crevalle = length.

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
        WHEN lower(p_species) IN ('bass', 'tarpon', 'catfish') THEN c.weight_lb
        ELSE c.length_in
      END AS metric_value
    FROM catches c
    JOIN profiles p ON p.id = c.user_id
    WHERE c.deleted_at IS NULL
      AND (
        (lower(p_species) = 'bass' AND lower(c.species) LIKE '%bass%')
        OR (lower(p_species) = 'tarpon' AND lower(c.species) LIKE '%tarpon%')
        OR (lower(p_species) = 'snook' AND lower(c.species) LIKE '%snook%')
        OR (lower(p_species) = 'bluegill' AND lower(c.species) LIKE '%bluegill%')
        OR (lower(p_species) IN ('jack-crevalle', 'jack_crevalle', 'crevalle')
            AND (lower(c.species) LIKE '%crevalle%' OR lower(c.species) LIKE '%jack crevalle%'))
        OR (lower(p_species) = 'catfish' AND lower(c.species) LIKE '%catfish%')
        OR (lower(p_species) = 'redfish' AND lower(c.species) LIKE '%redfish%')
      )
      AND (
        (lower(p_species) IN ('bass', 'tarpon', 'catfish') AND c.weight_lb IS NOT NULL AND c.weight_lb > 0)
        OR (lower(p_species) NOT IN ('bass', 'tarpon', 'catfish') AND c.length_in IS NOT NULL AND c.length_in > 0)
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
    CASE WHEN lower(p_species) IN ('bass', 'tarpon', 'catfish') THEN 'lbs' ELSE 'in' END
  FROM ranked r
  ORDER BY r.rn
  LIMIT p_limit_n;
$$;

COMMENT ON FUNCTION get_species_leaderboard(text, text, text, uuid, int) IS
  'Best all-time catch per user. Weight: bass/tarpon/catfish. Length: snook/bluegill/jack-crevalle/redfish.';
