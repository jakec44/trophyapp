/**
 * RevenueCat setup — placeholder for Pro subscription management.
 * Set EXPO_PUBLIC_REVENUECAT_API_KEY in .env to enable.
 * appUserID is set to Supabase session user.id for consistent identity.
 */

let initialized = false;

/**
 * Initialize RevenueCat Purchases SDK.
 * Call once when app has a signed-in user (Supabase session).
 * No-op if API key is missing or already initialized.
 */
export async function initRevenueCat(userId: string | null): Promise<void> {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  if (!apiKey || apiKey === 'placeholder' || apiKey.trim() === '') {
    return;
  }
  if (initialized) return;

  try {
    // Lazy-load react-native-purchases (not installed yet)
    const Purchases = require('react-native-purchases').default;
    await Purchases.configure({
      apiKey,
      appUserID: userId ?? undefined,
    });
    initialized = true;
  } catch (_e) {
    // react-native-purchases not installed or configure failed
  }
}

/**
 * Call when user signs out — reset RevenueCat anonymous ID.
 */
export async function resetRevenueCat(): Promise<void> {
  if (!initialized) return;
  try {
    const Purchases = require('react-native-purchases').default;
    await Purchases.logOut();
    initialized = false;
  } catch (_e) {}
}
