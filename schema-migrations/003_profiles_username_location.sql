-- Add username and location to profiles
-- Run this in Supabase SQL Editor

-- Add columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Update handle_new_user to set username from email prefix (unique)
-- Uses a helper to ensure uniqueness: email prefix + short suffix if needed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INT := 0;
BEGIN
  base_username := LOWER(REGEXP_REPLACE(COALESCE(
    split_part(NEW.email, '@', 1),
    'user'
  ), '[^a-z0-9]', '', 'g'));
  IF LENGTH(base_username) < 2 THEN
    base_username := 'user';
  END IF;

  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, display_name, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Angler'),
    final_username,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.id
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
