-- RPCs for trophy detail: get podium (top 3), hide, delete (own badge only).

-- Top 3 placements for a tournament cycle (for display in trophy detail modal)
CREATE OR REPLACE FUNCTION get_tournament_podium(p_tournament_id text, p_cycle_id int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY place), '[]'::jsonb)
    FROM (
      SELECT id, user_id, tournament_id, entry_id, place, trophy_tier, fish_photo_url, tournament_name, created_at
      FROM trophy_badges
      WHERE tournament_id = p_tournament_id AND cycle_id = p_cycle_id
      ORDER BY place
      LIMIT 3
    ) t
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_tournament_podium(text, int) TO authenticated;

-- Hide trophy from profile (clear shown_at; user can "show" again later via set_trophy_shown)
CREATE OR REPLACE FUNCTION set_trophy_hidden(p_badge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE trophy_badges
  SET shown_at = NULL
  WHERE id = p_badge_id AND user_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION set_trophy_hidden(uuid) TO authenticated;

-- Delete own trophy badge (with confirmation in app)
CREATE OR REPLACE FUNCTION delete_trophy_badge(p_badge_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM trophy_badges
  WHERE id = p_badge_id AND user_id = auth.uid();
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION delete_trophy_badge(uuid) TO authenticated;
