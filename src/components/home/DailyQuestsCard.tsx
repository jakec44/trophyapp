/**
 * Daily Quests entry card — replaces "Ending Soon" on home.
 * Sparkle/glow, dark ocean / teal / gold; badge shows claimable count; tap opens Daily Quests screen.
 */

import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import { Ionicons } from '@expo/vector-icons';
const TEAL = colors.teal;
const GOLD = colors.gold;

interface Props {
  claimableCount?: number;
  countdown?: string;
}

export function DailyQuestsCard({ claimableCount = 0, countdown }: Props) {
  const router = useRouter();
  const sparkleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(sparkleAnim, { toValue: 0.95, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sparkleAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.35, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  const handlePress = () => {
    router.push('/daily-quests');
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={handlePress}
    >
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowAnim,
          },
        ]}
        pointerEvents="none"
      />
      <View style={styles.row}>
        <Animated.View style={{ transform: [{ scale: sparkleAnim }] }}>
          <Ionicons name="sparkles" size={18} color={GOLD} style={styles.sparkleIcon} />
        </Animated.View>
        <Text style={styles.title}>Daily Quests</Text>
        {countdown != null && (
          <Text style={styles.timer}>Resets in {countdown}</Text>
        )}
        {claimableCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{claimableCount}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={colors.lightSubtext} />
      </View>
    </TouchableOpacity>
  );
}

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
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: TEAL,
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sparkleIcon: {
    marginRight: 2,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.lightText,
    letterSpacing: 0.3,
  },
  timer: {
    fontSize: 11,
    color: colors.lightSubtext,
    marginRight: 4,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0b1220',
  },
});
