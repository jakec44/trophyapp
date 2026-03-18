/**
 * BadgeDetailModal — shows badge name, rarity, how to unlock, and unlock fish (if earned).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import { RarityBadge } from '@/src/components/profile/RarityBadge';
import { SpeciesBadgeImage } from '@/src/components/profile/SpeciesBadgeImage';
import { hasCustomSpeciesBadgeImage } from '@/src/constants/speciesBadgeImages';
import { RARITY_PALETTE } from '@/src/types/badgeRarity';
import type { BadgeRarity } from '@/src/types/badgeRarity';
import type { UnlockCatch } from '@/src/lib/speciesMastery';
import { resolveMediaUrl } from '@/src/lib/mediaUrl';

const { width: SW } = Dimensions.get('window');
const FISH_SIZE = 72;

function getCatchPhotoUrl(c: UnlockCatch): string | null {
  if (c.photo_url?.trim()) return c.photo_url.trim();
  if (c.photo_path?.trim()) return resolveMediaUrl('media', c.photo_path);
  return null;
}

interface BadgeDetailModalProps {
  visible: boolean;
  onClose: () => void;
  name: string;
  rarity: BadgeRarity;
  unlockHint: string;
  unlocked?: boolean;
  unlockCatches?: UnlockCatch[];
  badgeKey?: string;
}

export function BadgeDetailModal({
  visible,
  onClose,
  name,
  rarity,
  unlockHint,
  unlocked = false,
  unlockCatches = [],
  badgeKey,
}: BadgeDetailModalProps) {
  const router = useRouter();
  if (!visible) return null;
  const palette = RARITY_PALETTE[rarity];

  const openCatch = (id: string) => {
    onClose();
    router.push(`/catch/${id}`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.badgeRow}>
              {badgeKey && hasCustomSpeciesBadgeImage(badgeKey) ? (
                <SpeciesBadgeImage badgeKey={badgeKey} size={96} scale={1.4} />
              ) : (
                <RarityBadge rarity={rarity} size={96} icon="🎖️" animated />
              )}
            </View>
            <Text style={styles.name}>{name}</Text>
            <View style={[styles.rarityPill, { backgroundColor: palette.primary + '25', borderColor: palette.border }]}>
              <Text style={[styles.rarityText, { color: palette.primary }]}>{palette.label} BADGE</Text>
            </View>
            <Text style={styles.hint}>{unlockHint}</Text>

            {unlocked && (
            <View style={styles.fishSection}>
              <Text style={styles.fishSectionTitle}>
                {unlockCatches.length > 0
                  ? unlockCatches.length === 1
                    ? 'Fish that earned this badge'
                    : 'Fish that earned this badge'
                  : 'Earned by progress'}
              </Text>
              {unlockCatches.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.fishRow}
              >
                {unlockCatches.map((c) => {
                  const photoUrl = getCatchPhotoUrl(c);
                  return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.fishCard}
                    onPress={() => openCatch(c.id)}
                    activeOpacity={0.8}
                  >
                    {photoUrl ? (
                      <Image source={{ uri: photoUrl }} style={styles.fishThumb} resizeMode="cover" />
                    ) : (
                      <View style={styles.fishPlaceholder}>
                        <Text style={styles.fishPlaceholderIcon}>🐟</Text>
                      </View>
                    )}
                    <Text style={styles.fishSpecies} numberOfLines={1}>
                      {c.species ?? 'Fish'}
                    </Text>
                    {(c.weight_lb != null || c.length_in != null) && (
                      <Text style={styles.fishStats} numberOfLines={1}>
                        {c.weight_lb != null && `${c.weight_lb} lbs`}
                        {c.weight_lb != null && c.length_in != null && ' · '}
                        {c.length_in != null && `${c.length_in}"`}
                      </Text>
                    )}
                  </TouchableOpacity>
                  );
                })}
              </ScrollView>
              ) : (
                <Text style={styles.fishSectionSubtext}>Level and tournament badges are earned by XP and placements.</Text>
              )}
            </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Got it</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.lightCard,
    borderRadius: 16,
    padding: 24,
    maxWidth: 360,
    width: '100%',
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  scrollBody: { flexGrow: 0, flexShrink: 1, maxHeight: 420 },
  scrollContent: { paddingBottom: 8 },
  badgeRow: { alignItems: 'center', marginBottom: 16 },
  name: { fontSize: 20, fontWeight: '800', color: colors.lightText, textAlign: 'center', marginBottom: 8 },
  rarityPill: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  rarityText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  hint: { fontSize: 14, color: colors.lightSubtext, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  fishSection: { marginBottom: 16 },
  fishSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.lightSubtext,
    marginBottom: 10,
  },
  fishSectionSubtext: {
    fontSize: 13,
    color: colors.lightSubtext,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  fishRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  fishCard: {
    width: FISH_SIZE + 24,
    alignItems: 'center',
  },
  fishThumb: {
    width: FISH_SIZE,
    height: FISH_SIZE,
    borderRadius: 10,
  },
  fishPlaceholder: {
    width: FISH_SIZE,
    height: FISH_SIZE,
    borderRadius: 10,
    backgroundColor: 'rgba(122,175,201,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fishPlaceholderIcon: { fontSize: 28 },
  fishSpecies: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.lightText,
    marginTop: 6,
    textAlign: 'center',
  },
  fishStats: {
    fontSize: 10,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  closeBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.accentBlue,
  },
  closeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
