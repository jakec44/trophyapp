# Supabase Setup Checklist

Run these in order. Use **Supabase Dashboard → SQL Editor** and paste each file's contents, or use Supabase CLI if linked.

## 1. Base schema (if new project)

Run `schema.sql` first to create tables (profiles, catches, etc.).

## 2. Migrations (in order)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `schema-migrations/003_profiles_username_location.sql` | Username, location, handle_new_user |
| 2 | `supabase/migrations/20260219100000_add_ai_fields_to_catches.sql` | AI columns (optional, kept for future) |
| 3 | `supabase/migrations/20260219000001_add_enhanced_url_to_catches.sql` | enhanced_url |
| 4 | `supabase/migrations/20260224100000_clean_backbone.sql` | RLS, handle_new_user, upload_status |
| 5 | `supabase/migrations/20260224100001_storage_backbone.sql` | avatars, catch-photos buckets |
| 6 | `supabase/migrations/20260225000000_add_banners_and_catches_buckets.sql` | **banners, catches buckets + policies** |

## 3. Dashboard checks

- **Authentication → Providers**: Enable **Email**
- **Storage**: Confirm buckets `avatars`, `banners`, `catches` exist and are public

## 4. Done

Auth, profiles, logbook, and photo uploads should work.
