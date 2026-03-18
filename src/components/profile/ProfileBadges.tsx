/**
 * ProfileBadges (Trophies)
 * Shows tournament placement trophies on the user's profile (gold/silver/bronze).
 * Each chip is tappable and shows how the trophy was earned.
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { TournamentWinScreen } from '@/src/components/competitions/TournamentWinScreen';
import type { TournamentResult } from '@/src/types/tournamentResults';
import { PLACE_PALETTE } from '@/src/types/tournamentResults';

interface Props {
  results: TournamentResult[];
  username: string;
  avatarUrl?: string | null;
  onViewLeaderboard?: (tournamentId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function BadgeChip({
  result,
  onPress,
}: {
  result: TournamentResult;
  onPress: () => void;
}) {
  const palette = PLACE_PALETTE[result.place];
  const shortName = result.tournament_name.length > 22
    ? result.tournament_name.slice(0, 20) + '…'
    : result.tournament_name;

  return (
    <TouchableOpacity
      style={[styles.chip, { borderColor: palette.border }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Gold / silver / bronze trophy by place */}
      <Text style={styles.chipMedal}>{palette.medal}</Text>

      {/* Text */}
      <View style={styles.chipInfo}>
        <Text style={[styles.chipPlace, { color: palette.primary }]} numberOfLines={1}>
          {palette.label}
        </Text>
        <Text style={styles.chipName} numberOfLines={1}>{shortName}</Text>
        <Text style={styles.chipDate}>{formatDate(result.created_at)}</Text>
      </View>

      <Ionicons name="chevron-forward" size={14} color={palette.primary} style={{ opacity: 0.7 }} />
    </TouchableOpacity>
  );
}

export function ProfileBadges({ results, username, avatarUrl, onViewLeaderboard }: Props) {
  const [activeResult, setActiveResult] = useState<TournamentResult | null>(null);

  if (results.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Ionicons name="trophy" size={16} color={colors.gold} />
        <Text style={styles.sectionTitle}>Trophies</Text>
        <Text style={styles.sectionCount}>{results.length}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {results.map((r) => (
          <BadgeChip key={r.id} result={r} onPress={() => setActiveResult(r)} />
        ))}
      </ScrollView>

      {activeResult && (
        <TournamentWinScreen
          result={activeResult}
          username={username}
          avatarUrl={avatarUrl}
          visible={!!activeResult}
          onClose={() => setActiveResult(null)}
          onViewLeaderboard={
            onViewLeaderboard
              ? () => {
                  setActiveResult(null);
                  onViewLeaderboard(activeResult.tournament_id);
                }
              : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 12,
  },
  sectionFullWidth: {
    marginRight: -12,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.lightText,
    flex: 1,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
    backgroundColor: colors.gold + '22',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 200,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#080e1a',
  },
  chipMedal: {
    fontSize: 26,
    flexShrink: 0,
  },
  chipInfo: {
    flex: 1,
    minWidth: 0,
  },
  chipPlace: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chipName: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  chipDate: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
});
