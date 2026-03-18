-- delete_my_catches RPC — Bulk delete all catches for current user.
-- Used by Clear logbook / Clear XP & passport in Settings.
-- Bypasses getUserCatches (which can fail on malformed data) and deletes in one transaction.

CREATE OR REPLACE FUNCTION public.delete_my_catches()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_deleted bigint;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH deleted AS (
    DELETE FROM catches WHERE user_id = v_uid RETURNING id
  )
  SELECT count(*)::bigint INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.delete_my_catches() IS 'Deletes all catches for the current user. Returns number deleted.';

GRANT EXECUTE ON FUNCTION public.delete_my_catches() TO authenticated;
