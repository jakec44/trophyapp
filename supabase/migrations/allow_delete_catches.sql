-- Allow users to delete their own catches (required for "Delete Log" in app).
-- Run this in Supabase Dashboard → SQL Editor (one-time), or via Supabase CLI migrations.

DROP POLICY IF EXISTS "Users can delete own catches" ON catches;

CREATE POLICY "Users can delete own catches"
  ON catches FOR DELETE
  USING (auth.uid() = user_id);
