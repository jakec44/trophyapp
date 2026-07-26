/**
 * More Competitions — Top 3 podium preview only.
 * Each card shows title, LIVE badge, top 3 rows with fish thumbnails + podium badges,
 * and "View Full Leaderboard →" link to competition detail.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/utils/colors';
import { CARD_RADIUS } from '@/src/constants/styles';
import type { Tournament } from '@/src/types/tournaments';
import { LeaderboardRow } from '@/src/components/home/LeaderboardRow';
import { TournamentCountdown } from '@/src/components/gamification/TournamentCountdown';
import { useTournamentWinCheckContext } from '@/src/context/TournamentWinCheckContext';
const ACCENT_BLUE = colors.accentBlue;

interface MoreCompetitionsSectionProps {
  competitions: Tournament[];
  onVote: (entryId: string, vote: 'UP' | 'DOWN' | null) => void;
  voteLoading: string | null;
  scope?: 'global' | 'local';
}

export function MoreCompetitionsSection({
  competitions,
  onVote,
  voteLoading,
  scope = 'global',
}: MoreCompetitionsSectionProps) {
  const router = useRouter();
  if (competitions.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Biggest Fish Overall</Text>
      {competitions.map((comp) => (
        <CompetitionPreviewCard
          key={comp.id}
          tournament={comp}
          onVote={onVote}
          voteLoading={voteLoading}
          onPress={() => router.push(`/tournament/${comp.id}?scope=${scope}`)}
        />
      ))}
    </View>
  );
}

interface CompetitionPreviewCardProps {
  tournament: Tournament;
  onVote: (entryId: string, vote: 'UP' | 'DOWN' | null) => void;
  voteLoading: string | null;
  onPress: () => void;
}

function CompetitionPreviewCard({
  tournament,
  onVote,
  voteLoading,
  onPress,
}: CompetitionPreviewCardProps) {
  const winCheck = useTournamentWinCheckContext();
  const isGeneral = tournament.id === 'biggest-fish-this-week';
  const displayTitle = isGeneral
    ? 'Biggest Fish Overall'
    : `Biggest Fish Overall · ${tournament.title}`;
  const top3 = tournament.topEntries.slice(0, 3);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {displayTitle}
        </Text>
        <View style={styles.ribbonRow}>
          {tournament.endsAt && (
            <TournamentCountdown
              endsAt={tournament.endsAt}
              compact
              onEnded={winCheck?.triggerCheck}
            />
          )}
        </View>
      </View>
      <Text style={styles.entrants}>{tournament.entrantsCount} entrants</Text>

      {top3.length === 0 ? (
        <Text style={styles.empty}>No entries yet</Text>
      ) : (
        <View style={styles.rows}>
          {top3[0] && (
            <View style={styles.firstPlace}>
              <LeaderboardRow
                key={top3[0].id}
                entry={top3[0]}
                rank={1}
                metricType={tournament.metricType}
                onVote={onVote}
                voteLoading={voteLoading}
                usePodiumBadge
              />
            </View>
          )}
          {top3.length >= 2 && (
            <View style={styles.secondThirdRow}>
              <View style={styles.rankTile} key={top3[1].id}>
                <LeaderboardRow
                  entry={top3[1]}
                  rank={2}
                  metricType={tournament.metricType}
                  onVote={onVote}
                  voteLoading={voteLoading}
                  usePodiumBadge
                  compact
                />
              </View>
              {top3[2] && (
                <View style={styles.rankTile} key={top3[2].id}>
                  <LeaderboardRow
                    entry={top3[2]}
                    rank={3}
                    metricType={tournament.metricType}
                    onVote={onVote}
                    voteLoading={voteLoading}
                    usePodiumBadge
                    compact
                  />
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.viewFullLink}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={styles.viewFullText}>View Full Leaderboard</Text>
        <Feather name="chevron-right" size={16} color={ACCENT_BLUE} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.lightCard,
    borderRadius: CARD_RADIUS,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 8,
  },
  ribbonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.lightText,
    flex: 1,
  },
  entrants: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginBottom: 8,
  },
  empty: {
    fontSize: 14,
    color: colors.lightSubtext,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rows: {
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
    marginTop: 4,
    paddingTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  firstPlace: {
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  secondThirdRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    flexShrink: 0,
  },
  rankTile: {
    flex: 1,
    minWidth: 130,
  },
  viewFullLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
  },
  viewFullText: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT_BLUE,
  },
});
