/**
 * Win card — shows place, tournament name, fish entered.
 * Used in ProfileWinsSheet and on the wins page (with optional Share).
 */

import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { TournamentResult } from '@/src/types/tournamentResults';
import { PLACE_PALETTE, getPlaceLabel } from '@/src/types/tournamentResults';
import { isValidImageUri } from '@/src/lib/imageUri';

export interface WinCardProps {
  result: TournamentResult;
  /** When set, show a Share button at the bottom */
  onShare?: () => void;
  /** Compact mode for grid preview (smaller text, no fish section) */
  compact?: boolean;
}

export function WinCard({ result, onShare, compact }: WinCardProps) {
  const palette = PLACE_PALETTE[result.place];
  const hasPhoto = !!result.fish_photo_url && isValidImageUri(result.fish_photo_url);
  const species = result.fish_species?.trim() || 'Fish';
  const weight = result.weight_lbs != null && result.weight_lbs > 0 ? `${result.weight_lbs} lbs` : null;
  const length = result.length_in != null && result.length_in > 0 ? `${result.length_in} in` : null;
  const stats = [weight, length].filter(Boolean).join(' · ') || '—';

  if (compact) {
    return (
      <View style={[styles.cardCompact, { borderColor: palette.border }]}>
        <View style={[styles.placeBarCompact, { backgroundColor: palette.primary + '22', borderColor: palette.border }]}>
          <Text style={styles.placeEmojiCompact}>{palette.medal}</Text>
          <Text style={[styles.placeTextCompact, { color: palette.primary }]}>
            {getPlaceLabel(result.place)}
          </Text>
        </View>
        <Text style={styles.tournamentNameCompact} numberOfLines={2}>
          {result.tournament_name ?? 'Tournament'}
        </Text>
        {hasPhoto ? (
          <Image source={{ uri: result.fish_photo_url! }} style={styles.fishThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.fishThumb, styles.fishPlaceholder]}>
            <Ionicons name="fish-outline" size={24} color={colors.lightSubtext} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderColor: palette.border }]}>
      <View style={[styles.placeBar, { backgroundColor: palette.primary + '22', borderColor: palette.border }]}>
        <Text style={styles.placeEmoji}>{palette.medal}</Text>
        <Text style={[styles.placeText, { color: palette.primary }]}>
          {getPlaceLabel(result.place)} Place
        </Text>
      </View>
      <Text style={styles.tournamentName} numberOfLines={2}>
        {result.tournament_name ?? 'Tournament'}
      </Text>
      <View style={[styles.fishSection, { borderColor: palette.border }]}>
        <Text style={styles.fishSectionLabel}>Fish entered</Text>
        <View style={styles.fishRow}>
          {hasPhoto ? (
            <Image
              source={{ uri: result.fish_photo_url! }}
              style={styles.fishImg}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.fishImg, styles.fishPlaceholder]}>
              <Ionicons name="fish-outline" size={40} color={colors.lightSubtext} />
            </View>
          )}
          <View style={styles.fishInfo}>
            <Text style={styles.fishSpecies} numberOfLines={1}>{species}</Text>
            <Text style={styles.fishStats}>{stats}</Text>
          </View>
        </View>
      </View>
      {onShare && (
        <TouchableOpacity style={[styles.shareBtn, { backgroundColor: palette.primary + '22', borderColor: palette.border }]} onPress={onShare} activeOpacity={0.8}>
          <Ionicons name="share-social-outline" size={18} color={palette.primary} />
          <Text style={[styles.shareBtnText, { color: palette.primary }]}>Share</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const CARD_PADDING = 16;

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: colors.lightCard,
  },
  placeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  placeEmoji: { fontSize: 20 },
  placeText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.lightText,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  fishSection: {
    margin: 14,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fishSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.lightSubtext,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  fishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  fishImg: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.lightBackground,
  },
  fishPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fishInfo: { flex: 1, minWidth: 0 },
  fishSpecies: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.lightText,
  },
  fishStats: {
    fontSize: 13,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 14,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  // Compact (grid preview) — fixed aspect so grid rows are even
  cardCompact: {
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: colors.lightCard,
    width: '100%',
    aspectRatio: 0.72,
  },
  placeBarCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  placeEmojiCompact: { fontSize: 14 },
  placeTextCompact: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tournamentNameCompact: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.lightText,
    paddingHorizontal: 8,
    paddingTop: 6,
    flex: 1,
    minHeight: 36,
  },
  fishThumb: {
    flex: 1,
    minHeight: 60,
    backgroundColor: colors.lightBackground,
  },
});
