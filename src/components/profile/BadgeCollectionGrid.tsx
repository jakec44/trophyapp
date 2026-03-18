/**
 * BadgeCollectionGrid — Pokédex-style collectible badge album.
 * 6 per row, scrollable. Unlocked first (vibrant), locked (dimmed), 12 mystery at bottom.
 * Tap badge = pin/unpin. Tap (i) = preview details.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native';
import { colors } from '@/utils/colors';
import { RarityBadge } from '@/src/components/profile/RarityBadge';
import { AnimatedTrophyBadge } from '@/src/components/profile/AnimatedTrophyBadge';
import { SpeciesBadgeImage } from '@/src/components/profile/SpeciesBadgeImage';
import { hasCustomSpeciesBadgeImage } from '@/src/constants/speciesBadgeImages';
import type { BadgeRarity } from '@/src/types/badgeRarity';

const { width: SW } = Dimensions.get('window');
const COLS = 5;
const PADDING = 18;
const GAP = 12;
const CELL_SIZE = (SW - PADDING * 2 - GAP * (COLS - 1)) / COLS;
const BADGE_SIZE = Math.floor(CELL_SIZE) - 4;
const TILE_PADDING = 2;

export interface BadgeCollectionItem {
  id: string;
  name: string;
  unlockHint: string;
  rarity?: BadgeRarity;
  place?: 1 | 2 | 3;
  icon?: string;
  unlocked: boolean;
  /** For pin matching (display items use badgeKey) */
  badgeKey?: string;
}

interface BadgeCollectionGridProps {
  items: BadgeCollectionItem[];
  /** Tap badge = pin/unpin. Only called for unlocked badges. */
  onPinToggle?: (item: BadgeCollectionItem) => void;
  /** Tap (i) = show preview (how to unlock / how you unlocked) */
  onBadgeLongPress?: (item: BadgeCollectionItem) => void;
  /** Badge IDs currently pinned (show pin indicator) */
  pinnedIds?: string[];
  mysteryCount?: number;
}

export function BadgeCollectionGrid({
  items,
  onPinToggle,
  onBadgeLongPress,
  pinnedIds = [],
  mysteryCount = 12,
}: BadgeCollectionGridProps) {
  const displayItems = items;

  const renderBadgeCell = (item: BadgeCollectionItem, index: number) => {
    const isLocked = !item.unlocked;
    const isPinned = pinnedIds.includes(item.badgeKey ?? item.id) || pinnedIds.includes(item.id);
    const showDetail = () => onBadgeLongPress?.(item);

    return (
      <View key={item.id} style={styles.cell}>
        <View style={styles.tileWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.tile,
              isLocked ? styles.tileLocked : styles.tileUnlocked,
              isPinned && styles.tilePinned,
              pressed && { opacity: 0.8 },
              hasCustomSpeciesBadgeImage(item.badgeKey ?? '') && styles.tileNoCircle,
            ]}
            onPress={() => item.unlocked && showDetail()}
            onLongPress={() => item.unlocked && onPinToggle?.(item)}
          >
          {item.place != null ? (
            <AnimatedTrophyBadge
              place={item.place}
              size={BADGE_SIZE}
            />
          ) : hasCustomSpeciesBadgeImage(item.badgeKey ?? '') ? (
            <SpeciesBadgeImage badgeKey={item.badgeKey!} size={BADGE_SIZE} scale={1.5} />
          ) : (
            <RarityBadge
              rarity={item.rarity ?? 'COMMON'}
              icon={item.icon ?? '🎖️'}
              size={
                (item.badgeKey ?? '').startsWith('level-')
                  ? Math.floor(BADGE_SIZE * 0.72)
                  : (item.badgeKey ?? '').startsWith('achievement-')
                    ? Math.floor(BADGE_SIZE * 0.78)
                    : BADGE_SIZE
              }
              animated={!isLocked && (item.rarity === 'EPIC' || item.rarity === 'MYTHIC')}
            />
          )}
          {isLocked && (
            <View style={styles.lockOverlay}>
              <Text style={styles.lockIcon}>🔒</Text>
            </View>
          )}
          {isPinned && !isLocked && (
            <View style={styles.pinBadge}>
              <Text style={styles.pinIcon}>📌</Text>
            </View>
          )}
          </Pressable>
          <Pressable
            style={styles.infoBtn}
            onPress={showDetail}
            hitSlop={8}
          >
            <Text style={styles.infoBtnText}>ⓘ</Text>
          </Pressable>
        </View>
        <Text
          style={[styles.cellLabel, isLocked && styles.cellLabelLocked]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text
          style={[styles.unlockHint, isLocked && styles.unlockHintLocked]}
          numberOfLines={2}
        >
          {isLocked ? 'Tap ⓘ for details' : '✓ Unlocked · Tap to see fish'}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.instructionHint}>Tap badge to see fish · Long-press to pin</Text>
      <View style={styles.grid}>
        {displayItems.map(renderBadgeCell)}
      </View>

      {mysteryCount > 0 && (
        <View style={styles.mysterySection}>
          <Text style={styles.mysteryTitle}>MYSTERY BADGES</Text>
          <Text style={styles.mysterySubtitle}>Keep playing to discover</Text>
          <View style={styles.mysteryGrid}>
            {Array.from({ length: Math.min(mysteryCount, 12) }, (_, i) => (
              <MysteryBadgeCell key={`mystery-${i}`} index={i} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function MysteryBadgeCell({ index }: { index: number }) {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={styles.mysteryCell}>
      <Animated.View
        style={[
          styles.mysteryBadge,
          {
            opacity: pulse,
          },
        ]}
      >
        <Text style={styles.mysteryQuestion}>?</Text>
      </Animated.View>
      <Text style={styles.mysteryLabel}>Mystery</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  instructionHint: {
    fontSize: 12,
    color: 'rgba(122,175,201,0.85)',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: PADDING,
  },
  cell: {
    width: CELL_SIZE,
    alignItems: 'center',
    marginBottom: GAP,
  },
  tileWrap: {
    position: 'relative',
  },
  tile: {
    width: BADGE_SIZE + TILE_PADDING * 2,
    height: BADGE_SIZE + TILE_PADDING * 2,
    borderRadius: (BADGE_SIZE + TILE_PADDING * 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    position: 'relative',
  },
  tileNoCircle: {
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  tileUnlocked: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  tileLocked: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    opacity: 0.9,
  },
  tilePinned: {
    borderColor: colors.teal,
    borderWidth: 2.5,
    shadowColor: colors.teal,
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: (BADGE_SIZE + TILE_PADDING * 2) / 2,
  },
  lockIcon: {
    fontSize: 16,
  },
  pinBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: {
    fontSize: 10,
  },
  infoBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(122,175,201,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: {
    fontSize: 12,
    color: colors.lightText,
    fontWeight: '700',
  },
  cellLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.lightText,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 12,
    minHeight: 24,
  },
  cellLabelLocked: {
    color: 'rgba(122,175,201,0.5)',
    fontWeight: '600',
  },
  unlockHint: {
    fontSize: 9,
    color: 'rgba(122,175,201,0.7)',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 11,
    minHeight: 22,
  },
  unlockHintLocked: {
    color: 'rgba(122,175,201,0.4)',
  },
  mysterySection: {
    marginTop: 40,
    paddingHorizontal: PADDING,
  },
  mysteryTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: 'rgba(122,175,201,0.7)',
    marginBottom: 4,
  },
  mysterySubtitle: {
    fontSize: 11,
    color: 'rgba(122,175,201,0.5)',
    marginBottom: 14,
  },
  mysteryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  mysteryCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  mysteryBadge: {
    width: BADGE_SIZE + TILE_PADDING * 2,
    height: BADGE_SIZE + TILE_PADDING * 2,
    borderRadius: (BADGE_SIZE + TILE_PADDING * 2) / 2,
    backgroundColor: 'rgba(122,175,201,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(122,175,201,0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mysteryQuestion: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(122,175,201,0.5)',
  },
  mysteryLabel: {
    fontSize: 9,
    color: 'rgba(122,175,201,0.45)',
    textAlign: 'center',
    marginTop: 4,
  },
});
