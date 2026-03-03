-- Add logbook_name to profiles so users' custom logbook names persist across devices.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logbook_name TEXT DEFAULT 'My Logbook';
