# Build and Publish to TestFlight

Step-by-step to build your iOS app and publish it to TestFlight for testers.

---

## Prerequisites

- **Apple Developer account** (paid, $99/year) — [developer.apple.com](https://developer.apple.com)
- **Expo / EAS account** — you’re already logged in if `eas whoami` works
- **EAS CLI** — `npm install -g eas-cli` then `eas login`
- **Project linked to EAS** — this repo has `projectId` in `app.json`; if not, run `eas init`

---

## 1. Apple Developer setup (one-time)

### App and bundle ID

- In [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → create an app (or use existing).
- Use the same **bundle ID** as in your app: **`com.jakec44.snagged`** (see `app.json` → `expo.ios.bundleIdentifier`).

### Sign in with Apple

- In [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Identifiers**:
  - Open (or create) the App ID for `com.jakec44.snagged`.
  - Enable **Sign in with Apple** (as “Primary App ID” or “Group with an existing App ID”).
- In **Supabase** (Authentication → Providers → Apple):
  - Use the same **Services ID** and **Key** that match this bundle ID so Apple Sign In works in the built app (not just Expo Go).

### Optional: push notifications

- If you use push notifications, enable **Push Notifications** on the same App ID and upload the key/certificate to Supabase/EAS as needed (see `docs/NOTIFICATIONS_SETUP.md` or `PUSH_NOTIFICATIONS_TESTFLIGHT.md`).

---

## 2. EAS secrets (one-time per environment)

Production build uses **production** secrets. Set them if you haven’t:

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co" --scope project --type string
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --scope project --type string
```

Use `--environment production` (or the env your production profile uses) if you scope secrets per environment. List: `eas secret:list`.

---

## 3. Build for TestFlight (production iOS build)

From the project root:

```bash
eas build --platform ios --profile production
```

- EAS will build in the cloud (no need for a Mac for the build).
- **First time:** you may be asked to create/select an Apple Team and to log in with your Apple ID; EAS will create/use the right provisioning profile and certificate.
- When the build finishes, EAS shows a URL to the build and optionally to **Submit to App Store**.

---

## 4. Submit build to TestFlight

### Option A — Right after the build (recommended)

When the build completes, EAS will prompt:

```text
Would you like to submit the build to the App Store? … Yes
```

Choose **Yes** and follow the prompts. You’ll need:

- **Apple ID** (App Store Connect)
- **App-specific password** (if 2FA is on): [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords → generate one for “EAS Submit”.

EAS will upload the build to App Store Connect and it will appear under **TestFlight** after processing (usually 5–15 minutes).

### Option B — Submit an existing build later

```bash
eas submit --platform ios --profile production --latest
```

Or pick a specific build:

```bash
eas submit --platform ios --profile production
# then choose the build from the list
```

Again use your Apple ID and app-specific password when asked.

---

## 5. After upload — App Store Connect

1. Open [App Store Connect](https://appstoreconnect.apple.com) → your app → **TestFlight**.
2. Wait until the build status is **“Ready to submit”** (or “Processing” → “Ready”).
3. **Internal testing:** add internal testers (no review).
4. **External testing:** create a group, add the build, add external testers; first time the group goes through a short Beta App Review.

---

## 6. Version and build number (optional)

- **Version** (e.g. `1.0.0`) is in `app.json` → `expo.version`.
- **Build number** is auto-incremented by EAS when using `"autoIncrement": true` in `eas.json` (you have this for production). To bump the **version** for a new TestFlight release, update `app.json` and run the build again.

---

## Quick reference

| Step | Command or action |
|------|--------------------|
| One-time Apple | App ID + Sign in with Apple for `com.jakec44.snagged`; match Supabase Apple provider |
| One-time EAS | `eas secret:create` for `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (production) |
| Build iOS for store | `eas build --platform ios --profile production` |
| Submit to TestFlight | When prompted after build, or `eas submit --platform ios --profile production --latest` |
| Invite testers | App Store Connect → TestFlight → Internal/External groups |

---

## Troubleshooting

- **“No valid signing certificate”** — Let EAS create one, or in Apple Developer fix the certificate/identifier and run the build again.
- **“Sign in with Apple” fails in TestFlight but worked in Expo Go** — Apple config is tied to bundle ID; ensure the App ID for `com.jakec44.snagged` has Sign in with Apple enabled and Supabase Apple provider uses the same Services ID / key.
- **Build fails on “scheme” or “configuration”** — Ensure `app.json` has `expo.scheme` (e.g. `"snagged"`) and `expo.ios.bundleIdentifier` set.
- More: [EAS Build docs](https://docs.expo.dev/build/introduction/), [EAS Submit](https://docs.expo.dev/submit/introduction/).
