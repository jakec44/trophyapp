/**
 * ProfileTrophiesSection — Trophies section on profile: grid of trophy badges; tap opens detail modal.
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { useTrophyBadges } from '@/src/hooks/useTrophyBadges';
import { TrophyBadgeDetailModal } from '@/src/components/profile/TrophyBadgeDetailModal';
import { AnimatedTrophyBadge } from '@/src/components/profile/AnimatedTrophyBadge';
import { PLACE_PALETTE } from '@/src/types/tournamentResults';
import type { TrophyBadgeRow } from '@/src/lib/supabase';

const BADGE_SIZE = 56;
const GAP = 10;
const COLS = 4;

interface ProfileTrophiesSectionProps {
  userId: string | null;
  /** When true (default), show "Trophies" title row. When false, only the grid (e.g. under "Trophies & badges"). */
  showSectionTitle?: boolean;
}

export function ProfileTrophiesSection({ userId, showSectionTitle = true }: ProfileTrophiesSectionProps) {
  const { badges, loading, refresh } = useTrophyBadges(userId);
  const [selectedBadge, setSelectedBadge] = useState<TrophyBadgeRow | null>(null);

  if (loading && badges.length === 0) return null;
  if (badges.length === 0) return null;

  return (
    <View style={styles.section}>
      {showSectionTitle && (
        <View style={styles.titleRow}>
          <Ionicons name="trophy" size={16} color={colors.gold} />
          <Text style={styles.sectionTitle}>Trophies</Text>
          <Text style={styles.sectionCount}>{badges.length}</Text>
        </View>
      )}

      <View style={styles.grid}>
        {badges.map((badge) => {
          const place = badge.place as 1 | 2 | 3;
          const palette = PLACE_PALETTE[place];
          return (
            <TouchableOpacity
              key={badge.id}
              style={[styles.badgeCell, { borderColor: palette.border }]}
              onPress={() => setSelectedBadge(badge)}
              activeOpacity={0.85}
            >
              <AnimatedTrophyBadge place={place} size={BADGE_SIZE - 8} />
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.gold} />
        </View>
      ) : null}

      <TrophyBadgeDetailModal
        visible={!!selectedBadge}
        badge={selectedBadge}
        onClose={() => setSelectedBadge(null)}
        onDeleted={refresh}
        onVisibilityChange={refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
    marginRight: -12,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  badgeCell: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loadingWrap: { marginTop: 8, alignItems: 'center' },
});
