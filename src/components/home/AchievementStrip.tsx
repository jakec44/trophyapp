/**
 * Achievement strip under fish photo — live event feel (Strava/Instagram style)
 * Renders only available fields; compact, no horizontal overflow
 */

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/utils/colors';

export interface AchievementStripProps {
  isLiveCatch?: boolean;
  tournamentName?: string;
  previousRank?: number;
  currentRank?: number;
  xpGained?: number;
}

export function AchievementStrip({
  isLiveCatch,
  tournamentName,
  previousRank,
  currentRank,
  xpGained,
}: AchievementStripProps) {
  const hasTournament = !!tournamentName?.trim();
  const hasRank = currentRank != null;
  const rankStr =
    hasRank && previousRank != null
      ? `Rank: #${previousRank} → #${currentRank}`
      : hasRank
        ? `Rank: #${currentRank}`
        : null;
  const hasXp = xpGained != null && xpGained > 0;

  const hasAny =
    isLiveCatch ||
    hasTournament ||
    !!rankStr ||
    hasXp;

  if (!hasAny) return null;

  return (
    <View style={styles.strip}>
      {isLiveCatch && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>JUST CAUGHT</Text>
        </View>
      )}
      {hasTournament && (
        <Text style={[styles.line, styles.lineSpaced]} numberOfLines={1}>
          Entered: {tournamentName}
        </Text>
      )}
      {rankStr && (
        <Text style={[styles.line, styles.lineSpaced]}>{rankStr}</Text>
      )}
      {hasXp && (
        <Text style={styles.line}>+{xpGained} XP Shared</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 12,
    backgroundColor: colors.lightCard,
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
  },
  lineSpaced: {
    marginTop: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: 6,
    backgroundColor: colors.accentBlue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  line: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.lightText,
  },
});
