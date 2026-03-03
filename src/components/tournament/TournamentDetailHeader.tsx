/**
 * Sticky tournament header for single-tournament detail screen.
 * Shows: title, GLOBAL/LOCAL scope, LIVE/ENDED, countdown, entrants, unit.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { Tournament, MetricType } from '@/src/types/tournaments';
import { TournamentCountdown } from '@/src/components/gamification/TournamentCountdown';
import { GlobalLocalToggle } from '@/src/components/competitions/GlobalLocalToggle';
import { useLocationPermission } from '@/src/hooks/useLocationPermission';

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
  const router = useRouter();
  const { ensurePermission } = useLocationPermission();

  const isEnded = tournament.endsAt && new Date(tournament.endsAt).getTime() < Date.now();
  const title =
    tournament.id === 'biggest-fish-this-week'
      ? 'Biggest Fish'
      : `Biggest Fish • ${tournament.title}`;
  const metric = getMetricLabel(tournament.metricType);

  const handleScopeChange = async (v: 'global' | 'local') => {
    if (v === 'local') {
      const granted = await ensurePermission();
      if (!granted) return;
    }
    onScopeChange(v);
  };

  return (
    <View style={styles.container}>
      <SnaggedWordmark />

      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      {/* Scope badge — GLOBAL / LOCAL, big and obvious */}
      <View style={styles.scopeWrap}>
        <GlobalLocalToggle value={scope} onChange={handleScopeChange} dark />
      </View>

      {/* Status + countdown row */}
      <View style={styles.badges}>
        {isEnded ? (
          <Text style={styles.endedText}>Ended</Text>
        ) : (
          tournament.endsAt && (
            <TournamentCountdown endsAt={tournament.endsAt} onDark />
          )
        )}
      </View>

      {/* Entrants + Unit */}
      <View style={styles.metaRow}>
        <Text style={styles.entrants}>{tournament.entrantsCount} entrants</Text>
        <View style={styles.unitPill}>
          <Ionicons name={metric.icon} size={12} color={colors.teal} />
          <Text style={styles.unitText}>Unit: {metric.label}</Text>
        </View>
      </View>

      {showSyncSubtitle && (
        <Text style={styles.subtitle}>Entries sync to Global & Local</Text>
      )}

      <View style={styles.votingRules}>
        <Text style={styles.votingRulesText}>
          👍 Verify size · 👎 Down votes over 50% may remove
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: colors.lightBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  scopeWrap: {
    marginBottom: 12,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  endedText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.lightSubtext,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  entrants: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  unitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,229,200,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.2)',
  },
  unitText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.teal,
  },
  subtitle: {
    fontSize: 11,
    color: colors.lightSubtext,
    marginBottom: 12,
  },
  votingRules: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(74, 144, 226, 0.08)',
    borderRadius: 10,
  },
  votingRulesText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
});
