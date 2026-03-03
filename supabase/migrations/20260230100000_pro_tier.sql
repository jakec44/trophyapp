-- Pro tier: server-enforced limits, vote weights, subscription protection

-- =============================================================================
-- 1. SUBSCRIPTION FIELDS (add if missing, backfill)
-- =============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ;

-- Ensure check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_plan_check
  CHECK (subscription_plan IN ('free', 'pro'));

UPDATE profiles SET subscription_plan = 'free' WHERE subscription_plan IS NULL;

-- =============================================================================
-- 2. is_pro() FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION is_pro(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.subscription_plan = 'pro'
       AND (p.pro_expires_at IS NULL OR p.pro_expires_at > now())
     FROM profiles p WHERE p.id = p_user_id),
    false
  );
$$;

-- =============================================================================
-- 3. Block users from self-upgrading (subscription_plan, pro_expires_at)
-- =============================================================================
CREATE OR REPLACE FUNCTION block_subscription_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() = NEW.id THEN
    NEW.subscription_plan := OLD.subscription_plan;
    NEW.pro_expires_at := OLD.pro_expires_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_block_subscription_self_update ON profiles;
CREATE TRIGGER trg_block_subscription_self_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION block_subscription_self_update();

-- =============================================================================
-- 4. create_log_entry RPC (enforces free 20-catch limit)
-- =============================================================================
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
    IF v_count >= 20 THEN
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

GRANT EXECUTE ON FUNCTION create_log_entry(TEXT, FLOAT, FLOAT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- =============================================================================
-- 5. TOURNAMENT ENTRIES: Drop unique so Pro can have multiple; enforce via RPC
-- =============================================================================
ALTER TABLE tournament_entries DROP CONSTRAINT IF EXISTS tournament_entries_user_unique;

-- Remove old free-tournament-limit trigger (replaced by RPC)
DROP TRIGGER IF EXISTS trg_check_free_tournament_limit ON tournament_entries;

-- create_tournament_entry RPC
CREATE OR REPLACE FUNCTION create_tournament_entry(
  p_id TEXT,
  p_tournament_id TEXT,
  p_catch_id UUID DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT '',
  p_species TEXT DEFAULT NULL,
  p_weight_lb NUMERIC DEFAULT NULL,
  p_length_in NUMERIC DEFAULT NULL,
  p_user_state TEXT DEFAULT NULL
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
  v_username TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to enter a tournament';
  END IF;

  v_username := NULLIF(TRIM(COALESCE(p_username, '')), '');
  IF v_username IS NULL THEN
    SELECT COALESCE(display_name, username, 'Angler') INTO v_username
    FROM profiles WHERE id = v_user_id;
  END IF;

  IF NOT is_pro(v_user_id) THEN
    SELECT COUNT(*)::INT INTO v_count
    FROM tournament_entries
    WHERE tournament_id = p_tournament_id AND user_id = v_user_id;
    IF v_count >= 1 THEN
      RAISE EXCEPTION 'FREE_TOURNAMENT_LIMIT: Pro unlocks unlimited tournament entries';
    END IF;
  END IF;

  INSERT INTO tournament_entries (
    id, tournament_id, user_id, catch_id, username, avatar_url, image_url,
    species, weight_lb, length_in, up_votes, down_votes, user_state
  )
  VALUES (
    p_id, p_tournament_id, v_user_id, p_catch_id, v_username, p_avatar_url,
    COALESCE(NULLIF(TRIM(p_image_url), ''), ''),
    p_species, p_weight_lb, p_length_in, 0, 0, p_user_state
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION create_tournament_entry(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- =============================================================================
-- 6. PRO VOTE WEIGHT: Modify vote_on_tournament_entry (pro = 3, free = 1)
-- =============================================================================
CREATE OR REPLACE FUNCTION vote_on_tournament_entry(
  p_entry_id TEXT,
  p_vote TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_entry RECORD;
  v_prev_vote TEXT;
  v_weight INT;
  v_up INT;
  v_down INT;
  v_total INT;
  v_removed BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to vote';
  END IF;

  SELECT * INTO v_entry FROM tournament_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found';
  END IF;
  IF v_entry.user_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot vote on your own entry';
  END IF;

  v_weight := CASE WHEN is_pro(v_user_id) THEN 3 ELSE 1 END;

  SELECT vote INTO v_prev_vote FROM tournament_entry_votes
  WHERE entry_id = p_entry_id AND user_id = v_user_id;

  v_up := v_entry.up_votes;
  v_down := v_entry.down_votes;
  IF v_prev_vote = 'UP' THEN v_up := v_up - (CASE WHEN is_pro(v_user_id) THEN 3 ELSE 1 END); END IF;
  IF v_prev_vote = 'DOWN' THEN v_down := v_down - (CASE WHEN is_pro(v_user_id) THEN 3 ELSE 1 END); END IF;
  IF p_vote = 'UP' THEN v_up := v_up + v_weight; END IF;
  IF p_vote = 'DOWN' THEN v_down := v_down + v_weight; END IF;

  v_total := v_up + v_down;
  v_removed := (v_total >= 10 AND v_total > 0 AND v_down::float / v_total >= 0.5);

  IF v_removed THEN
    DELETE FROM tournament_entries WHERE id = p_entry_id;
    RETURN jsonb_build_object('upVotes', v_up, 'downVotes', v_down, 'userVote', p_vote, 'removed', true);
  END IF;

  UPDATE tournament_entries SET up_votes = v_up, down_votes = v_down WHERE id = p_entry_id;

  IF p_vote IS NOT NULL AND p_vote != '' THEN
    INSERT INTO tournament_entry_votes (entry_id, user_id, vote)
    VALUES (p_entry_id, v_user_id, p_vote)
    ON CONFLICT (entry_id, user_id) DO UPDATE SET vote = p_vote;
  ELSE
    DELETE FROM tournament_entry_votes WHERE entry_id = p_entry_id AND user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object('upVotes', v_up, 'downVotes', v_down, 'userVote', p_vote, 'removed', false);
END;
$$;
