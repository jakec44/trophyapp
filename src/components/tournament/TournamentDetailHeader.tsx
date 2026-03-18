/**
 * Sticky tournament header for single-tournament detail screen.
 * Shows: title, GLOBAL/LOCAL scope, LIVE/ENDED, countdown, entrants, unit.
 */

import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { Tournament, MetricType } from '@/src/types/tournaments';
import { TournamentCountdown } from '@/src/components/gamification/TournamentCountdown';
import { useTournamentWinCheckContext } from '@/src/context/TournamentWinCheckContext';
import { GlobalLocalToggle } from '@/src/components/competitions/GlobalLocalToggle';

function getMetricLabel(metricType: MetricType): { label: string; icon: keyof typeof Ionicons.glyphMap } {
  switch (metricType) {
    case 'WEIGHT_LBS':
      return { label: 'Lbs', icon: 'scale-outline' };
    case 'LENGTH_IN':
      return { label: 'Inches', icon: 'resize-outline' };
    case 'VOTES_UP':
      return { label: 'Votes', icon: 'thumbs-up-outline' };
    default:
      return { label: 'Score', icon: 'stats-chart-outline' };
  }
}

interface TournamentDetailHeaderProps {
  tournament: Tournament;
  scope: 'global' | 'local';
  onScopeChange: (scope: 'global' | 'local') => void;
  showSyncSubtitle?: boolean;
}

export function TournamentDetailHeader({
  tournament,
  scope,
  onScopeChange,
  showSyncSubtitle = true,
}: TournamentDetailHeaderProps) {
  const winCheck = useTournamentWinCheckContext();

  const isEnded = tournament.endsAt && new Date(tournament.endsAt).getTime() < Date.now();
  const title =
    tournament.id === 'biggest-fish-this-week'
      ? 'Biggest Fish Overall'
      : `Biggest Fish Overall • ${tournament.title}`;
  const metric = getMetricLabel(tournament.metricType);

  const handleScopeChange = (v: 'global' | 'local') => {
    onScopeChange(v);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {/* One row: scope + countdown/ended + entrants · unit */}
      <View style={styles.topRow}>
        <View style={styles.scopeWrap}>
          <GlobalLocalToggle value={scope} onChange={handleScopeChange} dark />
        </View>
        <View style={styles.badges}>
          {isEnded ? (
            <Text style={styles.endedText}>Ended</Text>
          ) : (
            tournament.endsAt && (
              <TournamentCountdown
                endsAt={tournament.endsAt}
                onDark
                onEnded={() => {
                  winCheck?.triggerCheck();
                  winCheck?.triggerCheckForTournament(tournament.id);
                }}
              />
            )
          )}
        </View>
        <Text style={styles.entrants}>{tournament.entrantsCount} entrants</Text>
        <View style={styles.unitPill}>
          <Ionicons name={metric.icon} size={10} color={colors.teal} />
          <Text style={styles.unitText}>{metric.label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: colors.lightBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 6,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  scopeWrap: {
    marginRight: 4,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  endedText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.lightSubtext,
    fontStyle: 'italic',
  },
  entrants: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightSubtext,
    marginLeft: 4,
  },
  unitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(0,229,200,0.08)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.2)',
  },
  unitText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.teal,
  },
});
