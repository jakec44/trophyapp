import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthContext } from '@/src/context/AuthContext';
import { usePresentPaywall } from '@/src/hooks/usePresentPaywall';
import { getUserProfile, updateUserProfile, deleteAccount, deleteAllMyCatches } from '@/src/lib/supabase';
import { isDev } from '@/src/lib/env';
import { TackleBoxUnlockModal } from '@/src/components/gamification/TackleBoxUnlockModal';
import type { BadgeRarity } from '@/src/types/badgeRarity';

const GOLD = colors.gold;

function ThrowOnRender() {
  throw new Error('Error boundary test — intentional render error');
}

const PLACEHOLDER_URLS = {
  privacy: 'https://snaggedapp.lovable.app/privacy',
  support: 'https://snaggedapp.lovable.app/support',
  terms: 'https://snaggedapp.lovable.app/terms',
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, refreshProfile } = useAuthContext();
  const { presentPaywall } = usePresentPaywall();
  const [isPublic, setIsPublic] = useState(true);
  const [logbookSaving, setLogbookSaving] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [mockChestVisible, setMockChestVisible] = useState(false);
  const [testErrorBoundary, setTestErrorBoundary] = useState(false);
  const [isClearingLogbook, setIsClearingLogbook] = useState(false);
  const [isClearingXp, setIsClearingXp] = useState(false);
  const insets = useSafeAreaInsets();

  // Load logbook visibility from profile
  useEffect(() => {
    if (!user?.id) return;
    getUserProfile(user.id).then((p) => {
      if (p && typeof (p as { public?: boolean }).public === 'boolean') {
        setIsPublic((p as { public?: boolean }).public ?? true);
      }
    });
  }, [user?.id]);

  const handleLogbookVisibilityChange = useCallback(
    async (value: boolean) => {
      if (!user?.id) return;
      setIsPublic(value);
      setLogbookSaving(true);
      try {
        await updateUserProfile(user.id, { public: value });
        await refreshProfile();
      } catch {
        setIsPublic(!value);
      } finally {
        setLogbookSaving(false);
      }
    },
    [user?.id, refreshProfile]
  );
  const bottomPadding = useBottomSafePadding();
  const topPadding = Math.max(insets.top, 16) + 4;

  const handleSignOut = async () => {
    const doSignOut = async () => {
      await signOut();
      router.replace('/(tabs)');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        await doSignOut();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
      ]);
    }
  };

  const handlePrintSessionId = () => {
    Alert.alert('Session User ID', user?.id ?? 'No user');
  };

  const handleCountLogbook = async () => {
    if (!user?.id) {
      Alert.alert('Logbook Count', 'Not signed in');
      return;
    }
    const { total } = await getUserCatches(user.id, 1, 0);
    Alert.alert('Logbook Count', `You have ${total} catch(es) in your logbook.`);
  };

  const handleForceRefreshProfile = async () => {
    await refreshProfile();
    Alert.alert('Profile Refreshed', 'Profile data has been reloaded.');
  };

  const handleClearLogbook = async () => {
    if (!user?.id) return;
    Alert.alert(
      'Clear Logbook',
      'This will permanently delete ALL your logbook entries (catches). This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsClearingLogbook(true);
            try {
              const deleted = await deleteAllMyCatches();
              await refreshProfile();
              Alert.alert('Logbook Cleared', `Deleted ${deleted} catch(es). Restart the app to refresh.`);
            } catch (e) {
              console.error('Clear logbook error:', e);
              Alert.alert('Error', 'Could not clear logbook. Please try again.');
            } finally {
              setIsClearingLogbook(false);
            }
          },
        },
      ]
    );
  };

  const handleClearXpAndCache = async () => {
    if (!user?.id) return;
    Alert.alert(
      'Clear XP & Passport',
      'This will delete all your catches, clear local XP/cache, and reset total XP on the server. Passport and logbook will be empty. Restart the app after.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsClearingXp(true);
            try {
              const deleted = await deleteAllMyCatches();
              const prefix = `@Snagged/user/${user.id}`;
              const keys = [
                `${prefix}/xp`,
                `${prefix}/totalCatches`,
                `${prefix}/totalTournaments`,
                `${prefix}/personalRecords`,
                `${prefix}/caughtSpecies`,
                `${prefix}/caughtSpeciesDates`,
              ];
              await AsyncStorage.multiRemove(keys);
              await updateUserProfile(user.id, { total_xp: 0 });
              await refreshProfile();
              Alert.alert('Done', `Logbook, passport, and XP cleared.${deleted > 0 ? ` ${deleted} catch(es) deleted.` : ''} Restart the app.`);
            } catch (e) {
              console.error('Clear XP/passport error:', e);
              Alert.alert('Error', 'Could not clear. Please try again.');
            } finally {
              setIsClearingXp(false);
            }
          },
        },
      ]
    );
  };

  const handleMockChestOpen = () => {
    setMockChestVisible(true);
  };

  const handleOpenPaywall = () => {
    presentPaywall();
  };

  const handleRestartOnboardingAsNewUser = async () => {
    try {
      try {
        await signOut();
      } catch {
        // Proceed to clear storage even if sign-out fails (e.g. offline)
      }
      const onboardingKeys = [
        'hasSeenOnboarding',
        'hasDismissedHomeOverlay',
        'onboarding_photo_hint_seen',
        'onboarding_needs_profile',
        'onboarding_first_catch_pending',
      ];
      let allKeys: string[] = [];
      try {
        allKeys = await AsyncStorage.getAllKeys();
      } catch {
        // ignore
      }
      const toRemove = allKeys.filter(
        (k) =>
          k.startsWith('@Snagged') ||
          k.startsWith('Snagged:') ||
          onboardingKeys.includes(k)
      );
      if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
      const { clearPendingActions, clearGuestId } = await import('@/src/lib/pendingActions');
      await clearPendingActions();
      await clearGuestId();
      router.replace('/(tabs)');
    } catch (e) {
      console.error('Restart as new user error:', e);
      Alert.alert('Error', 'Could not reset. Please try again.');
    }
  };


  const openUrl = (url: string) => {
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
      else Alert.alert('Cannot Open', 'Unable to open link.');
    });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data — catches, profile, and stats. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Are you absolutely sure?',
              'Your account and all data will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    if (!user?.id) return;
                    setIsDeletingAccount(true);
                    try {
                      await deleteAccount(user.id);
                      await signOut();
                      router.replace('/(tabs)');
                    } catch {
                      Alert.alert('Error', 'Could not delete account. Please try again or contact support.');
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  if (testErrorBoundary) return <ThrowOnRender />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <SnaggedWordmark />
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your preferences</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => router.push(user ? '/(tabs)/profile-edit' : '/(tabs)/profile')}
        >
          <Feather name="edit-2" size={18} color={GOLD} />
          <Text style={styles.settingTextWithFlex}>Edit Profile</Text>
          <Feather name="chevron-right" size={20} color={colors.lightSubtext} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
          <Feather name="bell" size={18} color={GOLD} />
          <Text style={styles.settingTextWithFlex}>Notifications</Text>
          <Feather name="chevron-right" size={20} color={colors.lightSubtext} />
        </TouchableOpacity>
        <View style={styles.settingItem}>
          <Feather name="book" size={18} color={GOLD} />
          <View style={styles.settingTextWrap}>
            <Text style={styles.settingText}>Logbook</Text>
            <Text style={styles.settingSubtext} numberOfLines={3}>
              {isPublic ? 'Public — everyone can see your logbook' : 'Private — only friends can see your logbook. Posts stay public.'}
            </Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={handleLogbookVisibilityChange}
            disabled={logbookSaving}
            trackColor={{ false: colors.lightBorder, true: 'rgba(212, 175, 55, 0.5)' }}
            thumbColor={isPublic ? GOLD : colors.lightSubtext}
          />
        </View>
        <TouchableOpacity style={styles.settingItem}>
          <Feather name="shield" size={18} color={GOLD} />
          <Text style={styles.settingTextWithFlex}>Privacy & Security</Text>
          <Feather name="chevron-right" size={20} color={colors.lightSubtext} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem, user?.subscriptionPlan === 'pro' && styles.proItem]}
          onPress={() => presentPaywall()}
        >
          <Feather
            name={user?.subscriptionPlan === 'pro' ? 'check-circle' : 'zap'}
            size={18}
            color={user?.subscriptionPlan === 'pro' ? GOLD : colors.teal}
          />
          <Text style={styles.settingTextWithFlex}>
            {user?.subscriptionPlan === 'pro' ? 'Manage Subscription' : 'Upgrade to Pro'}
          </Text>
          <Feather name="chevron-right" size={20} color={colors.lightSubtext} />
        </TouchableOpacity>

        <View style={styles.legalSection}>
          <Text style={styles.legalSectionTitle}>Reset Data</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleClearLogbook}
            disabled={isClearingLogbook}
          >
            <Feather name="book" size={18} color={colors.lightSubtext} />
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingText}>
                {isClearingLogbook ? 'Clearing…' : 'Clear logbook'}
              </Text>
              <Text style={styles.settingSubtext}>Permanently delete all your catches</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleClearXpAndCache}
            disabled={isClearingXp}
          >
            <Feather name="trash" size={18} color={colors.lightSubtext} />
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingText}>
                {isClearingXp ? 'Clearing…' : 'Clear XP & passport'}
              </Text>
              <Text style={styles.settingSubtext}>
                Resets level, species passport, and gamification cache. Requires restart.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.legalSection}>
          <Text style={styles.legalSectionTitle}>Legal & Support</Text>
          <TouchableOpacity style={styles.settingItem} onPress={() => openUrl(PLACEHOLDER_URLS.privacy)}>
            <Feather name="file-text" size={18} color={GOLD} />
            <Text style={styles.settingTextWithFlex}>Privacy Policy</Text>
            <Feather name="external-link" size={18} color={colors.lightSubtext} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => openUrl(PLACEHOLDER_URLS.support)}>
            <Feather name="help-circle" size={18} color={GOLD} />
            <Text style={styles.settingTextWithFlex}>Support</Text>
            <Feather name="external-link" size={18} color={colors.lightSubtext} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => openUrl(PLACEHOLDER_URLS.terms)}>
            <Feather name="book" size={18} color={GOLD} />
            <Text style={styles.settingTextWithFlex}>Terms of Service</Text>
            <Feather name="external-link" size={18} color={colors.lightSubtext} />
          </TouchableOpacity>
        </View>

        {user && (
          <>
        <TouchableOpacity
          style={[styles.settingItem, styles.signOutItem]}
          onPress={handleSignOut}
        >
          <Feather name="log-out" size={18} color="#DC2626" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem, styles.deleteItem]}
          onPress={handleDeleteAccount}
          disabled={isDeletingAccount}
          activeOpacity={0.8}
        >
          <Feather name="trash-2" size={18} color="#ff3b30" />
          <View style={styles.settingTextWrap}>
            <Text style={styles.deleteText}>
              {isDeletingAccount ? 'Deleting…' : 'Delete Account'}
            </Text>
            <Text style={styles.deleteSubtext}>
              Permanently removes all your data
            </Text>
          </View>
        </TouchableOpacity>
          </>
        )}

        {(isDev || user?.isModerator) && (
          <View style={styles.devSection}>
            <Text style={styles.devSectionTitle}>{user?.isModerator ? 'Moderator & Dev Debug' : 'Dev Debug'}</Text>
            <TouchableOpacity style={styles.settingItem} onPress={handlePrintSessionId}>
              <Feather name="code" size={18} color={colors.lightSubtext} />
              <Text style={styles.settingTextWithFlex}>Print current session user id</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem} onPress={handleCountLogbook}>
              <Feather name="database" size={18} color={colors.lightSubtext} />
              <Text style={styles.settingTextWithFlex}>Count my logbook entries</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem} onPress={handleForceRefreshProfile}>
              <Feather name="refresh-cw" size={18} color={colors.lightSubtext} />
              <Text style={styles.settingTextWithFlex}>Force refresh profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem} onPress={handleRestartOnboardingAsNewUser}>
              <Feather name="rotate-ccw" size={18} color={colors.lightSubtext} />
              <Text style={styles.settingTextWithFlex}>Restart onboarding as new user</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem} onPress={handleMockChestOpen}>
              <Feather name="package" size={18} color={colors.lightSubtext} />
              <Text style={styles.settingTextWithFlex}>Mock chest opening (badge unlock)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => setTestErrorBoundary(true)}
            >
              <Feather name="alert-triangle" size={18} color={colors.lightSubtext} />
              <Text style={styles.settingTextWithFlex}>Test Error Boundary</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem} onPress={handleOpenPaywall}>
              <Feather name="credit-card" size={18} color={colors.lightSubtext} />
              <Text style={styles.settingTextWithFlex}>Open paywall</Text>
            </TouchableOpacity>
          </View>
        )}

        <TackleBoxUnlockModal
          visible={mockChestVisible}
          onDismiss={() => setMockChestVisible(false)}
          badgeName="Redfish Elite"
          badgeKey="species-red-drum-elite"
          rarity={'EPIC' as BadgeRarity}
          subtitle="Caught 5 Redfish"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  android: { elevation: 3 },
});

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.lightText,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.lightSubtext,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.lightCard,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    ...cardShadow,
  },
  settingTextWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.lightText,
  },
  settingTextWithFlex: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.lightText,
  },
  settingSubtext: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 4,
  },
  proItem: {
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  signOutItem: {
    marginTop: 24,
    borderColor: '#DC262620',
  },
  signOutText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  deleteItem: {
    marginTop: 8,
    borderColor: '#ff3b3025',
    backgroundColor: '#1a0505',
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff3b30',
  },
  deleteSubtext: {
    fontSize: 12,
    color: '#ff3b3090',
    marginTop: 2,
  },
  legalSection: {
    marginTop: 24,
  },
  legalSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.lightSubtext,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  devSection: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
  },
  devSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.lightSubtext,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
});
