import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';
import type { Tournament, FishEntry } from '@/src/types/tournaments';
import { LeaderboardRow } from './LeaderboardRow';
import { TournamentCountdown } from '@/src/components/gamification/TournamentCountdown';
interface TournamentPreviewCardProps {
  tournament: Tournament;
  onVote: (entryId: string, vote: 'UP' | 'DOWN' | null) => void;
  voteLoading: string | null;
  /** When true, hide card chrome (used inside tabbed section) */
  compact?: boolean;
}

export function TournamentPreviewCard({
  tournament,
  onVote,
  voteLoading,
  compact = false,
}: TournamentPreviewCardProps) {
  const router = useRouter();
  const entries = tournament.topEntries.slice(0, 2);

  const handleViewAll = () => {
    router.push(`/tournament/${tournament.id}`);
  };

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {!compact && (
        <View style={styles.header}>
          <Text style={styles.title}>{tournament.title}</Text>
          <View style={styles.badges}>
            {tournament.endsAt && (
              <TournamentCountdown endsAt={tournament.endsAt} />
            )}
          </View>
        </View>
      )}
      <View style={styles.entrantsRow}>
        <Text style={[styles.entrants, compact && styles.entrantsCompact]}>
          {tournament.entrantsCount} entrants
        </Text>
        {tournament.endsAt && compact && (
          <>
            <Text style={[styles.entrants, compact && styles.entrantsCompact]}> · </Text>
            <TournamentCountdown endsAt={tournament.endsAt} compact />
          </>
        )}
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Be the first to enter</Text>
        </View>
      ) : (
        <View style={styles.rows}>
          {entries.map((entry, idx) => (
            <LeaderboardRow
              key={entry.id}
              entry={entry}
              rank={idx + 1}
              metricType={tournament.metricType}
              onVote={onVote}
              voteLoading={voteLoading}
            />
          ))}
        </View>
      )}

      {!compact && (
        <TouchableOpacity style={styles.viewAll} onPress={handleViewAll}>
          <Text style={styles.viewAllText}>View All Entries</Text>
          <Feather name="chevron-right" size={16} color={colors.accentBlue} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.lightText,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countdown: {
    fontSize: 12,
    color: colors.lightSubtext,
  },
  entrantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  entrants: {
    fontSize: 12,
    color: colors.lightSubtext,
  },
  rows: {
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
    marginTop: 4,
  },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.lightSubtext,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  cardCompact: {
    marginBottom: 0,
    paddingTop: 0,
    padding: 8,
    paddingHorizontal: 0,
  },
  entrantsCompact: {
    marginBottom: 6,
  },
});
