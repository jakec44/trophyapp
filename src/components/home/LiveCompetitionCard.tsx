import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { FishEntry } from '@/src/types/tournaments';
import { TournamentCountdown } from '@/src/components/gamification/TournamentCountdown';
import { LeaderboardRow } from './LeaderboardRow';

interface LiveCompetitionCardProps {
  title: string;
  description: string;
  endsAt: string;
  topEntries: FishEntry[];
  entrantsCount: number;
  onVote?: (entryId: string, vote: 'UP' | 'DOWN' | null) => void;
  voteLoading?: string | null;
}

export function LiveCompetitionCard({
  title,
  description,
  endsAt,
  topEntries,
  entrantsCount,
  onVote,
  voteLoading,
}: LiveCompetitionCardProps) {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.92,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.95}
      onPress={() => router.push('/(tabs)/tournaments')}
    >
      <View style={styles.liveRow}>
        <Animated.View
          style={[
            styles.liveDot,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <Text style={styles.liveText}>LIVE</Text>
        <View style={styles.spacer} />
        <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
        <TournamentCountdown endsAt={endsAt} compact onDark />
        <Text style={styles.entrants}>{entrantsCount} competing</Text>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.podium}>
        {topEntries.length === 0 ? (
          <Text style={styles.empty}>Be the first to enter</Text>
        ) : (
          topEntries.slice(0, 3).map((entry, idx) => (
            <LeaderboardRow
              key={entry.id}
              entry={entry}
              rank={idx + 1}
              metricType="WEIGHT_LBS"
              onVote={onVote ?? (() => {})}
              voteLoading={voteLoading}
            />
          ))
        )}
      </View>

      <TouchableOpacity
        style={styles.footer}
        onPress={() => router.push('/(tabs)/tournaments')}
        activeOpacity={0.8}
      >
        <Text style={styles.viewAll}>View leaderboard</Text>
        <Ionicons name="chevron-forward" size={18} color="#FFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.brightBlue,
    ...Platform.select({
      ios: {
        shadowColor: '#0066FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF4444',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1.2,
  },
  spacer: {
    flex: 1,
  },
  entrants: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 16,
    lineHeight: 20,
  },
  podium: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  empty: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    paddingVertical: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewAll: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
