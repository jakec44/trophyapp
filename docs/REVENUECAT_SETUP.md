# RevenueCat setup — step-by-step

Get Pro subscriptions working: RevenueCat dashboard → App Store Connect → app env → test.

**Product IDs your app uses:** `snagged_pro_monthly`, `snagged_pro_lifetime` (for one paywall with monthly + lifetime).  
**Entitlement name your app expects:** `Pro`

---

## One paywall with Monthly + Lifetime (what you need)

| Where | What |
|-------|------|
| **RevenueCat → Products** | Two products: `snagged_pro_monthly` (Subscription), `snagged_pro_lifetime` (Non-Subscription / non-consumable). |
| **RevenueCat → Offerings** | One **Current** offering with **two packages**: e.g. "Monthly" (→ `snagged_pro_monthly`) and "Lifetime" (→ `snagged_pro_lifetime`). Both packages must be attached to the **Pro** entitlement. |
| **App Store Connect** | Same two: a **subscription** `snagged_pro_monthly` and an **In-App Purchase** (non-consumable) `snagged_pro_lifetime`. |
| **App** | Paywall already shows all packages and lets the user pick monthly or lifetime, then Subscribe. |

If you only have one product (e.g. monthly), the paywall shows one card. Add the lifetime product in RevenueCat + App Store Connect and a second package in the same offering to get both options.

---

## 1. RevenueCat dashboard

### 1.1 Project and app

1. Go to [RevenueCat](https://app.revenuecat.com) and sign in.
2. Create or open a **Project** (e.g. "Snagged").
3. **Project → Apps** → **+ New**:
   - **Platform:** Apple App Store
   - **App name:** Snagged (or your app name)
   - **Bundle ID:** `com.jakec44.snagged` (must match `app.json` → `ios.bundleIdentifier`)

### 1.2 Products (monthly + lifetime)

1. **Project → Products** (or Product Catalog → Products).
2. **Monthly:** **+ New**
   - **Identifier:** `snagged_pro_monthly` (must match exactly).
   - **App:** the iOS app you added.
   - **Type:** Subscription.
3. **Lifetime:** **+ New**
   - **Identifier:** `snagged_pro_lifetime`.
   - **App:** same iOS app.
   - **Type:** Non-Subscription (or Non-Consumable, depending on RevenueCat wording).
4. Save both.

### 1.3 Entitlement

1. **Project → Entitlements** (or Product Catalog → Entitlements).
2. **+ New**:
   - **Identifier:** `Pro` (your code checks `entitlements.active.Pro`).
3. Save.

### 1.4 Offering and packages (monthly + lifetime)

1. **Project → Offerings** (or Product Catalog → Offerings).
2. Create or edit an offering (e.g. **Snagged Pro** or **default**).
3. **Set as Current** (so `offerings.current` in the app returns it).
4. **Packages** in that offering — add **two** packages, both attached to **Pro** entitlement:
   - **Monthly:** Identifier e.g. `$rc_monthly` or `monthly`, Package type Monthly, Product `snagged_pro_monthly`, Entitlement **Pro**.
   - **Lifetime:** Identifier e.g. `$rc_lifetime` or `lifetime`, Package type Lifetime (if available) or custom, Product `snagged_pro_lifetime`, Entitlement **Pro**.
5. Save.

### 1.5 API key

1. **Project → API Keys** (or Project Settings → API Keys).
2. Copy the **Public app-specific API key** for **iOS** (starts with `appl_`).
3. You’ll put this in `.env` and (for builds) EAS secrets.

---

## 2. App Store Connect

### 2.1 Products (monthly subscription + lifetime)

1. [App Store Connect](https://appstoreconnect.apple.com) → your app → **Subscriptions** and **In-App Purchases**.
2. **Monthly:** Create a **Subscription Group** (e.g. "Snagged Pro") if needed, then add a subscription:
   - **Product ID:** `snagged_pro_monthly` (must match RevenueCat).
   - **Subscription duration:** 1 month, set price (e.g. $4.99), localizations.
3. **Lifetime:** In **In-App Purchases**, add a **Non-Consumable** (or use the type that represents “lifetime access”):
   - **Product ID:** `snagged_pro_lifetime` (must match RevenueCat).
   - Set price (e.g. $29.99), name, localizations.
4. Submit for review if needed (required for TestFlight/App Store).

### 2.2 App-Specific Shared Secret (for RevenueCat)

1. App Store Connect → your app → **App Information** (or **General** → **App Information**).
2. Under **App-Specific Shared Secret** (for subscriptions), **Generate** or copy the shared secret.
3. In **RevenueCat** → **Apps** → your iOS app → **App Store Connect**:
   - Paste the **Shared Secret** and save.
   - This lets RevenueCat validate receipts.

---

## 3. App env (local and EAS)

### 3.1 Local (`.env`)

In project root, in `.env` (create from `.env.example` if needed):

```bash
EXPO_PUBLIC_REVENUECAT_API_KEY=appl_xxxxxxxxxxxxxxxxxxxxxxxx
```

Replace with your **iOS public API key** from RevenueCat (step 1.5).  
Do **not** set `EXPO_PUBLIC_REVENUECAT_DISABLED=true` if you want purchases to work.

### 3.2 EAS / TestFlight builds

So the key is in the built app without committing it:

```bash
eas secret:create --name EXPO_PUBLIC_REVENUECAT_API_KEY --value "appl_xxxxxxxx" --type string
```

Use the same value as in `.env`. Then rebuild:

```bash
eas build --platform ios --profile production
```

---

## 4. Verify in the app

- **Paywall:** Open the paywall (e.g. from Settings or when hitting a Pro gate). It should show the monthly plan and price; "Subscribe" and "Restore" should be tappable.
- **Purchase:** Use an **iOS Sandbox** account (Settings → App Store → Sandbox Account) to complete a test purchase. After success, the app calls `set_pro_entitlement_from_client` and your profile becomes Pro.
- **Restore:** Sign out/in or reinstall, then tap "Restore" — Pro should restore from RevenueCat.

---

## 5. Common issues

| Issue | What to check |
|-------|----------------|
| "Offering has no packages" | RevenueCat → Current offering has at least one **package** linked to `snagged_pro_monthly` and **Pro** entitlement. |
| "Products could not be fetched" | **Device/TestFlight:** App Store Connect has subscription `snagged_pro_monthly`; RevenueCat app has Shared Secret. **Simulator:** Use StoreKit file (see below). |
| Paywall says "Pro upgrade unavailable" | `EXPO_PUBLIC_REVENUECAT_API_KEY` set and not disabled; key is `appl_...` for iOS. |
| Purchase succeeds but profile not Pro | Supabase RPC `set_pro_entitlement_from_client` exists and is granted to `authenticated`; user is logged in when purchasing. |

---

## 6. Simulator / local testing (optional)

Without App Store Connect products, the simulator has no products. Use the included StoreKit file:

1. Generate iOS project: `npx expo prebuild --platform ios`
2. Open in Xcode: `open ios/snagged.xcworkspace` (or your `.xcworkspace`)
3. Add **SnaggedProducts.storekit** (project root) to the app target (File → Add Files…).
4. **Product → Scheme → Edit Scheme** → **Run** → **Options** → **StoreKit Configuration** → **SnaggedProducts.storekit**
5. Run from Xcode. RevenueCat will still need your API key; products will come from the StoreKit file.

For **TestFlight**, you don’t need the StoreKit file — use real App Store Connect products and a Sandbox Apple ID.
