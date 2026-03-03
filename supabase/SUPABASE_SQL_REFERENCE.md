# Supabase SQL Reference

Run these in **Supabase Dashboard → SQL Editor**, or use `npx supabase db push` to apply migrations.

---

## 1. Logbook name (persist custom logbook names)

Saves custom logbook names to profiles so they sync across devices.

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logbook_name TEXT DEFAULT 'My Logbook';
```

---

## 2. Feed posts (profile + home feed)

Required for posts to save and appear on profiles.

```sql
CREATE TABLE IF NOT EXISTS feed_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_path TEXT,
  photo_url TEXT,
  species TEXT NOT NULL DEFAULT '',
  weight_lb FLOAT NOT NULL DEFAULT 0,
  length_in FLOAT,
  caption TEXT,
  location TEXT,
  catch_id UUID REFERENCES catches(id) ON DELETE SET NULL,
  hype_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id ON feed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);

ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Feed posts are publicly readable" ON feed_posts;
CREATE POLICY "Feed posts are publicly readable" ON feed_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own feed posts" ON feed_posts;
CREATE POLICY "Users can insert own feed posts" ON feed_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own feed posts" ON feed_posts;
CREATE POLICY "Users can update own feed posts" ON feed_posts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own feed posts" ON feed_posts;
CREATE POLICY "Users can delete own feed posts" ON feed_posts FOR DELETE USING (auth.uid() = user_id);
```

---

## 3. Allow delete catches (logbook delete)

```sql
DROP POLICY IF EXISTS "Users can delete own catches" ON catches;
CREATE POLICY "Users can delete own catches" ON catches FOR DELETE USING (auth.uid() = user_id);
```

---

## 4. Tournaments (entries, votes, free-user limit)

**4a. Tables and RLS (if not already applied):**

See `supabase/migrations/20260228300000_tournaments.sql` and `20260228300001_tournaments_seed.sql`.

**4b. Voting RPC (required for leaderboard voting — shared across all users, 50%+ downvotes at 10+ votes = removal)**

```sql
CREATE OR REPLACE FUNCTION vote_on_tournament_entry(p_entry_id TEXT, p_vote TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_entry RECORD;
  v_prev_vote TEXT;
  v_up INT; v_down INT; v_total INT;
  v_removed BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in to vote'; END IF;
  SELECT * INTO v_entry FROM tournament_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF v_entry.user_id = v_user_id THEN RAISE EXCEPTION 'Cannot vote on your own entry'; END IF;
  SELECT vote INTO v_prev_vote FROM tournament_entry_votes WHERE entry_id = p_entry_id AND user_id = v_user_id;
  v_up := v_entry.up_votes; v_down := v_entry.down_votes;
  IF v_prev_vote = 'UP' THEN v_up := v_up - 1; END IF;
  IF v_prev_vote = 'DOWN' THEN v_down := v_down - 1; END IF;
  IF p_vote = 'UP' THEN v_up := v_up + 1; END IF;
  IF p_vote = 'DOWN' THEN v_down := v_down + 1; END IF;
  -- Clamp to avoid CHECK (up_votes >= 0, down_votes >= 0) violations when counts are out of sync
  v_up := GREATEST(0, v_up);
  v_down := GREATEST(0, v_down);
  v_total := v_up + v_down;
  v_removed := (v_total >= 10 AND v_total > 0 AND v_down::float / v_total >= 0.5);
  IF v_removed THEN
    DELETE FROM tournament_entries WHERE id = p_entry_id;
    RETURN jsonb_build_object('upVotes', v_up, 'downVotes', v_down, 'userVote', p_vote, 'removed', true);
  END IF;
  UPDATE tournament_entries SET up_votes = v_up, down_votes = v_down WHERE id = p_entry_id;
  IF p_vote IS NOT NULL AND p_vote != '' THEN
    INSERT INTO tournament_entry_votes (entry_id, user_id, vote) VALUES (p_entry_id, v_user_id, p_vote)
    ON CONFLICT (entry_id, user_id) DO UPDATE SET vote = p_vote;
  ELSE
    DELETE FROM tournament_entry_votes WHERE entry_id = p_entry_id AND user_id = v_user_id;
  END IF;
  RETURN jsonb_build_object('upVotes', v_up, 'downVotes', v_down, 'userVote', p_vote, 'removed', false);
END;
$$;
GRANT EXECUTE ON FUNCTION vote_on_tournament_entry(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION vote_on_tournament_entry(TEXT, TEXT) TO anon;
```

**4c. Free users: one tournament at a time**

```sql
CREATE OR REPLACE FUNCTION check_free_user_tournament_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan TEXT;
  v_other_count INT;
BEGIN
  SELECT p.subscription_plan INTO v_plan FROM profiles p WHERE p.id = NEW.user_id;
  IF v_plan IS NULL OR v_plan != 'free' THEN RETURN NEW; END IF;

  SELECT COUNT(*)::INT INTO v_other_count
  FROM tournament_entries WHERE user_id = NEW.user_id AND tournament_id != NEW.tournament_id;

  IF v_other_count >= 1 THEN
    RAISE EXCEPTION 'Free accounts can only enter one tournament at a time.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_free_tournament_limit ON tournament_entries;
CREATE TRIGGER trg_check_free_tournament_limit
  BEFORE INSERT ON tournament_entries FOR EACH ROW
  EXECUTE FUNCTION check_free_user_tournament_limit();
```

---

## 5. Name and Username (profiles)

- **Name** (`display_name`): can be used by many users (no unique constraint).
- **Username**: must be unique — no two users can have the same username.

```sql
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
```

---

## 6. Fish nickname (logbook)

Persists custom fish nicknames (e.g. "Bruce") in the logbook forever.

```sql
ALTER TABLE catches ADD COLUMN IF NOT EXISTS fish_nickname TEXT;
```

---

## 7. Feed interactions (hype, comments, share)

Persist and sync comments, likes (hype), and share counts for feed posts across all accounts.

**Run:** `supabase/migrations/20260229400000_feed_interactions.sql`

- Adds `share_count` to `feed_posts`
- Creates `feed_post_hypes` (who hyped which post) for accurate `hype_count`
- Creates `feed_comments` for persistent comments
- RPCs (SECURITY DEFINER, bypass RLS for counts):
  - `hype_feed_post(post_id UUID, hype BOOLEAN)` — toggle hype, returns `{hypeCount, isHyped}`
  - `add_feed_comment(post_id UUID, text TEXT, parent_id UUID DEFAULT NULL)` — add comment, returns `{commentId, commentCount}`
  - `increment_feed_share(post_id UUID)` — increment share count, returns `{shareCount}`

---

## Quick apply

To run all migrations from the repo:

```bash
npx supabase db push
```

Or run the SQL blocks above manually in Supabase SQL Editor in the order shown.
