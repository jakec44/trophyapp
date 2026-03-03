-- =============================================================================
-- OPTIONAL: List auth users that have NO profile row
-- =============================================================================
--
-- Run this to find orphan auth.users (e.g. after reset_app_data).
-- These users can sign in but have no profile - ensureProfile() will create one.
--
-- To delete mock auth users, use delete_mock_auth_users.sql instead.
-- DO NOT run delete scripts in production without backup.
-- =============================================================================

-- List auth users with no profile
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ORDER BY au.created_at DESC;
