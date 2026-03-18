# How to Fix Notifications (get them working)

Follow these steps in order.

---

## 1. Deploy the Edge Functions

From your project root (with Supabase CLI logged in):

```bash
supabase functions deploy notify-friend-posted
supabase functions deploy notify-tournament-ended
```

If you get "function not found", the function folders must exist under `supabase/functions/` (e.g. `notify-friend-posted/index.ts` and `notify-tournament-ended/index.ts`).

---

## 2. Turn on the "friend posted" webhook

This sends a push when someone posts a catch so their **friends** get notified.

1. Open **Supabase Dashboard** → your project.
2. Go to **Database** → **Webhooks**.
3. Click **Create a new webhook**.
4. Set:
   - **Name:** `notify-friend-posted`
   - **Table:** `feed_posts`
   - **Events:** check **Insert** only.
   - **Type:** Supabase Edge Functions.
   - **Function:** `notify-friend-posted`.
5. Save.

After this, every new row in `feed_posts` will trigger the function and notify the author’s friends (who have a push token).

---

## 3. Run "tournament ended" on a schedule

This sends a push to users who **entered** a tournament when that tournament’s cycle ends.

**Option A – External cron (e.g. your server or a cron service)**

Call the function every minute:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-tournament-ended' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

Replace:
- `YOUR_PROJECT_REF` with your Supabase project ref (from project URL).
- `YOUR_SERVICE_ROLE_KEY` with the service role key (Settings → API in dashboard).

**Option B – Supabase pg_cron (if you have pg_net)**

If your project has the `pg_net` extension, you can schedule the HTTP call from SQL. See `docs/NOTIFICATIONS_SETUP.md` for the exact SQL.

---

## 4. App side (so the device can receive pushes)

- **Build:** Use a **real device build** (EAS Build or Xcode archive). Push does not work in Expo Go or simulator for production tokens.
- **Permission:** The app asks for notification permission when the user is signed in; they must tap **Allow**.
- **Token:** Once allowed, the app saves the Expo push token to `profiles.push_token`. You can confirm in Supabase: **Table Editor** → `profiles` → check `push_token` for your test user.

---

## 5. Quick test

**Friend posted:**
1. User A and User B are friends (accepted).
2. Both have signed in on real device builds and allowed notifications (so both have `push_token` in `profiles`).
3. User A posts a catch to the feed (creates a row in `feed_posts`).
4. User B should get a push: "New catch from {A's name}".

**Tournament ended:**
1. User has entered a tournament and has a `push_token`.
2. When that tournament’s cycle ends (e.g. `cycle_ends_at` in the past and cron has run), the user should get: "{Tournament title} has ended - Check your results in Compete."

---

## If it still doesn’t work

- **No push at all:** Confirm `profiles.push_token` is set for the recipient and the value looks like `ExponentPushToken[...]`. Confirm the Edge Function is deployed and (for friend posted) the webhook is enabled and shows successful runs.
- **Friend posted not firing:** In Supabase, Database → Webhooks → open the webhook and check **Recent deliveries** for errors. Check Edge Function logs (Functions → `notify-friend-posted` → Logs).
- **Tournament ended not firing:** Call the function manually with the curl above and check the response and Edge Function logs. Ensure your cron is actually running every minute (or as often as you need).
