# RevenueCat: testing and fixing errors

## How to test the paywall without TestFlight

You need a **development build** (not Expo Go). IAP and RevenueCat don’t work in Expo Go.

1. **Build and run on your Mac**
   - From project root: `npm run ios` (or `npx expo run:ios`).  
   - This builds the native app and runs it in the **simulator** or on a **connected device**.

2. **So the paywall can load products**
   - **iOS Simulator:** Use the StoreKit configuration file so the simulator can “sell” your product without App Store Connect. Follow **Option B** in section 2 below (add `SnaggedProducts.storekit` to the Xcode project and set it in the Run scheme’s **StoreKit Configuration**). Then run from Xcode (or run with `npx expo run:ios` after the scheme is set).
   - **Real device:** Either use the same StoreKit file if you run from Xcode with a device selected, or use a **sandbox** Apple ID: on the device go to **Settings → App Store → Sandbox Account**, sign in with a test account you create in App Store Connect → Users and Access → Sandbox. Then open your dev build and trigger the paywall; purchases will be sandbox.

3. **Trigger the paywall**
   - In the app, go to **Settings** (or wherever you show “Upgrade to Pro”) and tap the upgrade button. RevenueCat’s native paywall or your fallback `/paywall` screen should appear.

4. **RevenueCat dashboard**
   - Ensure you have a **Current** offering with at least one **package** and product ID matching your app (e.g. `snagged_pro_monthly`). For the **native** RevenueCat paywall, create a paywall in RevenueCat → **Paywalls** and assign it to your app so the hosted UI doesn’t crash.

---

## Fixing RevenueCat errors

The app uses whatever offering you set as **Current** in RevenueCat (e.g. **Snagged Pro**). Errors usually mean that offering has no **packages**, or the product isn’t available from the App Store.

---

## 1. "Offering has no packages configured"

**Fix in RevenueCat:**

1. Open [Offerings](https://app.revenuecat.com/projects/1e766f13/product-catalog/offerings).
2. Open the offering that is **Current** (e.g. **Snagged Pro**).
3. **Add a package** to that offering (e.g. "Monthly") and attach a product (e.g. **`snagged_pro_monthly`**).
4. Save. The current offering **must have at least one package** or the SDK will error.

---

## 2. "None of the products... could be fetched" / "Products could not be fetched"

RevenueCat is asking the App Store (or StoreKit) for **`snagged_pro_monthly`** and getting nothing. Common in simulator and dev builds until you use a StoreKit Configuration file or a real App Store Connect product.

**Option A – Real product (for TestFlight/App Store):**

1. In [App Store Connect](https://appstoreconnect.apple.com) → your app → **Subscriptions**.
2. Create a subscription and add a product with ID **exactly** `snagged_pro_monthly`.
3. In RevenueCat → **Apps** → your iOS app → link **App Store Connect** (add App-Specific Shared Secret from App Store Connect).
4. In RevenueCat → **Products**, ensure `snagged_pro_monthly` exists and is linked to that app/product.

**Option B – Local testing (simulator / dev build):**

The repo includes **`SnaggedProducts.storekit`** with product `snagged_pro_monthly`. Use it so the simulator or dev build can load products without App Store Connect.

1. Generate the native project (if you use Expo):  
   `npx expo prebuild --platform ios`
2. Open the iOS app in Xcode:  
   `open ios/snagged.xcworkspace` (or the `.xcworkspace` in your `ios` folder).
3. Add the StoreKit file to the project:  
   In Xcode, **File → Add Files to "snagged"…** (or drag) → select **`SnaggedProducts.storekit`** from the project root → ensure "Copy items if needed" is unchecked (file stays at root) and the app target is checked.
4. Tell the app to use it when running:  
   **Product → Scheme → Edit Scheme…** (or ⌘<) → select **Run** → **Options** tab → **StoreKit Configuration** → choose **SnaggedProducts.storekit**.
5. Run the app from Xcode (or from the same scheme in your IDE). The RevenueCat error should go away and the paywall should show the monthly plan.

If you run with `npx expo run:ios` instead of Xcode, the scheme may not use the StoreKit file. Run from Xcode at least once with the scheme set, or re-open Xcode and run from there when testing purchases.

---

## 3. "Purchases instance already set"

This is reduced in code: we configure once and use `logIn` when the user signs in. If you still see it (e.g. after hot reload), it’s harmless.

---

## Summary

| Error | Fix |
|-------|-----|
| Offering has no packages | Add at least one **package** to the offering that is **Current** (e.g. Snagged Pro) and attach your product (e.g. `snagged_pro_monthly`). |
| Products not fetched | Use **Option B** (add `SnaggedProducts.storekit` in Xcode scheme) for local testing, or **Option A** (App Store Connect + RevenueCat link) for TestFlight/App Store. |

After both are done, restart the app and the paywall should load.
