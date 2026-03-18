/**
 * Onboarding warm-up page 1.
 * Simple welcome; Next goes to page 2.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';

const TEAL = colors.teal;
const GOLD = colors.gold;
const BG = '#020b14';

export default function OnboardingPage1() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🎣</Text>
        <Text style={styles.title}>Welcome to Snagged</Text>
        <Text style={styles.subtitle}>
          Log your catches, compete in tournaments, and level up as an angler.
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.push('/onboarding/2')}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>Next</Text>
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
