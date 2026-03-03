import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { FishEntry } from '@/src/types/tournaments';
import { TournamentCountdown } from '@/src/components/gamification/TournamentCountdown';
import { LeaderboardRow } from './LeaderboardRow';

interface BiggestFishThisWeekCardProps {
  title: string;
  description: string;
  endsAt: string;
  topEntries: FishEntry[];
  entrantsCount: number;
  onVote?: (entryId: string, vote: 'UP' | 'DOWN' | null) => void;
  voteLoading?: string | null;
}

export function BiggestFishThisWeekCard({
  title,
  description,
  endsAt,
  topEntries,
  entrantsCount,
  onVote,
  voteLoading,
}: BiggestFishThisWeekCardProps) {
  const router = useRouter();

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => router.push('/(tabs)/tournaments')}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <View style={styles.countdownRow}>
          <Ionicons name="time-outline" size={16} color={colors.lightSubtext} />
          <TournamentCountdown endsAt={endsAt} compact />
          <Text style={styles.entrants}>{entrantsCount} competing</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.podium}>
        {topEntries.length === 0 ? (
          <Text style={styles.empty}>Be the first to enter</Text>
        ) : (
          topEntries.map((entry, idx) => (
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
        activeOpacity={0.7}
      >
        <Text style={styles.viewAll}>More competitions</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.accentBlue} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.lightCard,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginBottom: 14,
    lineHeight: 20,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  entrants: {
    fontSize: 13,
    color: colors.lightSubtext,
    marginLeft: 'auto',
  },
  podium: {
    gap: 4,
  },
  empty: {
    fontSize: 15,
    color: colors.lightSubtext,
    textAlign: 'center',
    paddingVertical: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentBlue,
  },
});
