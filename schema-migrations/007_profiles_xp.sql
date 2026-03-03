-- ============================================================
-- 007_profiles_xp.sql
-- Adds total_xp to profiles so XP can be compared across users
-- for a real Global Rank leaderboard.
-- ============================================================

-- 1. Add column (safe to run more than once)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0;

-- 2. Index for fast rank queries (ORDER BY total_xp DESC)
CREATE INDEX IF NOT EXISTS profiles_total_xp_idx
  ON profiles (total_xp DESC);

-- 3. RLS: users can update their own XP (existing update policy covers this,
--    but we add an explicit check so only the owner can write it)
--    The existing policy "Users update own profile" already uses:
--      ON profiles FOR UPDATE USING (auth.uid() = id)
--    so no new policy is needed.

-- 4. (Optional) Backfill: if you want to zero out existing rows explicitly
-- UPDATE profiles SET total_xp = 0 WHERE total_xp IS NULL;
