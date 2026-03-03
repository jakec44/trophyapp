/**
 * TournamentEntryFlow — two-step bottom-sheet for entering a tournament from the Compete page.
 *
 * Step 1 — Logbook picker: shows user's logged catches; user taps one to continue.
 * Step 2 — Confirmation: shows fish photo + stats + disclaimer; user taps
 *            "Edit Fish Stats" (go to logbook) or "Post to Tournament" (enter).
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  Image,
  Platform,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
import type { UserFish, MetricType } from '@/src/types/tournaments';
import { enterTournament } from '@/src/api/tournaments';
import { useAuthContext } from '@/src/context/AuthContext';
import { mockUserProfile } from '@/utils/mockData';
import { getUserCatches } from '@/src/lib/supabase';
import { getProLimitType } from '@/src/lib/errorMessages';
import { getPendingActions } from '@/src/lib/pendingActions';

const { width: SW, height: SH } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(SH * 0.88, SH - 80);
const TEAL = colors.teal;
const GOLD = colors.gold;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMetricShort(fish: UserFish, metricType: MetricType): string {
  if (metricType === 'WEIGHT_LBS') {
    return fish.weightLbs ? `${fish.weightLbs} lbs` : fish.lengthIn ? `${fish.lengthIn} in` : '—';
  }
  return fish.lengthIn ? `${fish.lengthIn} in` : fish.weightLbs ? `${fish.weightLbs} lbs` : '—';
}

function isValidUri(uri?: string): boolean {
  return !!uri && (uri.startsWith('http') || uri.startsWith('file') || uri.startsWith('/'));
}

// ─── FishCard — single item in the logbook picker ────────────────────────────

function FishCard({
  fish,
  metricType,
  onSelect,
}: {
  fish: UserFish;
  metricType: MetricType;
  onSelect: (f: UserFish) => void;
}) {
  const hasPhoto = isValidUri(fish.imageUrl);
  const metric = formatMetricShort(fish, metricType);
  const caught = new Date(fish.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <TouchableOpacity style={styles.fishCard} onPress={() => onSelect(fish)} activeOpacity={0.78}>
      {/* Fish photo / placeholder */}
      <View style={styles.fishThumb}>
        {hasPhoto ? (
          <Image source={{ uri: fish.imageUrl }} style={styles.fishThumbImg} resizeMode="cover" />
        ) : (
          <View style={styles.fishThumbPlaceholder}>
            <Ionicons name="fish-outline" size={28} color={colors.lightSubtext} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.fishInfo}>
        <Text style={styles.fishSpecies} numberOfLines={1}>
          {fish.species ?? 'Unknown'}
        </Text>
        <View style={styles.fishStatRow}>
          <View style={styles.fishStatPill}>
            <Text style={styles.fishStatTxt}>{metric}</Text>
          </View>
          <Text style={styles.fishDate}>{caught}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.lightSubtext} />
    </TouchableOpacity>
  );
}

// ─── ConfirmStep ─────────────────────────────────────────────────────────────

function ConfirmStep({
  fish,
  tournamentTitle,
  metricType,
  onBack,
  onPost,
  isPosting,
  onEditStats,
}: {
  fish: UserFish;
  tournamentTitle: string;
  metricType: MetricType;
  onBack: () => void;
  onPost: () => void;
  isPosting: boolean;
  onEditStats: () => void;
}) {
  const hasPhoto = isValidUri(fish.imageUrl);
  const metric = formatMetricShort(fish, metricType);

  return (
    <View>
      {/* Snagged + title row — tap Snagged to go back */}
      <View style={styles.confirmHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.confirmSnaggedWrap}>
          <Text style={styles.confirmSnagged}>Snagged</Text>
        </TouchableOpacity>
        <Text style={styles.confirmTitle}>Confirm Entry</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Fish photo */}
      <View style={styles.photoWrap}>
        {hasPhoto ? (
          <Image source={{ uri: fish.imageUrl }} style={styles.photo} resizeMode="contain" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Ionicons name="fish-outline" size={64} color={colors.lightBorder} />
          </View>
        )}
        {/* Metric badge overlay */}
        <View style={styles.metricBadge}>
          <Text style={styles.metricBadgeTxt}>{metric}</Text>
        </View>
      </View>

      {/* Fish info */}
      <View style={styles.confirmInfo}>
        <Text style={styles.confirmSpecies}>{fish.species ?? 'Unknown'}</Text>
        <Text style={styles.confirmTournament}>→ {tournamentTitle}</Text>
      </View>

      {/* Stats row — always show length (in) and weight */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{fish.lengthIn != null ? `${fish.lengthIn}"` : '—'}</Text>
          <Text style={styles.statLbl}>Length (in)</Text>
        </View>
        {fish.weightLbs ? (
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{fish.weightLbs} lbs</Text>
            <Text style={styles.statLbl}>Weight</Text>
          </View>
        ) : null}
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimerBox}>
        <Ionicons name="warning-outline" size={18} color={GOLD} style={{ flexShrink: 0 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.disclaimerTitle}>Make sure the stats are correct</Text>
          <Text style={styles.disclaimerBody}>
            False claims will be reviewed and may result in entry removal or a suspension from tournaments.
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      <TouchableOpacity style={styles.editBtn} onPress={onEditStats} activeOpacity={0.8}>
        <Feather name="edit-2" size={16} color={TEAL} />
        <Text style={styles.editBtnTxt}>Edit Fish Stats</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.postBtn}
        onPress={onPost}
        activeOpacity={0.85}
        disabled={isPosting}
      >
        <LinearGradient
          colors={[TEAL, '#00c8b0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.postBtnGrad}
        >
          {isPosting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons name="trophy" size={18} color="#000" />
          )}
          <Text style={styles.postBtnTxt}>
            {isPosting ? 'Entering…' : 'Post to Tournament'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface TournamentEntryFlowProps {
  visible: boolean;
  onDismiss: () => void;
  tournamentId: string;
  tournamentTitle: string;
  metricType: MetricType;
  /** Called after successful entry so parent can reload entries */
  onEntered: () => void;
}

type Step = 'pick' | 'confirm';

/** Map a DB catch row to UserFish */
function mapToUserFish(row: {
  id: string;
  species?: string | null;
  weight_lb?: number | null;
  length_in?: number | null;
  photo_url?: string | null;
  taken_at?: string | null;
  [key: string]: unknown;
}): UserFish {
  return {
    id: row.id,
    imageUrl: (row.photo_url as string) ?? '',
    species: row.species ?? undefined,
    weightLbs: row.weight_lb ?? undefined,
    lengthIn: row.length_in ?? undefined,
    createdAt: (row.taken_at as string) ?? new Date().toISOString(),
  };
}

export function TournamentEntryFlow({
  visible,
  onDismiss,
  tournamentId,
  tournamentTitle,
  metricType,
  onEntered,
}: TournamentEntryFlowProps) {
  const router = useRouter();
  const { user } = useAuthContext();
  const [step, setStep] = useState<Step>('pick');
  const [selected, setSelected] = useState<UserFish | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postedOk, setPostedOk] = useState(false);

  // Real logbook data fetched fresh each time the modal opens
  const [catches, setCatches] = useState<UserFish[]>([]);
  const [loadingCatches, setLoadingCatches] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoadingCatches(true);
    (async () => {
      try {
        const fish: UserFish[] = [];

        if (user?.id) {
          // Signed-in: fetch from Supabase
          const { data } = await getUserCatches(user.id, 200, 0);
          for (const row of data ?? []) {
            fish.push(mapToUserFish(row as Parameters<typeof mapToUserFish>[0]));
          }
        }

        // Always include pending (offline) catches
        const pending = await getPendingActions();
        for (const a of pending) {
          if (a.type !== 'CREATE_CATCH') continue;
          const p = (a as { type: 'CREATE_CATCH'; id: string; payload: { species: string; weight_lb: number; length_in?: number; photoUri?: string; taken_at: string } }).payload;
          fish.push({
            id: a.id,
            imageUrl: p.photoUri ?? '',
            species: p.species,
            weightLbs: p.weight_lb,
            lengthIn: p.length_in,
            createdAt: p.taken_at,
          });
        }

        if (!cancelled) setCatches(fish);
      } catch {
        if (!cancelled) setCatches([]);
      } finally {
        if (!cancelled) setLoadingCatches(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, user?.id]);

  const handleSelect = useCallback((fish: UserFish) => {
    setSelected(fish);
    setStep('confirm');
  }, []);

  const handleBack = useCallback(() => {
    setStep('pick');
    setSelected(null);
  }, []);

  const handleClose = useCallback(() => {
    setStep('pick');
    setSelected(null);
    setPostedOk(false);
    onDismiss();
  }, [onDismiss]);

  const handleEditStats = useCallback(() => {
    handleClose();
    router.push('/(tabs)/logbook');
  }, [handleClose, router]);

  const handlePost = useCallback(async () => {
    if (!selected) return;

    const userId = user?.id ?? (mockUserProfile as any).id ?? 'current-user';
    const username = user?.username ?? user?.displayName ?? (mockUserProfile as any).username ?? 'Angler';
    const avatarUrl = user?.avatarUrl ?? undefined;

    setIsPosting(true);
    try {
      const userState = (mockUserProfile as { state?: string }).state;
      await enterTournament(tournamentId, userId, username, selected, avatarUrl, {
        logbookCatchId: selected.id,
        userState,
      });
      setPostedOk(true);
      onEntered();
      // Brief pause so user sees success, then close
      setTimeout(handleClose, 1200);
    } catch (e) {
      if (getProLimitType(e) === 'tournament') {
        Alert.alert(
          'Pro unlocks unlimited tournament entries',
          'Upgrade to Pro to enter multiple tournaments.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upgrade', onPress: () => router.push('/coin-shop') },
          ]
        );
      }
    } finally {
      setIsPosting(false);
    }
  }, [selected, user, tournamentId, onEntered, handleClose, router]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          {/* ── Success overlay ───────────────────────────────── */}
          {postedOk && (
            <View style={styles.successWrap}>
              <View style={styles.successCircle}>
                <Ionicons name="trophy" size={36} color={GOLD} />
              </View>
              <Text style={styles.successTitle}>You're in!</Text>
              <Text style={styles.successSub}>Entered in {tournamentTitle}</Text>
            </View>
          )}

          {/* ── Step 1: Logbook Picker ───────────────────────── */}
          {!postedOk && step === 'pick' && (
            <View style={{ flex: 1 }}>
              <View style={styles.pickHeader}>
                <Text style={styles.pickTitle}>Choose a catch to enter</Text>
                <Text style={styles.pickSub}>{tournamentTitle}</Text>
              </View>

              {loadingCatches ? (
                <View style={styles.emptyWrap}>
                  <ActivityIndicator size="large" color={TEAL} />
                  <Text style={styles.emptyBody}>Loading your catches…</Text>
                </View>
              ) : catches.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="fish-outline" size={48} color={colors.lightBorder} />
                  <Text style={styles.emptyTitle}>No catches yet</Text>
                  <Text style={styles.emptyBody}>Log a catch first, then come back to enter.</Text>
                  <TouchableOpacity
                    style={styles.logBtn}
                    onPress={() => { handleClose(); router.push('/(tabs)/log'); }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.logBtnTxt}>Go Log a Catch</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={catches}
                  keyExtractor={(f) => f.id}
                  renderItem={({ item }) => (
                    <FishCard fish={item} metricType={metricType} onSelect={handleSelect} />
                  )}
                  contentContainerStyle={{ paddingBottom: 24 }}
                  showsVerticalScrollIndicator={false}
                  ItemSeparatorComponent={() => <View style={styles.divider} />}
                />
              )}
            </View>
          )}

          {/* ── Step 2: Confirmation ─────────────────────────── */}
          {!postedOk && step === 'confirm' && selected && (
            <ConfirmStep
              fish={selected}
              tournamentTitle={tournamentTitle}
              metricType={metricType}
              onBack={handleBack}
              onPost={handlePost}
              isPosting={isPosting}
              onEditStats={handleEditStats}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.lightCard,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    height: SHEET_HEIGHT,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lightBorder,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },

  // ── Pick step
  pickHeader: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
    marginBottom: 4,
  },
  pickTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.lightText,
  },
  pickSub: {
    fontSize: 13,
    color: TEAL,
    fontWeight: '600',
    marginTop: 3,
  },
  fishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  fishThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: colors.lightBackground,
  },
  fishThumbImg: { width: '100%', height: '100%' },
  fishThumbPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.lightBackground,
  },
  fishInfo: { flex: 1, minWidth: 0 },
  fishSpecies: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.lightText,
    marginBottom: 5,
  },
  fishStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fishStatPill: {
    backgroundColor: TEAL + '20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fishStatTxt: { fontSize: 12, fontWeight: '700', color: TEAL },
  fishDate: { fontSize: 12, color: colors.lightSubtext },
  divider: { height: 1, backgroundColor: colors.lightBorder },

  // ── Confirm step
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 8,
  },
  confirmSnaggedWrap: { padding: 4 },
  confirmSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.lightText,
  },
  photoWrap: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 14,
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.lightBackground },
  metricBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: TEAL + '60',
  },
  metricBadgeTxt: { fontSize: 14, fontWeight: '800', color: TEAL },
  confirmInfo: { marginBottom: 10 },
  confirmSpecies: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.lightText,
  },
  confirmTournament: {
    fontSize: 13,
    fontWeight: '600',
    color: TEAL,
    marginTop: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.lightBackground,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  statVal: { fontSize: 18, fontWeight: '800', color: colors.lightText },
  statLbl: { fontSize: 11, color: colors.lightSubtext, marginTop: 2, fontWeight: '500' },

  // Disclaimer
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: GOLD + '12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GOLD + '40',
    padding: 14,
    marginBottom: 16,
  },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
    marginBottom: 4,
  },
  disclaimerBody: {
    fontSize: 12,
    color: colors.lightSubtext,
    lineHeight: 17,
  },

  // Edit button
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: TEAL,
    marginBottom: 10,
  },
  editBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: TEAL,
  },

  // Post button
  postBtn: {
    borderRadius: 13,
    overflow: 'hidden',
    marginBottom: 4,
  },
  postBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  postBtnTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.lightText,
  },
  emptyBody: {
    fontSize: 13,
    color: colors.lightSubtext,
    textAlign: 'center',
  },
  logBtn: {
    marginTop: 10,
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  logBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },

  // Success
  successWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GOLD + '25',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: GOLD + '60',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.lightText,
  },
  successSub: {
    fontSize: 14,
    color: TEAL,
    fontWeight: '600',
  },
});
