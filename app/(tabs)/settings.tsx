import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
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
import { getUserCatches, deleteAccount } from '@/src/lib/supabase';

const GOLD = colors.gold;

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, refreshProfile } = useAuthContext();
  const [isPublic, setIsPublic] = useState(true);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomSafePadding();
  const topPadding = Math.max(insets.top, 16) + 4;

  const handleSignOut = async () => {
    const doSignOut = async () => {
      await signOut();
      router.replace('/(auth)/sign-in');
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

  const handleClearLocalCache = async () => {
    if (!user?.id) return;
    const prefix = `@Snagged/user/${user.id}`;
    const keys = [
      `${prefix}/xp`,
      `${prefix}/coins`,
      `${prefix}/totalCatches`,
      `${prefix}/totalTournaments`,
      `${prefix}/personalRecords`,
      `${prefix}/caughtSpecies`,
      `${prefix}/caughtSpeciesDates`,
    ];
    await AsyncStorage.multiRemove(keys);
    Alert.alert('Cache Cleared', 'Local XP, coins, and species cache wiped. Restart the app to reload from the server.');
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
                      router.replace('/(auth)/sign-in');
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
          onPress={() => router.push('/(tabs)/profile-edit')}
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
          <Feather name="lock" size={18} color={GOLD} />
          <View style={styles.settingTextWrap}>
            <Text style={styles.settingText}>Account visibility</Text>
            <Text style={styles.settingSubtext} numberOfLines={2}>
              {isPublic ? 'Public — others can view your logbook (bg-removed only)' : 'Private — only tournament fish visible'}
            </Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
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

        {__DEV__ && (
          <View style={styles.devSection}>
            <Text style={styles.devSectionTitle}>Dev Debug</Text>
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
            <TouchableOpacity style={styles.settingItem} onPress={handleClearLocalCache}>
              <Feather name="trash" size={18} color={colors.lightSubtext} />
              <Text style={styles.settingTextWithFlex}>Clear local XP/species cache</Text>
            </TouchableOpacity>
          </View>
        )}
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
