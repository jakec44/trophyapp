-- Unlock Pro features for all users (no upgrade/paywall)
-- Treats all users as Pro: 50 uploads/month, no free-tier limits

CREATE OR REPLACE FUNCTION check_upload_limit(p_user_id UUID)
RETURNS TABLE (
  can_upload BOOLEAN,
  uploads_remaining INT,
  subscription_plan TEXT
) AS $$
DECLARE
  v_uploads_this_month INT;
BEGIN
  SELECT COALESCE(uploads_count, 0) INTO v_uploads_this_month
  FROM generation_usage
  WHERE user_id = p_user_id AND month = DATE_TRUNC('month', NOW())::DATE;

  RETURN QUERY
  SELECT
    COALESCE(v_uploads_this_month, 0) < 50 as can_upload,
    GREATEST(0, 50 - COALESCE(v_uploads_this_month, 0)) as uploads_remaining,
    'pro'::TEXT as subscription_plan;
END;
$$ LANGUAGE plpgsql;
