-- Moderator admin: allow moderators to promote/revoke other users as moderators.
-- Only existing moderators can call these RPCs.

CREATE OR REPLACE FUNCTION search_users_for_moderator_admin(p_query text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_moderator boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_moderator = true) THEN
    RAISE EXCEPTION 'Only moderators can search users for moderator admin';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(p.is_moderator, false)
  FROM profiles p
  WHERE (
    p.username ILIKE '%' || NULLIF(TRIM(p_query), '') || '%'
    OR p.display_name ILIKE '%' || NULLIF(TRIM(p_query), '') || '%'
    OR p.name ILIKE '%' || NULLIF(TRIM(p_query), '') || '%'
  )
  ORDER BY p.username NULLS LAST
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION set_user_moderator(p_target_user_id uuid, p_is_moderator boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_moderator = true) THEN
    RAISE EXCEPTION 'Only moderators can change moderator status';
  END IF;

  UPDATE profiles
  SET is_moderator = p_is_moderator
  WHERE id = p_target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION search_users_for_moderator_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_moderator(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION search_users_for_moderator_admin(text) IS 'Search users by username/name. Moderators only. Returns is_moderator for admin UI.';
COMMENT ON FUNCTION set_user_moderator(uuid, boolean) IS 'Set moderator status for a user. Moderators only.';
