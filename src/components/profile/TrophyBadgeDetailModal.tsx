/**
 * TrophyBadgeDetailModal — shows a single trophy badge: tournament name, place, fish photo,
 * top 3 placements, show/hide, delete (with confirmation).
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TrophyBadgeRow } from '@/src/lib/supabase';
import {
  getTournamentPodium,
  setTrophyShown,
  setTrophyHidden,
  deleteTrophyBadge,
} from '@/src/lib/supabase';
import { PLACE_PALETTE, getPlaceLabel } from '@/src/types/tournamentResults';
import { isValidImageUri } from '@/src/lib/imageUri';
import { useAuthContext } from '@/src/context/AuthContext';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW - 48;

interface TrophyBadgeDetailModalProps {
  visible: boolean;
  badge: TrophyBadgeRow | null;
  onClose: () => void;
  /** Called after delete so profile can refresh trophy list */
  onDeleted?: () => void;
  /** Called after show/hide so profile can refresh */
  onVisibilityChange?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TrophyBadgeDetailModal({
  visible,
  badge,
  onClose,
  onDeleted,
  onVisibilityChange,
}: TrophyBadgeDetailModalProps) {
  const { user } = useAuthContext();
  const [podium, setPodium] = useState<TrophyBadgeRow[]>([]);
  const [podiumLoading, setPodiumLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!visible || !badge) return;
    setPodium([]);
    const cycleId = badge.cycle_id ?? 1;
    setPodiumLoading(true);
    getTournamentPodium(badge.tournament_id, cycleId)
      .then(setPodium)
      .finally(() => setPodiumLoading(false));
  }, [visible, badge?.id, badge?.tournament_id, badge?.cycle_id]);

  if (!visible || !badge) return null;

  const place = badge.place as 1 | 2 | 3 | 4 | 5;
  const palette = PLACE_PALETTE[place];
  const hasFishPhoto = !!badge.fish_photo_url && isValidImageUri(badge.fish_photo_url);
  const isShown = !!badge.shown_at;
  const currentUserId = user?.id;

  const handleShowHide = async () => {
    setActionLoading(true);
    try {
      if (isShown) await setTrophyHidden(badge.id);
      else await setTrophyShown(badge.id);
      onVisibilityChange?.();
      onClose();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete trophy',
      'Are you sure you want to delete this trophy? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const ok = await deleteTrophyBadge(badge.id);
              if (ok) {
                onClose();
                onDeleted?.();
              }
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.placeRow, { borderColor: palette.border }]}>
              <Text style={styles.trophyEmoji}>{palette.medal}</Text>
              <Text style={[styles.placeLabel, { color: palette.primary }]}>
                {getPlaceLabel(place)} Place
              </Text>
            </View>

            <Text style={styles.tournamentName} numberOfLines={2}>
              {badge.tournament_name ?? 'Tournament'}
            </Text>

            {/* Top 3 placements for this tournament */}
            <View style={styles.podiumSection}>
              <Text style={styles.podiumTitle}>Top 3 — this tournament</Text>
              {podiumLoading ? (
                <ActivityIndicator size="small" color={palette.primary} style={{ marginVertical: 8 }} />
              ) : (
                <View style={styles.podiumRow}>
                  {([1, 2, 3] as const).map((p) => {
                    const row = podium.find((r) => r.place === p);
                    const isYou = currentUserId && row?.user_id === currentUserId;
                    const pPalette = PLACE_PALETTE[p];
                    const hasImg = row?.fish_photo_url && isValidImageUri(row.fish_photo_url);
                    return (
                      <View key={p} style={[styles.podiumCell, { borderColor: pPalette.border }]}>
                        <Text style={[styles.podiumPlace, { color: pPalette.primary }]}>
                          {getPlaceLabel(p)}
                        </Text>
                        {hasImg && row ? (
                          <Image source={{ uri: row.fish_photo_url! }} style={styles.podiumThumb} resizeMode="cover" />
                        ) : (
                          <View style={[styles.podiumThumb, styles.podiumThumbPlaceholder]}>
                            <Text style={styles.podiumThumbEmoji}>🐟</Text>
                          </View>
                        )}
                        {isYou && <Text style={styles.podiumYou}>You</Text>}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={[styles.fishWrap, { borderColor: palette.border }]}>
              {hasFishPhoto ? (
                <Image source={{ uri: badge.fish_photo_url! }} style={styles.fishImg} resizeMode="cover" />
              ) : (
                <View style={[styles.fishImg, styles.fishPlaceholder]}>
                  <Text style={styles.fishPlaceholderEmoji}>🐟</Text>
                </View>
              )}
            </View>

            <View style={styles.rewardRow}>
              <View style={styles.xpChip}>
                <Ionicons name="trophy" size={14} color="#00e5c8" />
                <Text style={styles.xpChipTxt}>+{badge.xp_awarded} Trophies</Text>
              </View>
              <View style={styles.xpChip}>
                <Ionicons name="star" size={14} color="#00e5c8" />
                <Text style={styles.xpChipTxt}>+{badge.xp_awarded} XP</Text>
              </View>
            </View>
            <Text style={styles.badgeEarnedLabel}>Badge earned · {getPlaceLabel(place)} · {badge.tournament_name ?? 'Tournament'}</Text>

            <Text style={styles.dateText}>Won {formatDate(badge.created_at)}</Text>

            <View style={styles.howEarnedWrap}>
              <Text style={styles.howEarnedLabel}>How you earned this</Text>
              <Text style={styles.howEarnedText}>
                You placed {getPlaceLabel(place)} in {badge.tournament_name ?? 'the tournament'} and claimed this trophy.
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={handleShowHide}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                <Ionicons name={isShown ? 'eye-off' : 'eye'} size={16} color="#fff" />
                <Text style={styles.btnSecondaryTxt}>{isShown ? 'Hide from profile' : 'Show on profile'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnDanger}
                onPress={handleDelete}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.btnDangerTxt}>Delete</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeTxt}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: CARD_W,
    borderRadius: 20,
    backgroundColor: '#0d1624',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  trophyEmoji: { fontSize: 28 },
  placeLabel: { fontSize: 18, fontWeight: '800' },
  tournamentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  fishWrap: {
    width: '100%',
    height: CARD_W * 0.88,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  fishImg: { width: '100%', height: '100%' },
  fishPlaceholder: {
    backgroundColor: '#1a2a3a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fishPlaceholderEmoji: { fontSize: 40 },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  badgeEarnedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00e5c8',
    opacity: 0.95,
    marginBottom: 8,
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,229,200,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  xpChipTxt: { fontSize: 13, fontWeight: '700', color: '#00e5c8' },
  dateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  howEarnedWrap: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  howEarnedLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  howEarnedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 20,
  },
  podiumSection: {
    marginBottom: 12,
  },
  podiumTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  podiumRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  podiumCell: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  podiumPlace: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  podiumThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  podiumThumbPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumThumbEmoji: { fontSize: 20 },
  podiumYou: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00e5c8',
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnSecondaryTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  btnDanger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(220,53,69,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(220,53,69,0.5)',
  },
  btnDangerTxt: { fontSize: 13, fontWeight: '700', color: '#ff6b6b' },
  closeBtn: { alignItems: 'center', paddingVertical: 6 },
  closeTxt: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
});
