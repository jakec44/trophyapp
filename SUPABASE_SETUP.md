# Supabase Setup for TrophyApp

## Required for new installs

### 1. Environment variables

Create `.env.local` (or set in your Expo config):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Database schema

Run the schema in `schema.sql` in the Supabase SQL Editor (Dashboard → SQL Editor). This creates:

- `profiles`, `catches`, `friendships`, `messages`, etc.
- RLS policies (profiles are publicly readable; users can update own profile)

### 3. Auto-create profile on signup (recommended)

Run `schema-migrations/002_auto_create_profile.sql` in the Supabase SQL Editor. This adds a trigger so a `profiles` row is created automatically when a user signs up.

Then run `schema-migrations/003_profiles_username_location.sql` to add `username` and `location` columns and update the trigger.

**If you skip this:** The app will still work. When a user signs in, the app creates the profile on first load (client-side fallback). But applying the trigger is more reliable and avoids a round-trip on first sign-in.

### 4. Storage buckets (for image uploads)

Create these buckets in Supabase Storage (Dashboard → Storage):

- `avatars` – profile avatars (public)
- `banners` – profile banners (public)
- `catches` – catch photos (public)

For each bucket, enable public access if you want images to be viewable without auth.

### 5. Auth providers

- **Email/password**: Enable in Supabase Dashboard → Authentication → Providers
- **Apple Sign In**: Configure in Dashboard and add the Apple credentials to your Expo app

## PGRST116 / "zero rows" fix

If you saw `Get profile error code PGRST116` (profile query returning zero rows), this has been fixed:

1. **getUserProfile** now uses `.limit(1)` instead of `.single()`, so no error when the profile doesn’t exist yet.
2. **ensureProfileForUser** creates a profile if one is missing when the user signs in.
3. **useAuth** calls `ensureProfileForUser` when `getUserProfile` returns null, so users are not treated as signed out.

No manual migration is required for this fix.
