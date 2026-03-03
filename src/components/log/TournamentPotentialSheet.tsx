/**
 * TournamentPotentialSheet — post-log tournament eligibility bottom sheet.
 * Clicking "Enter now" immediately enters the logged catch into that tournament
 * without leaving the screen — no navigation required.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { TournamentEligibility } from '@/src/api/tournaments';
import { enterTournament } from '@/src/api/tournaments';
import { getProLimitType } from '@/src/lib/errorMessages';
import { useAuthContext } from '@/src/context/AuthContext';
import { mockUserProfile } from '@/utils/mockData';
import type { UserFish } from '@/src/types/tournaments';

const GOLD = colors.gold;
const TEAL = colors.teal;

function formatTimeRemaining(endsAt?: string): string {
  if (!endsAt) return '';
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days >= 1) return `Ends in ${days} day${days > 1 ? 's' : ''}`;
  if (hours >= 1) return `Ends in ${hours} hour${hours > 1 ? 's' : ''}`;
  return 'Ends soon';
}

export interface TournamentPotentialSheetProps {
  visible: boolean;
  onDismiss: () => void;
  eligibilities: TournamentEligibility[];
  catchId?: string;
  imageUrl?: string;
  species: string;
  weightLbs?: number;
  lengthIn?: number;
}

export function TournamentPotentialSheet({
  visible,
  onDismiss,
  eligibilities,
  catchId,
  imageUrl,
  species,
  weightLbs,
  lengthIn,
}: TournamentPotentialSheetProps) {
  const router = useRouter();
  const { user } = useAuthContext();

  // Per-tournament entered & entering state
  const [enteredIds, setEnteredIds] = useState<Set<string>>(new Set());
  const [enteringId, setEnteringId] = useState<string | null>(null);

  const handleEnterNow = useCallback(async (e: TournamentEligibility) => {
    if (enteredIds.has(e.tournamentId) || enteringId === e.tournamentId) return;

    const userId = user?.id ?? (mockUserProfile as any).id ?? 'current-user';
    const username = user?.username ?? user?.displayName ?? (mockUserProfile as any).username ?? 'Angler';
    const avatarUrl = user?.avatarUrl ?? undefined;

    const fish: UserFish = {
      id: catchId ?? `new-catch-${Date.now()}`,
      imageUrl: imageUrl ?? '',
      species,
      weightLbs,
      lengthIn,
      createdAt: new Date().toISOString(),
    };

    setEnteringId(e.tournamentId);
    try {
      await enterTournament(e.tournamentId, userId, username, fish, avatarUrl);
      setEnteredIds((prev) => new Set([...prev, e.tournamentId]));
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
      setEnteringId(null);
    }
  }, [router, enteredIds, enteringId, user, catchId, imageUrl, species, weightLbs, lengthIn]);

  if (eligibilities.length === 0) return null;

  const allEntered = eligibilities.every((e) => enteredIds.has(e.tournamentId));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Tournament potential 👀</Text>
              <Text style={styles.subtitle}>
                {allEntered
                  ? 'You\'re entered — good luck! 🎣'
                  : 'This catch could place — enter now'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
              <Ionicons name="close" size={22} color={colors.lightSubtext} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {eligibilities.map((e) => {
              const isEntered = enteredIds.has(e.tournamentId);
              const isEntering = enteringId === e.tournamentId;

              return (
                <View key={e.tournamentId} style={[styles.card, isEntered && styles.cardEntered]}>
                  {/* Rank badge */}
                  <View style={styles.cardTop}>
                    <View style={[styles.rankBadge, e.isTop3 && styles.rankBadgeTop3]}>
                      {e.isTop3 && <Ionicons name="trophy" size={13} color={GOLD} />}
                      <Text style={[styles.rankBadgeTxt, e.isTop3 && styles.rankBadgeTxtTop3]}>
                        {e.isTop3 ? 'Top 3 potential!' : e.isTop10 ? '🔥 Top 10 shot' : `#${e.estimatedRank} potential`}
                      </Text>
                    </View>
                    {e.endsAt && (
                      <Text style={styles.timeText}>{formatTimeRemaining(e.endsAt)}</Text>
                    )}
                  </View>

                  <Text style={styles.tournamentName}>{e.tournamentTitle}</Text>
                  <Text style={styles.rankText}>
                    Would place <Text style={styles.rankNum}>#{e.estimatedRank}</Text> of {e.totalEntrants} entries
                  </Text>

                  {/* Enter / Entered button */}
                  {isEntered ? (
                    <View style={styles.enteredBadge}>
                      <Ionicons name="checkmark-circle" size={18} color={TEAL} />
                      <Text style={styles.enteredTxt}>Entered — you're in!</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.enterBtn}
                      onPress={() => handleEnterNow(e)}
                      activeOpacity={0.82}
                      disabled={!!enteringId}
                    >
                      {isEntering ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="trophy-outline" size={17} color="#fff" />
                      )}
                      <Text style={styles.enterBtnTxt}>
                        {isEntering ? 'Entering…' : 'Enter now'}
                      </Text>
                      {!isEntering && (
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.notNowBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.notNowTxt}>
              {allEntered ? 'Done' : 'Not now'}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.lightCard,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '82%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lightBorder,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.lightText,
  },
  subtitle: {
    fontSize: 13,
    color: colors.lightSubtext,
    marginTop: 3,
    fontWeight: '500',
  },
  closeBtn: { padding: 6 },
  card: {
    backgroundColor: colors.lightBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  cardEntered: {
    borderColor: TEAL + '50',
    backgroundColor: TEAL + '08',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  rankBadgeTop3: {
    backgroundColor: GOLD + '18',
    borderColor: GOLD + '50',
  },
  rankBadgeTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.lightSubtext,
  },
  rankBadgeTxtTop3: {
    color: GOLD,
  },
  timeText: {
    fontSize: 12,
    color: colors.accentBlue,
    fontWeight: '600',
  },
  tournamentName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 4,
  },
  rankText: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginBottom: 14,
  },
  rankNum: {
    fontWeight: '800',
    color: colors.lightText,
  },
  enterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TEAL,
    paddingVertical: 13,
    borderRadius: 13,
  },
  enterBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  enteredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 13,
    backgroundColor: TEAL + '15',
    borderWidth: 1,
    borderColor: TEAL + '40',
  },
  enteredTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: TEAL,
  },
  notNowBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  notNowTxt: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
});
