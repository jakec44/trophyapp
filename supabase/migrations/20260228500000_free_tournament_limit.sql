-- Free users: at most one tournament entry at a time.
-- Pro users: unlimited entries.

CREATE OR REPLACE FUNCTION check_free_user_tournament_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan TEXT;
  v_other_count INT;
BEGIN
  SELECT p.subscription_plan INTO v_plan
  FROM profiles p
  WHERE p.id = NEW.user_id;

  IF v_plan IS NULL OR v_plan != 'free' THEN
    RETURN NEW;  -- Pro or unknown: allow
  END IF;

  -- Count entries in OTHER tournaments (exclude this one; replacement is ok)
  SELECT COUNT(*)::INT INTO v_other_count
  FROM tournament_entries
  WHERE user_id = NEW.user_id
    AND tournament_id != NEW.tournament_id;

  IF v_other_count >= 1 THEN
    RAISE EXCEPTION 'Free accounts can only enter one tournament at a time.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_free_tournament_limit ON tournament_entries;
CREATE TRIGGER trg_check_free_tournament_limit
  BEFORE INSERT ON tournament_entries
  FOR EACH ROW
  EXECUTE FUNCTION check_free_user_tournament_limit();
