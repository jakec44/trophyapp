-- Restore real Pro gating (reverts schema-migrations/003-unlock-pro-for-all.sql effects).
-- check_upload_limit now uses is_pro(); Pro: 50 gen uploads/month, Free: 10 total catches.

CREATE OR REPLACE FUNCTION check_upload_limit(p_user_id UUID)
RETURNS TABLE (
  can_upload BOOLEAN,
  uploads_remaining INT,
  subscription_plan TEXT
) AS $$
DECLARE
  v_is_pro BOOLEAN;
  v_uploads_this_month INT;
  v_total_catches INT;
  v_plan TEXT;
BEGIN
  v_is_pro := is_pro(p_user_id);
  v_plan := CASE WHEN v_is_pro THEN 'pro' ELSE 'free' END;

  SELECT COALESCE(uploads_count, 0) INTO v_uploads_this_month
  FROM generation_usage
  WHERE user_id = p_user_id AND month = DATE_TRUNC('month', NOW())::DATE;

  SELECT COUNT(*)::INT INTO v_total_catches
  FROM catches WHERE user_id = p_user_id AND deleted_at IS NULL;

  RETURN QUERY
  SELECT
    CASE WHEN v_is_pro
      THEN COALESCE(v_uploads_this_month, 0) < 50
      ELSE v_total_catches < 10
    END AS can_upload,
    CASE WHEN v_is_pro
      THEN GREATEST(0, 50 - COALESCE(v_uploads_this_month, 0))
      ELSE GREATEST(0, 10 - v_total_catches)
    END AS uploads_remaining,
    v_plan AS subscription_plan;
END;
$$ LANGUAGE plpgsql;

-- RPC for client to set Pro entitlement after RevenueCat purchase (beta only).
-- Production: use RevenueCat webhook to update profiles via service role.
CREATE OR REPLACE FUNCTION set_pro_entitlement_from_client(p_expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  UPDATE profiles
  SET subscription_plan = 'pro', pro_expires_at = p_expires_at
  WHERE id = v_user_id;
END;
$$;
COMMENT ON FUNCTION set_pro_entitlement_from_client IS 'Beta: client calls after purchase. Production: use RevenueCat webhook.';
GRANT EXECUTE ON FUNCTION set_pro_entitlement_from_client(TIMESTAMPTZ) TO authenticated;
