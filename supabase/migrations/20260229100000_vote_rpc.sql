-- Vote on tournament entry: runs with elevated privileges so any voter can update counts.
-- MIN 10 votes, 50%+ downvotes = removal. Shared across all users.

CREATE OR REPLACE FUNCTION vote_on_tournament_entry(
  p_entry_id TEXT,
  p_vote TEXT  -- 'UP', 'DOWN', or NULL (remove vote)
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

  SELECT vote INTO v_prev_vote FROM tournament_entry_votes
  WHERE entry_id = p_entry_id AND user_id = v_user_id;

  v_up := v_entry.up_votes;
  v_down := v_entry.down_votes;
  IF v_prev_vote = 'UP' THEN v_up := v_up - 1; END IF;
  IF v_prev_vote = 'DOWN' THEN v_down := v_down - 1; END IF;
  IF p_vote = 'UP' THEN v_up := v_up + 1; END IF;
  IF p_vote = 'DOWN' THEN v_down := v_down + 1; END IF;

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

-- Allow authenticated users to call the RPC
GRANT EXECUTE ON FUNCTION vote_on_tournament_entry(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION vote_on_tournament_entry(TEXT, TEXT) TO anon;
