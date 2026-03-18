# Notifications Setup

Users only receive two types of push notifications:

1. **Friend posted a catch** — when someone they follow (an accepted friend) posts a catch to the feed.
2. **Tournament ended** — when a tournament they **entered** has ended (only sent to users who have an entry in that tournament for the ended cycle).

All other notifications (leaderboard changes, tournament reminders, "could place" alerts, etc.) are disabled.

## Backend

### 1. Friend posted (Database Webhook)

When a row is inserted into `feed_posts`, invoke the Edge Function so it can notify the author's friends.

**Supabase Dashboard → Database → Webhooks → Create a new webhook:**

- **Name:** `notify-friend-posted`
- **Table:** `feed_posts`
- **Events:** Insert
- **Type:** Supabase Edge Functions
- **Function:** `notify-friend-posted`

The function will:

- Read `record.user_id` (post author).
- Find all users who are accepted friends of the author (`friendships` where `status = 'accepted'` and either side is the author).
- Get `push_token` from `profiles` for those friends.
- Send an Expo push to each token: title "New catch from {name}", body "{name} just posted a catch. Tap to see it."

### 2. Tournament ended (Cron)

Run the Edge Function on a schedule (e.g. every minute) so that when a tournament cycle ends, entrants get a push before the cycle is finalized.

**Option A — Supabase cron (if available):**

Schedule `notify-tournament-ended` to run every minute, e.g.:

```sql
SELECT cron.schedule(
  'notify-tournament-ended',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/notify-tournament-ended',
    headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;$$
);
```

(Use your project URL and service role key; `net.http_post` requires the `pg_net` extension.)

**Option B — External cron (e.g. GitHub Actions, Vercel Cron, or cron job):**

Call the Edge Function every minute:

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/notify-tournament-ended' \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
```

The function will:

- Find tournaments where `cycle_ends_at <= now()` and `last_ended_cycle_id` is null.
- For each such tournament, get **only users who have an entry** in `tournament_entries` for that `tournament_id` and `cycle_id`.
- Send an Expo push to each entrant’s `push_token`: title "{Tournament title} has ended", body "Check your results in Compete."
- Call `run_tournament_cycle_end()` to finalize and advance cycles (so the same users are not notified again).

## Deploy Edge Functions

```bash
supabase functions deploy notify-friend-posted
supabase functions deploy notify-tournament-ended
```

## App

- Push token is saved to `profiles.push_token` when the user grants notification permission (`usePushToken`).
- The Notifications screen explains: "You only get notified when a friend posts a catch or when a tournament you entered has ended."
