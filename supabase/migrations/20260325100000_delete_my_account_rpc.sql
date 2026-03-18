-- =============================================================================
-- delete_my_account RPC — Self-service account deletion
-- =============================================================================
-- Allows authenticated users to permanently delete their own account.
-- Calls auth.admin_delete_user (requires SECURITY DEFINER) which:
-- - Deletes the auth.users row
-- - Profiles CASCADE from auth.users, so profile and all dependent data
--   (catches, stories, friendships, feed_posts, etc.) are removed.
-- Client must call supabase.auth.signOut() and clear local state after RPC.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM auth.admin_delete_user(v_uid);
END;
$$;

COMMENT ON FUNCTION public.delete_my_account() IS
  'Deletes the current user and all associated data. Caller must sign out and clear local state after.';

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
