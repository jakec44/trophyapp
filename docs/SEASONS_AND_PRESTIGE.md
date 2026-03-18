# Seasons + Prestige System

## Overview

- **Seasons**: 45-day cycles. AR resets at rollover. Leaderboard shows current season and days left.
- **Prestige**: At level 15, users can prestige (reset level to 1, gain Prestige 1–3). Max 3 prestige.

## Database

Run migrations (already in `supabase/migrations/`):

```bash
npx supabase db push
```

### New Tables

- `seasons` — season_number, name, start_date, end_date, is_active
- `season_results` — archived AR and rank per user per season

### New Columns

- `profiles.prestige` — 0–3, default 0

### New RPCs

- `get_current_season()` — returns active season info (name, days_remaining)
- `season_rollover()` — archives AR, resets all AR to 0, creates next season. Idempotent.
- `prestige_now()` — resets level/XP to 1/0, increments prestige. Requires level 15, prestige < 3.

## Season Rollover (Cron)

To run season rollover automatically when a season ends:

### Option 1: Supabase Edge Function + External Cron

1. Deploy the Edge Function:
   ```bash
   npx supabase functions deploy season-rollover
   ```

2. Call it via cron (e.g. daily at 00:05 UTC):
   - **Vercel Cron**: Add to `vercel.json` or use Vercel Cron Jobs.
   - **GitHub Actions**: Schedule a workflow to POST to the function URL.
   - **Supabase Dashboard**: Use Database → Extensions → pg_cron (if available).

3. Function URL:
   ```
   https://<project-ref>.supabase.co/functions/v1/season-rollover
   ```
   Use `Authorization: Bearer <service_role_key>` or `Authorization: Bearer <anon_key>` (RLS applies).

### Option 2: Manual

Run in Supabase SQL Editor when a season has ended:

```sql
SELECT season_rollover();
```

### Option 3: Supabase pg_cron (Pro)

If your project has pg_cron enabled:

```sql
SELECT cron.schedule(
  'season-rollover',
  '5 0 * * *',  -- daily at 00:05 UTC
  $$SELECT season_rollover()$$
);
```

## Env Variables

- `SUPABASE_URL` — set automatically in Edge Functions
- `SUPABASE_SERVICE_ROLE_KEY` — required for `season-rollover` Edge Function (bypasses RLS)

## Files Changed

### Migrations
- `supabase/migrations/20260328000000_seasons_and_prestige.sql`
- `supabase/migrations/20260328010000_season_rollover_and_prestige_rpc.sql`
- `supabase/migrations/20260328020000_get_current_season_rpc.sql`

### Supabase
- `supabase/functions/season-rollover/index.ts`

### App
- `src/lib/supabase.ts` — getCurrentSeason, prestigeNow, getSeasonResultsForUser
- `src/hooks/useSeason.ts` — useSeason()
- `src/hooks/useGamification.ts` — refreshXpFromServer
- `src/types/gamification.ts` — MAX_PRESTIGE
- `src/components/profile/ProfileHeader.tsx` — prestige, onLevelPress, prestigeLabel
- `src/components/profile/PrestigeModal.tsx` — new
- `app/(tabs)/profile.tsx` — prestige modal, level tap handler
- `app/(tabs)/leaderboard.tsx` — season name, days left

## Regenerate Types

After running migrations:

```bash
npm run supabase:types
```
