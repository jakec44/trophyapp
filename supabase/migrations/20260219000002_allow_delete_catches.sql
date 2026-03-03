-- Allow users to delete their own catches (required for "Delete Log" in logbook).
-- Run via: supabase db push, or paste into Supabase Dashboard → SQL Editor.

DROP POLICY IF EXISTS "Users can delete own catches" ON catches;

CREATE POLICY "Users can delete own catches"
  ON catches FOR DELETE
  USING (auth.uid() = user_id);
