-- Logbook visibility: public (everyone) or private (friends only). Posts stay public.
-- profiles.public = true → everyone can see logbook; false → only friends can see.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public BOOLEAN DEFAULT true;
COMMENT ON COLUMN profiles.public IS 'Logbook visibility: true = everyone, false = only friends';

-- Ensure owner can always read own catches
DROP POLICY IF EXISTS "Users can read own catches" ON catches;
CREATE POLICY "Users can read own catches"
  ON catches FOR SELECT
  USING (auth.uid() = user_id);

-- Others can read catches when profile is public OR viewer is accepted friend
DROP POLICY IF EXISTS "Users can read public or friend catches" ON catches;
CREATE POLICY "Users can read public or friend catches"
  ON catches FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() != user_id
    AND (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = catches.user_id
        AND COALESCE(p.public, true) = true
      )
      OR EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
        AND (
          (f.user_id_1 = auth.uid() AND f.user_id_2 = catches.user_id)
          OR (f.user_id_2 = auth.uid() AND f.user_id_1 = catches.user_id)
        )
      )
    )
  );
