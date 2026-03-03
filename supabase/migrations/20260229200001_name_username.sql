-- Name and Username: name can repeat, username must be unique.
-- display_name = "Name" (reusable, no constraint)
-- username = "@handle" (unique across users)

-- Ensure username is unique (no two users can share it)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);

-- Ensure display_name has no unique constraint (names can be reused infinitely)
-- (display_name already has no unique constraint by default)
