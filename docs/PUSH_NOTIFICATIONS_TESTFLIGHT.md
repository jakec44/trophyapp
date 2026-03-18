# Push Notifications on TestFlight

The app registers for push notifications and stores the **Expo push token** in `profiles.push_token` when the user is signed in. You can send notifications to TestFlight (and production) builds using the Expo Push API.

## Requirements

1. **New build** – After adding `expo-notifications`, create a new EAS build and install via TestFlight (push entitlements are baked into the build).
2. **User permission** – The user must allow notifications when prompted (or in Settings).
3. **Physical device** – Push does not work on simulator.

## Sending a test notification

1. Get the user's push token from Supabase:
   - **Dashboard** → Table Editor → `profiles` → find the user → copy `push_token` (e.g. `ExponentPushToken[xxxxxx]`).
   - Or run SQL: `SELECT id, display_name, push_token FROM profiles WHERE push_token IS NOT NULL LIMIT 10;`

2. Send via Expo Push API (e.g. with curl):

   ```bash
   curl -X POST https://exp.host/--/api/v2/push/send \
     -H "Content-Type: application/json" \
     -d '{
       "to": "ExponentPushToken[YOUR_TOKEN_HERE]",
       "title": "Snagged",
       "body": "Test notification from TestFlight"
     }'
   ```

3. Or send to multiple tokens:

   ```json
   {
     "messages": [
       { "to": "ExponentPushToken[xxx]", "title": "Snagged", "body": "Hello!" },
       { "to": "ExponentPushToken[yyy]", "title": "Snagged", "body": "Hello!" }
     ]
   }
   ```

## EAS / TestFlight notes

- **Credentials** – EAS Build uses your Apple push key (or generates one) when you build with the `expo-notifications` plugin. No extra step if you use EAS Build for TestFlight.
- If the token is `null` in TestFlight, ensure the user granted notification permission and the app was built with the notifications plugin (run a new `eas build --profile preview` or `production` and reinstall from TestFlight).
- **Expo Push API** works for both development and production tokens; use the same `https://exp.host/--/api/v2/push/send` endpoint.

## Backend (e.g. tournament reminder)

To send from Supabase or a cron job:

1. Query `profiles.push_token` for users you want to notify.
2. POST to `https://exp.host/--/api/v2/push/send` with a body like:
   `{ "to": "<token>", "title": "Snagged", "body": "Your tournament ends in 1 hour!" }`.
3. No API key is required for the Expo Push API (it’s rate-limited per token).
