# Notifications — Step-by-step (terminal preferred)

Do these in order. Terminal steps are marked with `$`.

---

## Step 1: Deploy both Edge Functions (terminal)

From your project folder:

```bash
supabase functions deploy notify-friend-posted
supabase functions deploy notify-tournament-ended
```

Wait until each says "Deployed Functions on project ...".  
You can ignore "Docker is not running" — it doesn't affect cloud deploy.

---

## Step 2: Create the "friend posted" webhook (Dashboard only)

Webhooks can't be created from the Supabase CLI; use the dashboard.

1. Open: **https://supabase.com/dashboard/project/iutwkyiiendlqxytdzih**
2. In the left sidebar click **Database** → **Webhooks**.
3. Click **Create a new webhook**.
4. Fill in:
   - **Name:** `notify-friend-posted`
   - **Table:** `feed_posts`
   - **Events:** tick only **Insert**
   - **Type:** Supabase Edge Functions
   - **Function:** `notify-friend-posted`
5. Click **Create** (or **Save**).

Done. Every new feed post will now trigger that function.

---

## Step 3: Get your Service Role Key (for Step 4)

1. In the same project, go to **Settings** (gear) → **API**.
2. Under **Project API keys**, copy **service_role** (the secret one).  
   It is a **long JWT** that starts with `eyJ` and has two dots in it (e.g. `eyJhbGciOiJIUzI1NiIsInR5cCI6...`).  
   Do **not** use a value that starts with `sb_secret_` — that’s a different kind of secret.
3. You’ll use the copied value as `YOUR_SERVICE_ROLE_KEY` in the next step.

---

## Step 4: Test "tournament ended" from terminal

Run this once (replace `YOUR_SERVICE_ROLE_KEY` with the key from Step 3):

**PowerShell:**

```powershell
curl.exe -X POST "https://iutwkyiiendlqxytdzih.supabase.co/functions/v1/notify-tournament-ended" -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Cmd:**

```cmd
curl -X POST "https://iutwkyiiendlqxytdzih.supabase.co/functions/v1/notify-tournament-ended" -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

You should get JSON back like `{"ok":true,"tournaments_checked":...,"notifications_sent":...}`.  
That means the function works. Next is to run it every minute.

---

## Step 5: Run "tournament ended" every minute (pick one)

You need something to call that URL every minute. Options:

### Option A: Windows Task Scheduler (no extra signup)

1. Open **Task Scheduler**.
2. **Create Basic Task** → Name: `Supabase notify-tournament-ended` → **Next**.
3. Trigger: **Daily** → **Next** → set time → **Next**.
4. Action: **Start a program** → **Next**.
5. Program: `curl.exe`  
   Add arguments (one line):
   ```text
   -X POST "https://iutwkyiiendlqxytdzih.supabase.co/functions/v1/notify-tournament-ended" -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```
6. **Next** → **Finish**.
7. Right‑click the new task → **Properties**:
   - **Triggers** → **Edit** → set **Repeat task every** to **1 minute**.
   - **OK** → **OK**.

Your PC must be on for this to run.

### Option B: Free cron service (e.g. cron-job.org)

1. Sign up at **https://cron-job.org** (or similar).
2. Create a cron job:
   - **URL:** `https://iutwkyiiendlqxytdzih.supabase.co/functions/v1/notify-tournament-ended`
   - **Method:** POST
   - **Header:** `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
   - **Schedule:** every minute (`* * * * *`).
3. Save. The service will call your function every minute.

### Option C: Run by hand when you care

If you don’t need every-minute checks, you can run the same `curl` from Step 4 whenever you want to process ended tournaments (e.g. after a tournament cycle ends).

---

## Step 6: App side (no terminal)

- Build the app with **EAS Build** (or Xcode) and install via **TestFlight** (or direct install).  
  Push does **not** work in Expo Go for these production tokens.
- When a user opens the app and signs in, they must tap **Allow** when asked for notification permission.
- The app then saves their Expo push token to `profiles.push_token`.  
  You can check in **Table Editor** → **profiles** → column **push_token**.

---

## Quick reference

| What | Where |
|------|--------|
| Deploy functions | Terminal: `supabase functions deploy notify-friend-posted` then `notify-tournament-ended` |
| Webhook (friend posted) | Dashboard → Database → Webhooks → Create (table `feed_posts`, Insert, function `notify-friend-posted`) |
| Service role key | Dashboard → Settings → API → service_role |
| Test tournament ended | Terminal: `curl -X POST "https://iutwkyiiendlqxytdzih.supabase.co/..." -H "Authorization: Bearer KEY"` |
| Run every minute | Task Scheduler (Windows) or cron-job.org (or run curl by hand) |

That’s the full walkthrough. After Step 1–2 and 5, friend-post and tournament-ended notifications will be sent when the app has stored a push token for the user.
