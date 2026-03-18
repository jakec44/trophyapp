-- When a user deletes a catch that was entered into a tournament, delete the tournament entry.
-- Change tournament_entries.catch_id FK from ON DELETE SET NULL to ON DELETE CASCADE.

ALTER TABLE tournament_entries
  DROP CONSTRAINT IF EXISTS tournament_entries_catch_id_fkey;

ALTER TABLE tournament_entries
  ADD CONSTRAINT tournament_entries_catch_id_fkey
  FOREIGN KEY (catch_id) REFERENCES catches(id) ON DELETE CASCADE;
