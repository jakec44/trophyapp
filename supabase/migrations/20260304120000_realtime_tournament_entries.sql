-- Enable Realtime for tournament_entries so all users see new entries instantly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tournament_entries;
  END IF;
END $$;
