# Run "tournament ended" every minute with pg_cron (no external cron)

You need **pg_cron** and **pg_net** in Supabase. Then run the SQL below in the **SQL Editor** (Dashboard → SQL Editor). Do **not** put your real service_role key in a file in the repo.

---

## Step 1: Enable pg_net (if needed)

In **SQL Editor**, run:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

(If you get "permission denied" or "already exists", skip or adjust; your project may already have it.)

---

## Step 2: Store your service_role key in Vault (one-time)

1. In Supabase Dashboard go to **Settings** → **API** and copy your **service_role** key (the long one starting with `eyJ...`).
2. In **SQL Editor**, run this **once** — replace `YOUR_SERVICE_ROLE_KEY_PASTE_HERE` with that key:

```sql
SELECT vault.create_secret(
  'YOUR_SERVICE_ROLE_KEY_PASTE_HERE',
  'service_role_key',
  'Used by pg_cron to call notify-tournament-ended Edge Function'
);
```

If Vault is not available in your project, use **Option B** below instead.

---

## Step 3: Schedule the job (every minute)

In **SQL Editor**, run:

```sql
SELECT cron.schedule(
  'notify-tournament-ended',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iutwkyiiendlqxytdzih.supabase.co/functions/v1/notify-tournament-ended',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

That runs every minute and calls your Edge Function with the key from Vault. You can stop using cron-job.org (or any external cron) for this.

---

## If you don't have Vault: Option B (key in SQL, run only in Dashboard)

Run this **only in the SQL Editor** in the Dashboard. Replace `YOUR_SERVICE_ROLE_KEY` with your real key. **Do not commit this to git.**

```sql
SELECT cron.schedule(
  'notify-tournament-ended',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://iutwkyiiendlqxytdzih.supabase.co/functions/v1/notify-tournament-ended',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Check that it's scheduled

In **SQL Editor**:

```sql
SELECT * FROM cron.job WHERE jobname = 'notify-tournament-ended';
```

To unschedule later:

```sql
SELECT cron.unschedule('notify-tournament-ended');
```
