-- profiles: add name, backfill from display_name, case-insensitive unique username
-- Keeps display_name for backward compatibility. App uses: name (display), username (@handle).
-- display_name is synced with name on save for legacy consumers.

-- A) Add name column if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;

-- B) Backfill
-- name = COALESCE(name, display_name)
UPDATE profiles SET name = COALESCE(name, display_name) WHERE name IS NULL;

-- display_name = COALESCE(display_name, name) (in case display_name was null)
UPDATE profiles SET display_name = COALESCE(display_name, name) WHERE display_name IS NULL;

-- username: generate temp if null (user_ + 12 hex chars from id, effectively unique)
UPDATE profiles
SET username = COALESCE(
  NULLIF(TRIM(username), ''),
  'user_' || lower(left(replace(id::text, '-', ''), 12))
)
WHERE username IS NULL OR TRIM(username) = '';

-- C) Constraints: case-insensitive unique username
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
DROP INDEX IF EXISTS idx_profiles_username_lower;
CREATE UNIQUE INDEX idx_profiles_username_lower ON profiles (lower(username)) WHERE username IS NOT NULL AND trim(username) != '';

-- Recreate simple index for lookups (optional, for perf)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;

-- D) Update handle_new_user to set name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  disp TEXT;
  suffix INT := 0;
BEGIN
  disp := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'Angler'
  );
  base_username := lower(regexp_replace(
    COALESCE(split_part(NEW.email, '@', 1), 'user'),
    '[^a-z0-9_]', '', 'g'
  ));
  IF length(base_username) < 3 THEN
    base_username := 'user';
  END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(final_username)) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, display_name, name, username, avatar_url)
  VALUES (
    NEW.id,
    disp,
    disp,
    final_username,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.id
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
