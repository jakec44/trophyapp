/**
 * Trophy detail modal (trophies table): tournament name, place, fish photo, podium (top 3 usernames + weights/lengths).
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
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TrophyWithDetails, PodiumEntry } from '@/src/lib/supabase';
import { getPodiumForTrophy } from '@/src/lib/supabase';
import { PLACE_PALETTE, getPlaceLabel } from '@/src/types/tournamentResults';
import { isValidImageUri } from '@/src/lib/imageUri';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW - 48;

interface TrophyDetailModalProps {
  visible: boolean;
  trophy: TrophyWithDetails | null;
  onClose: () => void;
}

function formatMetric(entry: PodiumEntry): string {
  if (entry.weight_lb != null) return `${Number(entry.weight_lb)} lbs`;
  if (entry.length_in != null) return `${Number(entry.length_in)} in`;
  return '—';
}

export function TrophyDetailModal({ visible, trophy, onClose }: TrophyDetailModalProps) {
  const [podium, setPodium] = useState<PodiumEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !trophy) return;
    setPodium([]);
    setLoading(true);
    getPodiumForTrophy(trophy.id)
      .then(setPodium)
      .finally(() => setLoading(false));
  }, [visible, trophy?.id]);

  if (!visible || !trophy) return null;

  const place = trophy.place;
  const palette = PLACE_PALETTE[place];
  const hasFishPhoto = !!trophy.entry_image_url && isValidImageUri(trophy.entry_image_url);

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
              {trophy.tournament_name ?? 'Tournament'}
            </Text>

            <View style={[styles.fishWrap, { borderColor: palette.border }]}>
              {hasFishPhoto ? (
                <Image source={{ uri: trophy.entry_image_url! }} style={styles.fishImg} resizeMode="cover" />
              ) : (
                <View style={[styles.fishImg, styles.fishPlaceholder]}>
                  <Text style={styles.fishPlaceholderEmoji}>🐟</Text>
                </View>
              )}
            </View>

            <View style={styles.podiumSection}>
              <Text style={styles.podiumTitle}>Top 3 — this tournament</Text>
              {loading ? (
                <ActivityIndicator size="small" color={palette.primary} style={{ marginVertical: 8 }} />
              ) : (
                <View style={styles.podiumList}>
                  {podium.map((entry) => {
                    const pPalette = PLACE_PALETTE[entry.place];
                    return (
                      <View key={entry.place} style={[styles.podiumRow, { borderColor: pPalette.border }]}>
                        <Text style={[styles.podiumPlace, { color: pPalette.primary }]}>
                          {getPlaceLabel(entry.place)}
                        </Text>
                        <Text style={styles.podiumUsername} numberOfLines={1}>{entry.username}</Text>
                        <Text style={styles.podiumMetric}>{formatMetric(entry)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
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
    height: CARD_W * 0.5,
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
  podiumSection: { marginBottom: 12 },
  podiumTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  podiumList: { gap: 8 },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 6,
  },
  podiumPlace: { fontSize: 12, fontWeight: '800', width: 28 },
  podiumUsername: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  podiumMetric: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  closeBtn: { alignItems: 'center', paddingVertical: 6 },
  closeTxt: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
});

/** View-only trophy modal for other users' profiles when we only have display item data (no podium / View Tournament). */
export interface TrophyViewOnlyPayload {
  tournamentName: string;
  place: 1 | 2 | 3 | 4 | 5;
  imageUrl?: string;
}

export function TrophyViewOnlyModal({
  visible,
  payload,
  onClose,
}: {
  visible: boolean;
  payload: TrophyViewOnlyPayload | null;
  onClose: () => void;
}) {
  if (!visible || !payload) return null;
  const place = payload.place;
  const palette = PLACE_PALETTE[place];
  const hasFishPhoto = !!payload.imageUrl && isValidImageUri(payload.imageUrl);

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
              {payload.tournamentName || 'Tournament'}
            </Text>
            <View style={[styles.fishWrap, { borderColor: palette.border }]}>
              {hasFishPhoto ? (
                <Image source={{ uri: payload.imageUrl! }} style={styles.fishImg} resizeMode="cover" />
              ) : (
                <View style={[styles.fishImg, styles.fishPlaceholder]}>
                  <Text style={styles.fishPlaceholderEmoji}>🐟</Text>
                </View>
              )}
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
