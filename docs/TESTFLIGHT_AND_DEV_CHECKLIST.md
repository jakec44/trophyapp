# TestFlight & Dev Build Checklist

## EAS Environment Variables — Verified

| Environment | EXPO_PUBLIC_SUPABASE_URL | EXPO_PUBLIC_SUPABASE_ANON_KEY |
|-------------|--------------------------|-------------------------------|
| development | Set (secret)             | Set (secret)                  |
| preview     | Set (secret)             | Set (secret)                  |
| production  | Set (secret)             | Set (secret)                  |

All three environments have both Supabase variables. TestFlight (production) and dev builds (development) will receive them automatically.

## Build Profiles

| Profile      | Distribution | Uses env  | Sign-in / network |
|-------------|--------------|-----------|--------------------|
| production  | store        | production| Yes (TestFlight)   |
| development | internal     | development | Yes (dev client) |
| preview     | internal     | preview   | Yes                |

## Local dev (Expo Go or dev client with `npm start`)

- Uses `.env.local` and `.env` (see `package.json` start scripts).
- Ensure `.env.local` exists with:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://iutwkyiiendlqxytdzih.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
  ```
- Copy from `.env.example` and fill in keys.

## Quick verification

1. TestFlight: `eas build --platform ios --profile production` → submit to TestFlight → sign in should work.
2. Dev build: `eas build --platform ios --profile development` → install via link/QR → sign in should work.
3. Local: Run `npm start`, open app in Expo Go or dev client → sign in should work if `.env.local` has correct values.
