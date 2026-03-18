/**
 * Bottom sheet: "Display badges" — choose up to 3 items for profile row.
 * Shows full badge catalog (unlocked + locked in gray). Only unlocked can be pinned.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { EarnedBadgeItem } from './ProfileHeader';
import type { TrophyWithDetails } from '@/src/lib/supabase';
import { AnimatedTrophyBadge } from '@/src/components/profile/AnimatedTrophyBadge';
import { RarityBadge } from '@/src/components/profile/RarityBadge';
import { SpeciesBadgeImage } from '@/src/components/profile/SpeciesBadgeImage';
import { hasCustomSpeciesBadgeImage } from '@/src/constants/speciesBadgeImages';
import { getPlaceLabel } from '@/src/types/tournamentResults';
import type { BadgeRarity } from '@/src/types/badgeRarity';
import { getBadgeCollectionItems, type BadgeCollectionItemData } from '@/src/lib/speciesMastery';

const MAX_DISPLAY = 3;
const { width: SW, height: SH } = Dimensions.get('window');
const SHEET_HEIGHT = Math.floor(SH * 0.9);
const COLS = 5;
const PADDING = 18;
const GAP = 12;
const CELL_SIZE = (SW - PADDING * 2 - GAP * (COLS - 1)) / COLS;
const BADGE_SIZE = Math.floor(CELL_SIZE) - 4;
const TILE_PADDING = 2;

export type DisplaySelectionItem =
  | { type: 'badge'; badge_key: string }
  | { type: 'trophy'; trophy_id: string };

interface DisplayBadgesSheetProps {
  visible: boolean;
  trophies: TrophyWithDetails[];
  earnedBadges: EarnedBadgeItem[];
  userId: string | null;
  initialSelection: DisplaySelectionItem[];
  onSave: (items: DisplaySelectionItem[]) => void;
  onClose: () => void;
}

function inferRarityFromBadgeId(id: string): BadgeRarity {
  if (id.endsWith('-legend')) return 'MYTHIC';
  if (id.endsWith('-elite')) return 'EPIC';
  if (id.endsWith('-master')) return 'RARE';
  return 'COMMON';
}

export function DisplayBadgesSheet({
  visible,
  trophies,
  earnedBadges,
  userId,
  initialSelection,
  onSave,
  onClose,
}: DisplayBadgesSheetProps) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<DisplaySelectionItem[]>([]);
  const [allBadges, setAllBadges] = useState<BadgeCollectionItemData[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) sheetTranslateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(sheetTranslateY, {
            toValue: 400,
            duration: 200,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) sheetTranslateY.setValue(0);
  }, [visible]);

  useEffect(() => {
    if (visible) setSelected([...initialSelection]);
  }, [visible, initialSelection]);

  useEffect(() => {
    if (visible && userId) {
      setBadgesLoading(true);
      getBadgeCollectionItems(userId)
        .then(setAllBadges)
        .finally(() => setBadgesLoading(false));
    } else {
      setAllBadges([]);
    }
  }, [visible, userId]);

  const toggleBadge = (badgeKey: string) => {
    setSelected((prev) => {
      const has = prev.some((s) => s.type === 'badge' && s.badge_key === badgeKey);
      if (has) return prev.filter((s) => !(s.type === 'badge' && s.badge_key === badgeKey));
      if (prev.length >= MAX_DISPLAY) return prev;
      return [...prev, { type: 'badge' as const, badge_key: badgeKey }];
    });
  };

  const toggleTrophy = (trophyId: string) => {
    setSelected((prev) => {
      const has = prev.some((s) => s.type === 'trophy' && s.trophy_id === trophyId);
      if (has) return prev.filter((s) => !(s.type === 'trophy' && s.trophy_id === trophyId));
      if (prev.length >= MAX_DISPLAY) return prev;
      return [...prev, { type: 'trophy' as const, trophy_id: trophyId }];
    });
  };

  const isBadgeSelected = (badgeKey: string) =>
    selected.some((s) => s.type === 'badge' && s.badge_key === badgeKey);
  const isTrophySelected = (trophyId: string) =>
    selected.some((s) => s.type === 'trophy' && s.trophy_id === trophyId);
  const atMax = selected.length >= MAX_DISPLAY;

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  if (!visible) return null;

  const renderTrophyCell = (t: TrophyWithDetails) => {
    const isSelected = isTrophySelected(t.id);
    const disabled = atMax && !isSelected;

    return (
      <TouchableOpacity
        key={`trophy-${t.id}`}
        style={styles.cell}
        onPress={() => !disabled && toggleTrophy(t.id)}
        activeOpacity={0.75}
        disabled={disabled}
      >
        <View
          style={[
            styles.tile,
            styles.tileUnlocked,
            isSelected && styles.tilePinned,
            disabled && styles.tileDisabled,
          ]}
        >
          <AnimatedTrophyBadge place={t.place as 1 | 2 | 3 | 4 | 5} size={BADGE_SIZE} />
          {isSelected && (
            <View style={styles.pinBadge}>
              <Ionicons name="checkmark" size={10} color="#000" />
            </View>
          )}
        </View>
        <Text style={[styles.cellLabel, disabled && styles.cellLabelLocked]} numberOfLines={2}>
          {getPlaceLabel(t.place)}
        </Text>
        <Text style={[styles.unlockHint, disabled && styles.unlockHintLocked]} numberOfLines={2}>
          {t.tournament_name ?? 'Tournament'}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderBadgeCell = (b: BadgeCollectionItemData) => {
    const badgeKey = b.badgeKey ?? b.id;
    const isLocked = !b.unlocked;
    const isSelected = isBadgeSelected(badgeKey);
    const canPin = b.unlocked && (!atMax || isSelected);

    return (
      <TouchableOpacity
        key={`badge-${badgeKey}`}
        style={styles.cell}
        onPress={() => canPin && toggleBadge(badgeKey)}
        activeOpacity={isLocked ? 1 : 0.75}
        disabled={isLocked}
      >
        <View
          style={[
            styles.tile,
            isLocked ? styles.tileLocked : styles.tileUnlocked,
            isSelected && styles.tilePinned,
            !canPin && !isLocked && styles.tileDisabled,
            hasCustomSpeciesBadgeImage(badgeKey) && styles.tileNoCircle,
          ]}
        >
          {b.place != null ? (
            <AnimatedTrophyBadge place={b.place} size={BADGE_SIZE} />
          ) : hasCustomSpeciesBadgeImage(badgeKey) ? (
            <SpeciesBadgeImage badgeKey={badgeKey} size={BADGE_SIZE} scale={1.5} />
          ) : (
            <RarityBadge
              rarity={b.rarity ?? 'COMMON'}
              icon={b.icon ?? '🎖️'}
              size={
                (badgeKey ?? '').startsWith('level-')
                  ? Math.floor(BADGE_SIZE * 0.72)
                  : (badgeKey ?? '').startsWith('achievement-')
                    ? Math.floor(BADGE_SIZE * 0.78)
                    : BADGE_SIZE
              }
              animated={!isLocked && isSelected && (b.rarity === 'EPIC' || b.rarity === 'MYTHIC')}
            />
          )}
          {isLocked && (
            <View style={styles.lockOverlay}>
              <Text style={styles.lockIcon}>🔒</Text>
            </View>
          )}
          {isSelected && !isLocked && (
            <View style={styles.pinBadge}>
              <Ionicons name="checkmark" size={10} color="#000" />
            </View>
          )}
        </View>
        <Text style={[styles.cellLabel, isLocked && styles.cellLabelLocked]} numberOfLines={2}>
          {b.name}
        </Text>
        <Text style={[styles.unlockHint, isLocked && styles.unlockHintLocked]} numberOfLines={2}>
          {isLocked ? b.unlockHint : isSelected ? '✓ Pinned' : 'Tap to pin'}
        </Text>
      </TouchableOpacity>
    );
  };

  const hasItems = trophies.length > 0 || allBadges.length > 0;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16 },
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.handle} {...panResponder.panHandlers} />
          <View style={styles.header}>
            <Text style={styles.title}>Display badges</Text>
            <Text style={styles.subtitle}>
              Choose up to 3 to show on your profile
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.lightSubtext} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            scrollEventThrottle={16}
            nestedScrollEnabled={true}
          >
            {badgesLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.teal} />
                <Text style={styles.loadingText}>Loading badges…</Text>
              </View>
            ) : hasItems ? (
              <View style={styles.grid}>
                {trophies.map(renderTrophyCell)}
                {allBadges.map(renderBadgeCell)}
              </View>
            ) : (
              <Text style={styles.empty}>
                No trophies or badges yet. Place in tournaments or level up!
              </Text>
            )}
          </ScrollView>

          {atMax && (
            <Text style={styles.atMaxHint}>
              Maximum 3 selected. Deselect one to add another.
            </Text>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.lightCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SHEET_HEIGHT,
    paddingHorizontal: PADDING,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lightBorder,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.lightText,
  },
  subtitle: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    width: CELL_SIZE,
    alignItems: 'center',
    marginBottom: GAP,
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
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 999,
  },
  lockIcon: { fontSize: 14 },
  tileDisabled: {
    opacity: 0.45,
  },
  tilePinned: {
    borderColor: colors.teal,
    borderWidth: 2.5,
    shadowColor: colors.teal,
    shadowOpacity: 0.35,
    shadowRadius: 6,
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
  },
  unlockHintLocked: {
    color: 'rgba(122,175,201,0.4)',
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.lightSubtext,
  },
  empty: {
    fontSize: 14,
    color: colors.lightSubtext,
    textAlign: 'center',
    paddingVertical: 32,
  },
  atMaxHint: {
    fontSize: 12,
    color: colors.gold,
    marginTop: 12,
    textAlign: 'center',
  },
  saveBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.teal,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
});
