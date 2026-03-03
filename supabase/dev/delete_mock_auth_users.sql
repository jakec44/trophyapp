-- =============================================================================
-- OPTIONAL: Delete auth.users for mock profiles only
-- =============================================================================
--
-- DELICATE: Run ONLY after delete_mock_profiles.sql and confirming mock list.
-- This uses auth.admin_delete_user() - requires superuser or auth admin.
--
-- Steps:
-- 1. Run: SELECT id, email FROM profiles WHERE is_mock = true;
-- 2. Confirm these are mock users only.
-- 3. Run delete_mock_profiles.sql first.
-- 4. Then run this script (or use Supabase Dashboard Auth > Users to delete).
--
-- Supabase Dashboard: Auth > Users > select user > Delete
-- Or via SQL (requires service_role):
-- =============================================================================

-- Option A: List IDs to delete (run first, verify, then delete manually in Dashboard)
SELECT id, email FROM public.profiles WHERE is_mock = true;

-- Option B: Delete via Supabase auth schema (run in SQL Editor as service_role)
-- Uncomment and run ONLY after verifying the SELECT above
/*
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE is_mock = true
  LOOP
    PERFORM auth.admin_delete_user(r.id);
  END LOOP;
END $$;
*/
