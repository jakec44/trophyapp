# TestFlight: "Network request failed" on sign-in

If the app on TestFlight shows **"Network request failed"** when you try to sign in, the build was created **without your Supabase URL and anon key**. EAS Build does not use your local `.env`; you must provide them as **EAS Secrets** and then create a new build.

## Fix (one-time setup)

1. **Add EAS Secrets** (run in your project root):

   ```bash
   eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT_REF.supabase.co" --type string
   eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --type string
   ```

   Use the same values as in your local `.env` (from [Supabase](https://supabase.com/dashboard) → Project Settings → API: Project URL and anon/public key).

2. **Create a new build and submit to TestFlight**:

   ```bash
   eas build --platform ios --profile production
   ```

   After the build finishes, submit to TestFlight (or use `eas submit`). Install the new build; sign-in should work.

## Why this happens

- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are read at **build time**.
- Local `.env` files are not uploaded to EAS for security.
- Without secrets, the app may use placeholders or empty values, so requests fail with "Network request failed".

## Verify secrets

```bash
eas secret:list
```

You should see `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Do not commit real keys to git; use EAS Secrets only.
