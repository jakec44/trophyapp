-- =============================================================================
-- DEV ONLY: Wipes app data for clean testing/launch.
-- =============================================================================
--
-- LEVEL A: APP DATA RESET (safe, default)
-- - Deletes ALL app data tables only
-- - Does NOT delete auth.users
-- - Keeps schema, policies, and migrations intact
--
-- Run in Supabase SQL Editor. Do NOT run in production without backup.
--
-- Tables included (CASCADE handles dependents):
--   profiles -> catches, mount_slots, friendships, friend_invites, messages,
--   leaderboard_entries, weekly_badges, generation_usage, crews, crew_members,
--   crew_invites, crew_challenges
--   stories (references auth.users)
-- =============================================================================

BEGIN;

-- profiles is the root: CASCADE truncates all tables that reference it
-- (catches, friendships, friend_invites, messages, leaderboard_entries,
--  weekly_badges, generation_usage, mount_slots, crews -> crew_members, etc.)
TRUNCATE TABLE public.profiles RESTART IDENTITY CASCADE;

-- stories references auth.users (not profiles)
TRUNCATE TABLE public.stories RESTART IDENTITY CASCADE;

COMMIT;
