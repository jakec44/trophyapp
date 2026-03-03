# Trophy Room — Launch Reset Checklist

Use this before launch to wipe all mock/test data and start clean.

---

## Level A: App Data Reset (Safe, Default)

1. **Run `reset_app_data.sql`**
   - Open Supabase Dashboard → SQL Editor
   - Run `supabase/dev/reset_app_data.sql`
   - Wipes: profiles, catches, stories, friendships, messages, mount_slots, leaderboard_entries, weekly_badges, generation_usage, crews (if exist)
   - Keeps: schema, policies, auth.users

2. **Optional: Delete mock profiles only** (if you want to keep real users)
   - Run `supabase/dev/delete_mock_profiles.sql`
   - Removes only rows where `is_mock = true`

3. **Confirm no mock profiles remain**
   ```sql
   SELECT COUNT(*) FROM profiles WHERE is_mock = true;
   -- Should return 0
   ```

---

## Level B: Full Dev Reset (Storage + Data)

For complete wipe in development:

1. Run `supabase/dev/reset_app_data.sql` (step 1 above)
2. **Clear storage buckets**
   - Run `supabase/dev/clear_storage.sql`
   - Clears: avatars, catch-photos, banners, catches, stories

---

## Optional: Auth Cleanup

After reset, auth.users may have orphan rows (users with no profile).

1. **List orphan auth users**
   - Run `supabase/dev/list_orphan_auth_users.sql`

2. **Delete mock auth users** (optional)
   - First run `delete_mock_profiles.sql`
   - Then run `supabase/dev/delete_mock_auth_users.sql` (see comments)
   - Or delete users manually in Supabase Dashboard → Auth → Users

**Important:** App uses `ensureProfile()` on sign-in, so orphans will get a new profile when they sign in again.

---

## App Boot Check

1. Start the app
2. Sign in with a real account
3. Confirm `ensureProfile()` creates a profile (no hardcoded mock users)
4. Verify no mock data appears in UI

---

## Tables Included in Wipe

| Table                | In reset_app_data |
|----------------------|-------------------|
| profiles             | ✅                |
| catches              | ✅ (via CASCADE)  |
| mount_slots          | ✅ (via CASCADE)  |
| friendships          | ✅ (via CASCADE)  |
| friend_invites       | ✅ (via CASCADE)  |
| messages             | ✅ (via CASCADE)  |
| leaderboard_entries  | ✅ (via CASCADE)  |
| weekly_badges        | ✅ (via CASCADE)  |
| generation_usage     | ✅ (via CASCADE)  |
| stories              | ✅                |
| crews, crew_members, crew_invites, crew_challenges | ✅ (via CASCADE, if exist) |

## Profile Schema Change

- **is_mock** (boolean, default false): Set `true` for seed/demo users. Real users always `false`.
- Remove mock users: `DELETE FROM profiles WHERE is_mock = true;`
- `ensureProfileForUser()` always sets `is_mock = false` for new profiles.

## Frontend Notes

- Profile screen uses `getUserProfile()` from Supabase when user is signed in.
- Tournament/leaderboard data is still mocked in `src/api/tournaments.ts` (not in DB yet).
- `mockUserProfile` in `utils/mockData.ts` is used as fallback when unauthenticated or for local demo. Seed scripts should set `is_mock = true` for any demo users inserted via SQL.
