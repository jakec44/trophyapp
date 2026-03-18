/**
 * Custom Pro paywall via RevenueCat (no hosted templates).
 * Loads current offering, shows monthly package price.
 * Buttons: Start Snagged Pro, Restore Purchases, Not now.
 * Dark teal/gold theme. Entitlement: pro.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import {
  isRevenueCatReady,
  getCurrentOfferingWithMonthly,
  purchasePackageByIdentifier,
  restorePurchases,
} from '@/src/lib/revenueCat';
import { useAuthContext } from '@/src/context/AuthContext';

const TEAL = colors.teal;
const GOLD = colors.gold;
const BG = '#020b14';
const CARD = '#071e30';
const BORDER = 'rgba(0,229,200,0.15)';

type PackageInfo = { identifier: string; packageType: string; product: { title: string; priceString: string } };

export default function PaywallScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<PackageInfo | null>(null);
  const [allPackages, setAllPackages] = useState<PackageInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const isReady = isRevenueCatReady();
      setReady(isReady);
      if (!isReady) {
        setLoading(false);
        return;
      }
      try {
        const data = await getCurrentOfferingWithMonthly();
        if (cancelled) return;
        if (data?.monthlyPackage) {
          setMonthlyPackage(data.monthlyPackage);
          setAllPackages(data.allPackages ?? []);
          setSelectedId(
            data.monthlyPackage?.identifier ?? data.allPackages?.[0]?.identifier ?? null
          );
          setError(null);
        } else {
          setError('No subscription plans available.');
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message ?? 'Failed to load plans.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleStartPro = async () => {
    const id = selectedId ?? monthlyPackage?.identifier ?? 'monthly';
    setPurchasing(true);
    setError(null);
    try {
      const result = await purchasePackageByIdentifier(id);
      if (result.success) {
        await refreshProfile();
        router.replace('/(tabs)');
      } else {
        setError(result.error ?? 'Purchase failed.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    try {
      const result = await restorePurchases();
      if (result.success) {
        await refreshProfile();
        router.replace('/(tabs)');
      } else {
        setError(result.error ?? 'No purchases to restore.');
      }
    } finally {
      setRestoring(false);
    }
  };

  const handleNotNow = () => router.replace('/(tabs)');

  if (!ready) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleNotNow} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.lightSubtext} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Pro upgrade unavailable</Text>
          <Text style={styles.errorBody}>
            Subscription features are not configured. Please try again later.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleNotNow} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.lightSubtext} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconEmoji}>⚓</Text>
        </View>
        <Text style={styles.title}>Snagged Pro</Text>
        <Text style={styles.subtitle}>
          Unlimited tournament entries, unlimited logbook, and more.
        </Text>

        {loading ? (
          <View style={styles.loadWrap}>
            <ActivityIndicator size="large" color={TEAL} />
            <Text style={styles.loadText}>Loading…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorWrap}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : allPackages.length > 0 ? (
          <View style={styles.packageList}>
            {allPackages.map((pkg) => {
              const isSelected = selectedId === pkg.identifier;
              const label =
                pkg.product?.title ||
                (pkg.identifier?.toLowerCase().includes('lifetime') ? 'Lifetime' : 'Monthly');
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.priceCard, isSelected && styles.priceCardSelected]}
                  onPress={() => setSelectedId(pkg.identifier)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.priceLabel}>{label}</Text>
                  <Text style={styles.priceValue}>{pkg.product?.priceString || ''}</Text>
                  {isSelected && (
                    <View style={styles.checkWrap}>
                      <Ionicons name="checkmark-circle" size={22} color={TEAL} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : monthlyPackage ? (
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>{monthlyPackage.product?.title || 'Pro Monthly'}</Text>
            <Text style={styles.priceValue}>{monthlyPackage.product?.priceString || ''}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, (purchasing || restoring) && styles.btnDisabled]}
            onPress={handleStartPro}
            disabled={purchasing || restoring || loading}
          >
            {purchasing ? (
              <ActivityIndicator size="small" color={BG} />
            ) : (
              <Text style={styles.primaryBtnText}>Start Snagged Pro</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, (purchasing || restoring) && styles.btnDisabled]}
            onPress={handleRestore}
            disabled={purchasing || restoring || loading}
          >
            {restoring ? (
              <ActivityIndicator size="small" color={TEAL} />
            ) : (
              <Text style={styles.secondaryBtnText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tertiaryBtn}
            onPress={handleNotNow}
            disabled={purchasing || restoring}
          >
            <Text style={styles.tertiaryBtnText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeBtn: { padding: 8 },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: TEAL + '25',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconEmoji: { fontSize: 40 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.lightText,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: colors.lightSubtext,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  loadWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadText: { fontSize: 14, color: colors.lightSubtext },
  errorWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: colors.red + '18',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.red + '40',
    marginBottom: 24,
    gap: 10,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.lightText,
  },
  errorBody: {
    fontSize: 14,
    color: colors.lightSubtext,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.red,
    textAlign: 'center',
  },
  packageList: { gap: 12, marginBottom: 28 },
  priceCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    position: 'relative',
  },
  priceCardSelected: {
    borderColor: TEAL,
    borderWidth: 2,
  },
  checkWrap: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: GOLD,
    marginTop: 4,
  },
  actions: { gap: 12 },
  primaryBtn: {
    backgroundColor: TEAL,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: BG,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 14,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEAL,
  },
  tertiaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  tertiaryBtnText: {
    fontSize: 15,
    color: colors.lightSubtext,
  },
  btnDisabled: { opacity: 0.6 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
