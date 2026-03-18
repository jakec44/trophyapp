-- Logbook visibility: public (everyone), friends only, or private (only me).
-- Existing profiles.public: true = everyone, false = friends only.
-- New profiles.logbook_private: when true, only owner can see logbook (overrides public).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logbook_private BOOLEAN DEFAULT false;
COMMENT ON COLUMN profiles.logbook_private IS 'When true, only the owner can see their logbook. When false, visibility is determined by public (true=everyone, false=friends only).';

-- Others can read only when profile is not logbook_private AND (public or friend)
DROP POLICY IF EXISTS "Users can read public or friend catches" ON catches;
CREATE POLICY "Users can read public or friend catches"
  ON catches FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() != user_id
    AND COALESCE(
      (SELECT p.logbook_private FROM profiles p WHERE p.id = catches.user_id),
      false
    ) = false
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
