-- Allow anyone to read user_profile_display_items and trophies so other users' profiles
-- can show their chosen badges/trophies (display items are public profile data).

-- user_profile_display_items: allow SELECT for all rows (profile badges are public)
DROP POLICY IF EXISTS "Anyone can read display items for profiles" ON user_profile_display_items;
CREATE POLICY "Anyone can read display items for profiles"
  ON user_profile_display_items FOR SELECT
  USING (true);

-- trophies: allow anyone to SELECT so display item resolution works when viewing others' profiles
DROP POLICY IF EXISTS "Users read own trophies" ON trophies;
DROP POLICY IF EXISTS "Anyone can read trophies" ON trophies;
CREATE POLICY "Anyone can read trophies"
  ON trophies FOR SELECT
  USING (true);
