/**
 * RevenueCat — Pro subscription management.
 * Set EXPO_PUBLIC_REVENUECAT_API_KEY in .env to enable.
 * appUserID = Supabase session user.id for consistent identity.
 */

import { supabase } from './supabase';

let initialized = false;
let configuring = false;
let lastAppUserId: string | null | undefined = undefined;

function getPurchases() {
  try {
    return require('react-native-purchases').default;
  } catch {
    return null;
  }
}

function isConfigured(): boolean {
  if (process.env.EXPO_PUBLIC_REVENUECAT_DISABLED === 'true') return false;
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  return !!(apiKey && apiKey !== 'placeholder' && apiKey.trim() !== '');
}

/**
 * Initialize RevenueCat Purchases SDK.
 * Configures once; if user signs in after anonymous, calls logIn(userId).
 */
export async function initRevenueCat(userId: string | null): Promise<void> {
  if (!isConfigured()) return;

  const Purchases = getPurchases();
  if (!Purchases) return;

  try {
    if (initialized) {
      const id = userId ?? undefined;
      if (id !== lastAppUserId) {
        if (id) await Purchases.logIn(id);
        else await Purchases.logOut();
        lastAppUserId = id;
      }
      return;
    }
    if (configuring) return;
    configuring = true;
    // Reduce log noise: WARN hides DEBUG; must run BEFORE configure
    try {
      const level = __DEV__ ? Purchases.LOG_LEVEL?.WARN : Purchases.LOG_LEVEL?.ERROR;
      if (typeof Purchases.setLogLevel === 'function' && level != null) {
        await Purchases.setLogLevel(level);
      }
    } catch (_) {}
    await Purchases.configure({
      apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY!,
      appUserID: userId ?? undefined,
    });
    initialized = true;
    lastAppUserId = userId ?? undefined;
  } catch (e) {
    // In dev/simulator without a StoreKit Configuration file, products can't be
    // fetched and configure() throws. Use SnaggedProducts.storekit in Xcode scheme
    // (Run → Options → StoreKit Configuration) to fix. See docs/REVENUECAT_FIX_CHECKLIST.md
    if (__DEV__) console.warn('[RevenueCat] init failed (e.g. no products in store):', (e as Error)?.message);
  } finally {
    configuring = false;
  }
}

/**
 * Call when user signs out.
 */
export async function resetRevenueCat(): Promise<void> {
  if (!initialized) return;
  try {
    const Purchases = getPurchases();
    if (Purchases) await Purchases.logOut();
    initialized = false;
    lastAppUserId = undefined;
  } catch (_e) {}
}

/**
 * Whether RevenueCat is configured and ready.
 */
export function isRevenueCatReady(): boolean {
  return isConfigured() && initialized;
}

export type PackageInfo = {
  identifier: string;
  packageType: string;
  product: { title: string; priceString: string };
};

export type OfferingInfo = {
  identifier: string;
  availablePackages: PackageInfo[];
};

/**
 * Fetch offerings. Returns null if not configured or fails.
 */
export async function getOfferings(): Promise<OfferingInfo[] | null> {
  if (!isRevenueCatReady()) return null;
  const Purchases = getPurchases();
  if (!Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.all
      ? Object.values(offerings.all).map((o: any) => ({
          identifier: o.identifier,
          availablePackages: (o.availablePackages ?? []).map((p: any) => ({
            identifier: p.identifier,
            packageType: p.packageType,
            product: p.product ? { title: p.product.title, priceString: p.product.priceString } : { title: '', priceString: '' },
          })),
        }))
      : [];
  } catch {
    return null;
  }
}

/**
 * Get the current offering and the monthly package (for display).
 * Prefers packageType $RC_MONTHLY or identifier containing "monthly", else first package.
 */
export async function getCurrentOfferingWithMonthly(): Promise<{
  monthlyPackage: PackageInfo | null;
  allPackages: PackageInfo[];
} | null> {
  if (!isRevenueCatReady()) return null;
  const Purchases = getPurchases();
  if (!Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current?.availablePackages?.length) return null;
    const packages = current.availablePackages.map((p: any) => ({
      identifier: p.identifier,
      packageType: p.packageType,
      product: p.product ? { title: p.product.title, priceString: p.product.priceString } : { title: '', priceString: '' },
    }));
    const monthly =
      packages.find((p: PackageInfo) => p.packageType === '$RC_MONTHLY' || p.identifier.toLowerCase().includes('monthly')) ??
      packages[0];
    return { monthlyPackage: monthly, allPackages: packages };
  } catch {
    return null;
  }
}

/**
 * Purchase the default (first) package from the current offering.
 * Returns { success: true } or { success: false, error: string }.
 */
export async function purchaseDefaultPackage(): Promise<{ success: boolean; error?: string }> {
  return purchasePackageInternal(0);
}

/**
 * Purchase the monthly package from the current offering (for "Start Snagged Pro").
 * Uses entitlement "Pro" (RevenueCat identifier) to verify after purchase.
 */
export async function purchaseMonthlyPackage(): Promise<{ success: boolean; error?: string }> {
  return purchasePackageByIdentifier('monthly');
}

/**
 * Purchase a specific package by identifier (e.g. "monthly", "lifetime", "$rc_monthly", "$rc_lifetime").
 * Use this when the paywall shows multiple options (monthly + lifetime).
 */
export async function purchasePackageByIdentifier(identifier: string): Promise<{ success: boolean; error?: string }> {
  if (!isRevenueCatReady()) return { success: false, error: 'Pro upgrade is not available.' };
  const Purchases = getPurchases();
  if (!Purchases) return { success: false, error: 'Pro upgrade is not available.' };
  const idLower = identifier.toLowerCase();
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current?.availablePackages?.length) return { success: false, error: 'No packages available.' };
    const packages = current.availablePackages as any[];
    const pkg =
      packages.find(
        (p: any) =>
          (p.identifier && String(p.identifier).toLowerCase().includes(idLower)) ||
          (p.packageType && String(p.packageType).toLowerCase().includes(idLower))
      ) ?? packages[0];
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const ok = !!(customerInfo?.entitlements?.active?.Pro);
    if (ok) await syncEntitlementsToProfile(customerInfo);
    return { success: ok };
  } catch (e: any) {
    if (e?.userCancelled) return { success: false, error: 'Purchase cancelled.' };
    return { success: false, error: e?.message ?? 'Purchase failed.' };
  }
}

async function purchasePackageInternal(packageIndex: number): Promise<{ success: boolean; error?: string }> {
  if (!isRevenueCatReady()) return { success: false, error: 'Pro upgrade is not available.' };
  const Purchases = getPurchases();
  if (!Purchases) return { success: false, error: 'Pro upgrade is not available.' };
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current || !current.availablePackages?.length) {
      return { success: false, error: 'No packages available.' };
    }
    const pkg = current.availablePackages[packageIndex] ?? current.availablePackages[0];
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const ok = !!customerInfo?.entitlements?.active?.Pro;
    if (ok) await syncEntitlementsToProfile(customerInfo);
    return { success: ok };
  } catch (e: any) {
    if (e?.userCancelled) return { success: false, error: 'Purchase cancelled.' };
    return { success: false, error: e?.message ?? 'Purchase failed.' };
  }
}

/**
 * Restore purchases. Call from user-triggered Restore button.
 */
export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  if (!isRevenueCatReady()) return { success: false, error: 'Restore is not available.' };
  const Purchases = getPurchases();
  if (!Purchases) return { success: false, error: 'Restore is not available.' };
  try {
    const customerInfo = await Purchases.restorePurchases();
    const hasPro = !!customerInfo?.entitlements?.active?.Pro;
    if (hasPro) await syncEntitlementsToProfile(customerInfo);
    return { success: hasPro };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Restore failed.' };
  }
}

/**
 * Sync entitlements to profiles. Beta: client calls RPC.
 * Production: use RevenueCat webhook instead.
 */
async function syncEntitlementsToProfile(customerInfo: any): Promise<void> {
  const pro = customerInfo?.entitlements?.active?.Pro;
  if (!pro) return;
  const expiresAt = pro.expirationDate ?? null;
  try {
    await supabase.rpc('set_pro_entitlement_from_client', {
      p_expires_at: expiresAt,
    });
  } catch (_e) {}
}
