-- Add fish nickname to catches (e.g. "Bruce") — displayed in logbook forever.
ALTER TABLE catches ADD COLUMN IF NOT EXISTS fish_nickname TEXT;
