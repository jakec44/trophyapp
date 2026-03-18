/**
 * Onboarding warm-up page 2.
 * After this, if user is not Pro, show paywall; else go to tabs.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProStatus } from '@/src/hooks/useProStatus';
import { usePresentPaywall } from '@/src/hooks/usePresentPaywall';
import { colors } from '@/utils/colors';

const ONBOARDING_KEY = '@Snagged/onboarding_complete';
const TEAL = colors.teal;
const GOLD = colors.gold;
const BG = '#020b14';

export default function OnboardingPage2() {
  const router = useRouter();
  const { isPro } = useProStatus();
  const { presentPaywall } = usePresentPaywall();

  const handleFinish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    if (isPro) {
      router.replace('/(tabs)');
    } else {
      const usedNativePaywall = await presentPaywall();
      if (usedNativePaywall) router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.emoji}>⚓</Text>
        <Text style={styles.title}>You're all set</Text>
        <Text style={styles.subtitle}>
          Start logging fish and joining tournaments. Upgrade to Pro anytime for unlimited entries and logbook.
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={handleFinish}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>Get started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: { fontSize: 56, marginBottom: 24 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.lightText,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.lightSubtext,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  btn: {
    backgroundColor: TEAL,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: BG,
  },
});
