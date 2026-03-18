# Paywall & payments (RevenueCat)

Your app already has **paywalls and in-app subscription payments** wired up with **RevenueCat**. This doc explains what’s there and how to turn it on and extend it.

---

## What’s already implemented

| Piece | Location | Purpose |
|-------|----------|--------|
| **RevenueCat SDK** | `src/lib/revenueCat.ts` | Init, get offerings, purchase, restore, sync to Supabase |
| **Paywall screen** | `app/paywall.tsx` | Full-screen paywall: plans, Subscribe, Restore, close |
| **Pro gating** | Log (20 catches), tournaments, entry flow | Shows “Upgrade” → navigates to `/paywall` |
| **Backend** | `profiles.subscription_plan`, `pro_expires_at` | Pro status stored in Supabase; RPC `set_pro_entitlement_from_client` |
| **Auth** | `useAuth` / profile | `user.subscriptionPlan` is `'free'` or `'pro'` |

Flow: **RevenueCat** handles App Store / Play Store purchases → after purchase/restore the app calls **Supabase RPC** to set `subscription_plan = 'pro'` and `pro_expires_at` → profile is refreshed and the app treats the user as Pro.

---

## 1. Enable the paywall (configuration)

### 1.1 RevenueCat

1. Sign up at [RevenueCat](https://www.revenuecat.com).
2. Create a project and add your app(s) (iOS and/or Android).
3. In the RevenueCat dashboard:
   - **Products**: Add your App Store / Play Store subscription product IDs (e.g. `pro_monthly`, `pro_yearly`).
   - **Offerings**: Create an offering (e.g. `default`) and attach a package that uses that product.
   - **Entitlements**: Create an entitlement named **`pro`** and attach it to that product/package.
4. Copy the **Public API key** (iOS and/or Android; you can use one key per platform or a single key if you link both).

### 1.2 App Store Connect (iOS)

1. Create a **subscription product** (e.g. Auto-Renewable Subscription).
2. Use the same **Product ID** you added in RevenueCat (e.g. `pro_monthly`).
3. In RevenueCat, link the App Store Connect app and ensure the product is synced.

### 1.3 Google Play Console (Android)

1. Create a **subscription** in Monetization → Subscriptions.
2. Use the same **Product ID** as in RevenueCat.
3. In RevenueCat, link the Play Console app and sync the product.

### 1.4 App env

In `.env` (or EAS secrets for production):

```bash
# RevenueCat — use your project’s public API key (iOS or Android)
EXPO_PUBLIC_REVENUECAT_API_KEY=appl_xxxxxxxxxxxx   # iOS
# or
EXPO_PUBLIC_REVENUECAT_API_KEY=goog_xxxxxxxxxxxx   # Android
```

Restart the app. The paywall screen will load offerings and show “Subscribe” and “Restore”.

---

## 2. Showing the paywall in more places

Anywhere you want to gate a feature and send the user to the paywall:

```tsx
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/src/context/AuthContext';

// In your component:
const { user } = useAuthContext();
const router = useRouter();

if (user?.subscriptionPlan !== 'pro') {
  // Option A: Show a button that opens paywall
  return (
    <TouchableOpacity onPress={() => router.push('/paywall')}>
      <Text>Upgrade to Pro</Text>
    </TouchableOpacity>
  );
}

// Option B: In an alert when they hit a limit
Alert.alert(
  'Pro required',
  'Unlock unlimited tournaments and logbook with Pro.',
  [
    { text: 'Not now', style: 'cancel' },
    { text: 'Upgrade', onPress: () => router.push('/paywall') },
  ]
);
```

Existing examples:

- **Logbook**: after 20 catches, free users get an alert with “Upgrade” → `/paywall`.
- **Tournaments**: entering when not Pro can show “Upgrade” → `/paywall`.
- **Tournament entry flow**: `TournamentEntryFlow.tsx` and `TournamentPotentialSheet.tsx` use the same pattern.

---

## 3. Backend: Pro status in Supabase

- **Columns**: `profiles.subscription_plan` (`'free'` | `'pro'`), `profiles.pro_expires_at` (optional expiry).
- **RPC**: `set_pro_entitlement_from_client(p_expires_at)` is called by the app after a successful purchase or restore. It sets the current user’s profile to Pro (and optionally expiry). Only the authenticated user can update their own row (enforced in the RPC).
- **Production**: For stronger consistency and to handle renewals/cancellations, add a **RevenueCat webhook** that calls a Supabase Edge Function or external API to update `profiles` when RevenueCat sends subscription events. The code comment in `revenueCat.ts` says: “Production: use RevenueCat webhook instead.”

---

## 4. Optional: RevenueCat webhook (production)

1. In RevenueCat dashboard: Project → Integrations → Webhooks (or “Server notifications”).
2. Set URL to your backend (e.g. Supabase Edge Function URL).
3. On event (e.g. `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`), your backend verifies the payload (RevenueCat docs) and updates `profiles` (e.g. set `subscription_plan = 'pro'` and `pro_expires_at` on renewals, set back to `'free'` on cancellation/expiry).

This keeps Pro status in sync even if the user doesn’t open the app after a renewal or cancel.

---

## 5. Testing

- **Sandbox (iOS)**: Use a Sandbox Apple ID in Settings → App Store to test purchases; RevenueCat shows test transactions.
- **Test track (Android)**: Use an internal testing track and a test account to make test purchases.
- **No API key**: If `EXPO_PUBLIC_REVENUECAT_API_KEY` is unset or invalid, the paywall shows “Pro upgrade unavailable” and purchase/restore are disabled.

---

## Summary

- **Implementing paywalls**: Already done; configure RevenueCat + App Store/Play + `EXPO_PUBLIC_REVENUECAT_API_KEY`, then use `router.push('/paywall')` wherever you want to gate features.
- **Implementing payments**: RevenueCat + Store products handle payments; your app only calls `purchaseDefaultPackage()` or `restorePurchases()` and then syncs Pro via `set_pro_entitlement_from_client`. For production, add a RevenueCat webhook to keep Supabase in sync with subscription lifecycles.
