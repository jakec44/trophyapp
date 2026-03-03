import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { LivePositionData } from '@/src/utils/competitiveRankData';

const RANK_UP = '#22C55E';
const RANK_DOWN = '#DC2626';
const NEUTRAL = colors.lightSubtext;

interface LivePositionCardProps {
  data: LivePositionData;
}

export function LivePositionCard({ data }: LivePositionCardProps) {
  const router = useRouter();
  const pulseDot = useRef(new Animated.Value(1)).current;

  const change = data.rankChangeSinceYesterday;
  const isUp = change > 0;
  const isDown = change < 0;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseDot, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseDot, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseDot]);

  const movementText =
    isUp ? `↑ ${change} since yesterday` : isDown ? `↓ ${Math.abs(change)} since yesterday` : '— no change';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => router.push('/(tabs)/tournaments')}
    >
      <View style={styles.liveRow}>
        <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseDot }] }]} />
        <Text style={styles.liveLabel}>LIVE POSITION</Text>
        <Text style={styles.updated}>Updated 2m ago</Text>
      </View>

      <View style={styles.rankRow}>
        <Text style={styles.rankNumber}>#{data.rank}</Text>
        <Text style={styles.globalLabel}>Global</Text>
      </View>

      <View style={styles.movementRow}>
        <Ionicons
          name={isUp ? 'trending-up' : isDown ? 'trending-down' : 'remove'}
          size={16}
          color={isUp ? RANK_UP : isDown ? RANK_DOWN : NEUTRAL}
          style={styles.movementIcon}
        />
        <Text
          style={[
            styles.movementText,
            isUp && styles.movementUp,
            isDown && styles.movementDown,
          ]}
        >
          {movementText}
        </Text>
      </View>

      <Text style={styles.totalText}>{data.totalCompetitors.toLocaleString()} competing</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.lightCard,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brightBlue,
  },
  liveLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brightBlue,
    letterSpacing: 0.8,
  },
  updated: {
    fontSize: 11,
    color: colors.lightSubtext,
    marginLeft: 'auto',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  rankNumber: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.lightText,
    letterSpacing: -1,
  },
  globalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  movementIcon: {
    marginRight: 2,
  },
  movementText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  movementUp: {
    color: RANK_UP,
  },
  movementDown: {
    color: RANK_DOWN,
  },
  totalText: {
    fontSize: 12,
    color: colors.lightSubtext,
  },
});
