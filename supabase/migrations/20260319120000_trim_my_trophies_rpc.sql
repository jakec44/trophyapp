-- RPC: trim current user's trophy_badges to 2 (keeps 2 most recent by created_at).
-- Call from the app (e.g. Supabase client: supabase.rpc('trim_my_trophy_badges')) to run for your account only.
CREATE OR REPLACE FUNCTION trim_my_trophy_badges()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  WITH kept AS (
    SELECT id
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
      FROM trophy_badges
      WHERE user_id = auth.uid()
    ) t
    WHERE rn <= 2
  )
  DELETE FROM trophy_badges
  WHERE user_id = auth.uid() AND id NOT IN (SELECT id FROM kept);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
