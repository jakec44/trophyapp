-- Allow anyone to read trophy_badges so profile display items can resolve when
-- trophy_id in user_profile_display_items references trophy_badges.id (e.g. from
-- Display sheet using getTrophyBadges or legacy data).

DROP POLICY IF EXISTS "Anyone can read trophy badges for profile display" ON trophy_badges;
CREATE POLICY "Anyone can read trophy badges for profile display"
  ON trophy_badges FOR SELECT
  USING (true);
