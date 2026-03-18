# Dev build on your phone (quick iteration)

Use a **development build** so you can run the app on your iPhone and see changes live (fast refresh). You only build this app once; after that you just run Metro and connect.

## 1. Build and install the dev client (one-time)

On Windows you need EAS to build the iOS dev client:

```bash
eas build --platform ios --profile development
```

When the build finishes, EAS gives you a link. **Open that link on your iPhone** and install the app (it’s a separate “Snagged” dev app that connects to your dev server). Supabase is already in EAS secrets, so sign-in will work in this build.

## 2. Start Metro (every time you code)

**Same Wi‑Fi as your phone:**

```bash
npm run start:dev
```

**Phone and PC on different networks (e.g. phone on cellular):**

```bash
npm run start:dev:tunnel
```

Leave this terminal running.

## 3. Connect the dev app

1. On your **iPhone**, open the **Snagged dev app** you installed in step 1 (not Expo Go, not the Camera app).
2. It will show a screen to connect to a dev server (e.g. “Enter URL” or “Scan QR code”).
3. **Scan the QR code from your terminal** using the **scanner inside the Snagged dev app** (or type the URL it shows).
4. The app loads your bundle from Metro; edits will hot-reload.

**Important:** Scan the QR code **with the dev app’s own scanner**. If you scan with the iPhone Camera or Expo Go, you’ll get “No usable data found” because that QR code is for the dev client.

## Summary

| Step            | Command / action                                      |
|-----------------|--------------------------------------------------------|
| One-time install| `eas build --platform ios --profile development` → install from link on iPhone |
| Start dev server| `npm run start:dev` or `npm run start:dev:tunnel`     |
| Connect         | Open **Snagged dev app** → scan QR from **inside that app** |
