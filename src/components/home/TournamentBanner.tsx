/**
 * Live tournament banner — shows the soonest-ending active tournament.
 * Scrolls with the feed, placed above "Recent Entries".
 */

import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import type { Tournament } from '@/src/types/tournaments';

interface Props {
  tournament: Tournament;
}

export function TournamentBanner({ tournament }: Props) {
  const router = useRouter();

  // Pulsing dot animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handlePress = () => {
    router.push({
      pathname: '/(tabs)/tournaments',
      params: { tournamentId: tournament.id },
    });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={handlePress}
    >
      <View style={styles.row}>
        <Animated.View style={[styles.dot, { opacity: pulseAnim }]} />
        <Text style={styles.endingSoon}>ENDING SOON</Text>
        <Text style={styles.name} numberOfLines={1}>{tournament.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const TEAL = colors.teal;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 6,
    marginTop: 6,
    backgroundColor: '#0b1220',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ff6b35',
    flexShrink: 0,
  },
  endingSoon: {
    fontSize: 9,
    fontWeight: '800',
    color: TEAL,
    letterSpacing: 1.2,
    flexShrink: 0,
  },
  name: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    flexShrink: 1,
  },
});
