-- Raise free-tier log limit from 20 to 30 catches.
CREATE OR REPLACE FUNCTION create_log_entry(
  p_species TEXT,
  p_weight_lb FLOAT,
  p_length_in FLOAT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_taken_at TIMESTAMPTZ DEFAULT now(),
  p_upload_status TEXT DEFAULT 'complete'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_count INT;
  v_row RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to log a catch';
  END IF;

  IF NOT is_pro(v_user_id) THEN
    SELECT COUNT(*)::INT INTO v_count
    FROM catches
    WHERE user_id = v_user_id AND deleted_at IS NULL;
    IF v_count >= 30 THEN
      RAISE EXCEPTION 'FREE_LOG_LIMIT: Pro unlocks unlimited logs';
    END IF;
  END IF;

  INSERT INTO catches (user_id, species, weight_lb, length_in, notes, location, taken_at, upload_status)
  VALUES (v_user_id, p_species, GREATEST(0.1, p_weight_lb), NULLIF(p_length_in, 0), p_notes, p_location,
    COALESCE(p_taken_at, now()), COALESCE(NULLIF(TRIM(p_upload_status), ''), 'complete'))
  RETURNING id, user_id INTO v_row;

  RETURN jsonb_build_object('id', v_row.id, 'user_id', v_row.user_id);
END;
$$;
