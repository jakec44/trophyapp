/**
 * Home — scrollable hub of destinations (Tournaments, Trophies, …).
 */

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { HomeDestinationTile } from '@/src/components/home/HomeDestinationTile';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import { colors } from '@/utils/colors';

export default function HomeScreen() {
  const router = useRouter();
  const bottomPadding = useBottomSafePadding();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <SnaggedWordmark />
          <Text style={styles.eyebrow}>Home</Text>
        </View>

        <HomeDestinationTile
          title="TOURNAMENTS"
          subtitle="Biggest Fish Overall, Redfish, Bass, Snook, Flounder, Striper, Tarpon, Trout, Smallest."
          icon="medal-outline"
          accent={colors.teal}
          delayMs={0}
          onPress={() => router.replace('/(tabs)/tournaments' as any)}
        />

        <HomeDestinationTile
          title="TROPHIES"
          subtitle="Global, local, and friends trophy standings. See where you rank."
          icon="trophy-outline"
          accent={colors.gold}
          delayMs={120}
          onPress={() => router.push('/(tabs)/leaderboard')}
        />

        {/* Room for future hub destinations */}
        <View style={styles.futureSlot} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    marginBottom: 20,
    gap: 6,
  },
  eyebrow: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  futureSlot: {
    minHeight: 120,
  },
});
