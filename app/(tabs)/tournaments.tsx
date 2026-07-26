/**
 * Compete — App Store published layout (clean, centered).
 * Header · Custom tournaments · chips · Log a catch · stats · podium · rest list
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
  Share,
  Platform,
} from 'react-native';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
import { useHomeTournaments } from '@/src/hooks/useHomeTournaments';
import { useLocationState } from '@/src/hooks/useLocationState';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import {
  fetchTournamentEntries,
  isUserEnteredInTournament,
  withdrawFromTournament,
  countUserTournamentEntries,
  voteOnEntry,
} from '@/src/api/tournaments';
import { useAuthContext } from '@/src/context/AuthContext';
import { usePresentPaywall } from '@/src/hooks/usePresentPaywall';
import { useGamificationContext } from '@/src/context/GamificationContext';
import type { FishEntry, MetricType } from '@/src/types/tournaments';
import { getEntryMetricValue, formatMetric, getMetricUnitShort } from '@/src/types/tournaments';
import { LeaderboardRow } from '@/src/components/home/LeaderboardRow';
import { TournamentEntryFlow } from '@/src/components/competitions/TournamentEntryFlow';
import { isDev } from '@/src/lib/env';
import { forceRestartTournament, getProfileDisplayItemsBatch } from '@/src/lib/supabase';
import { deleteTournamentEntryByEntryId } from '@/src/lib/tournamentDb';
import { useTournamentWinCheckContext } from '@/src/context/TournamentWinCheckContext';
import { ENABLE_MOCK_USERS, getMockTournamentEntries } from '@/utils/mockLeaderboardData';
import { getSnaggedRankTier, getTierColor } from '@/src/lib/snaggedRank';
import { useTournamentTimer, type TournamentTimerState } from '@/src/hooks/useTournamentTimer';
import { isValidImageUri } from '@/src/lib/imageUri';

const TEAL = colors.teal;

const FILTER_IDS: { id: string; label: string }[] = [
  { id: 'biggest-fish-this-week', label: 'Weekly Biggest' },
  { id: 'tournament-rarest', label: 'Weekly Rarest' },
  { id: 'tournament-bass', label: 'Bass' },
  { id: 'tournament-redfish', label: 'Redfish' },
  { id: 'tournament-snook', label: 'Snook' },
  { id: 'tournament-flounder', label: 'Flounder' },
  { id: 'tournament-striper', label: 'Striper' },
  { id: 'tournament-tarpon', label: 'Tarpon' },
  { id: 'tournament-bluegill', label: 'Bluegill' },
  { id: 'tournament-catfish', label: 'Catfish' },
  { id: 'tournament-freshwater-trout', label: 'Trout' },
  { id: 'tournament-smallest', label: 'Smallest' },
];

const FEATURED_IDS = FILTER_IDS.map((f) => f.id);

const PODIUM_REWARDS: Record<1 | 2 | 3, string> = {
  1: '+200',
  2: '+120',
  3: '+60',
};

const SELECTED_TOURNAMENT_KEY = '@Snagged/selectedTournamentId';

function formatRankBadge(label: string): string {
  return label.replace(/\bIII\b/, '3').replace(/\bII\b/, '2').replace(/\bI\b/, '1');
}

/** Store-style countdown: "18h 25m" or "2d 4h" */
function formatStoreCountdown(state: TournamentTimerState): string {
  if (state.ended) return 'Ended';
  if (state.days > 0) {
    return state.hours > 0 ? `${state.days}d ${state.hours}h` : `${state.days}d`;
  }
  return `${state.hours}h ${String(state.mins).padStart(2, '0')}m`;
}

function RestListRow({
  entry,
  rank,
  metricType,
  isYou,
  onPress,
}: {
  entry: FishEntry;
  rank: number;
  metricType: MetricType;
  isYou: boolean;
  onPress: () => void;
}) {
  const name = (entry.displayName ?? entry.username).trim() || entry.username;
  const value = getEntryMetricValue(entry, metricType);
  const display = formatMetric(value, metricType);
  const unit = getMetricUnitShort(metricType);
  const hasAvatar = isValidImageUri(entry.avatarUrl);

  return (
    <TouchableOpacity style={styles.restRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.restRank}>#{rank}</Text>
      {hasAvatar ? (
        <Image source={{ uri: entry.avatarUrl }} style={styles.restAvatar} />
      ) : (
        <View style={[styles.restAvatar, styles.restAvatarPh]}>
          <Text style={styles.restAvatarInit}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.restNameCol}>
        <Text style={styles.restName} numberOfLines={1}>
          {name}
          {isYou ? '  · YOU' : ''}
        </Text>
      </View>
      <Text style={styles.restMetric} numberOfLines={1}>
        {display} {unit}
      </Text>
    </TouchableOpacity>
  );
}

export default function TournamentsScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const gamification = useGamificationContext();
  const { presentPaywall } = usePresentPaywall();
  const { tournamentId: deepLinkId } = useLocalSearchParams<{ tournamentId?: string }>();
  const bottomPadding = useBottomSafePadding();
  const [scope] = useState<'global' | 'local'>('global');
  const { state: locationState } = useLocationState();
  const [featuredCompetitionId, setFeaturedCompetitionIdState] = useState(
    deepLinkId && FEATURED_IDS.includes(deepLinkId) ? deepLinkId : FEATURED_IDS[0]
  );
  const hasRestoredSelection = useRef(false);

  const setFeaturedCompetitionId = useCallback((id: string) => {
    setFeaturedCompetitionIdState(id);
    AsyncStorage.setItem(SELECTED_TOURNAMENT_KEY, id).catch(() => {});
  }, []);

  const [entries, setEntries] = useState<FishEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [restartingCycle, setRestartingCycle] = useState(false);
  const [showEntryFlow, setShowEntryFlow] = useState(false);
  const [isEntered, setIsEntered] = useState(false);
  const [voteLoadingEntryId, setVoteLoadingEntryId] = useState<string | null>(null);

  const stateForLocal = scope === 'local' ? (locationState ?? user?.state ?? undefined) : undefined;
  const { tournaments, handleRefresh, loading: tournamentsLoading } = useHomeTournaments(
    scope,
    user?.id,
    stateForLocal
  );
  const winCheck = useTournamentWinCheckContext();

  useEffect(() => {
    if (hasRestoredSelection.current) return;
    if (deepLinkId && FEATURED_IDS.includes(deepLinkId)) return;
    hasRestoredSelection.current = true;
    AsyncStorage.getItem(SELECTED_TOURNAMENT_KEY)
      .then((saved) => {
        if (saved && FEATURED_IDS.includes(saved)) setFeaturedCompetitionIdState(saved);
      })
      .catch(() => {});
  }, [deepLinkId]);

  useEffect(() => {
    if (tournaments.length === 0) return;
    const ids = new Set(tournaments.map((t) => t.id));
    if (ids.has(featuredCompetitionId)) return;
    const first = tournaments.find((t) => FEATURED_IDS.includes(t.id))?.id ?? FEATURED_IDS[0];
    setFeaturedCompetitionIdState(first);
  }, [tournaments, featuredCompetitionId]);

  useEffect(() => {
    if (deepLinkId && FEATURED_IDS.includes(deepLinkId)) setFeaturedCompetitionId(deepLinkId);
  }, [deepLinkId, setFeaturedCompetitionId]);

  const featuredTournament = tournaments.find((t) => t.id === featuredCompetitionId);
  const currentUserId = user?.id ?? null;
  const metricType: MetricType = featuredTournament?.metricType ?? 'WEIGHT_LBS';
  const timer = useTournamentTimer(featuredTournament?.endsAt);
  const timeRemaining = featuredTournament?.endsAt
    ? formatStoreCountdown(timer)
    : tournamentsLoading
      ? '…'
      : '—';

  const rankTier = useMemo(() => getSnaggedRankTier(gamification?.xp ?? 0), [gamification?.xp]);
  const rankBadgeLabel = formatRankBadge(rankTier.label);
  const rankBadgeColor = getTierColor(rankTier.tierName);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const { entries: list } = await fetchTournamentEntries(
        featuredCompetitionId,
        0,
        200,
        scope,
        stateForLocal,
        currentUserId
      );
      const authorIds = [...new Set(list.map((e) => e.userId))];
      const displayMap = await getProfileDisplayItemsBatch(authorIds);
      let enriched = list.map((e) => ({
        ...e,
        displayItems: displayMap[e.userId] ?? [],
      }));
      if (isDev && ENABLE_MOCK_USERS && featuredCompetitionId) {
        const mockMetric = metricType === 'LENGTH_IN' ? 'LENGTH_IN' : 'WEIGHT_LBS';
        enriched = [...enriched, ...getMockTournamentEntries(featuredCompetitionId, mockMetric)];
      }
      setEntries(enriched);
    } catch (e) {
      console.error('Query failed:', e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [featuredCompetitionId, scope, stateForLocal, currentUserId, metricType]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useFocusEffect(
    useCallback(() => {
      winCheck?.triggerCheck();
      if (tournaments.length === 0) handleRefresh();
    }, [winCheck, tournaments.length, handleRefresh])
  );

  useEffect(() => {
    if (!currentUserId) {
      setIsEntered(false);
      return;
    }
    isUserEnteredInTournament(featuredCompetitionId, currentUserId).then(setIsEntered);
  }, [featuredCompetitionId, currentUserId]);

  const onPullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([handleRefresh(), loadEntries()]);
    } finally {
      setPullRefreshing(false);
    }
  }, [handleRefresh, loadEntries]);

  const handleVoteGated = useCallback(
    async (entryId: string, vote: 'UP' | 'DOWN' | null) => {
      if (!currentUserId) {
        router.replace('/(tabs)/profile');
        return;
      }
      const entry = entries.find((e) => e.id === entryId);
      if (entry?.userId === currentUserId) return;
      setVoteLoadingEntryId(entryId);
      const prevEntries = [...entries];
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId) return e;
          const pv = e.userVote;
          let up = e.upVotes;
          let down = e.downVotes;
          if (pv === 'UP') up--;
          if (pv === 'DOWN') down--;
          if (vote === 'UP') up++;
          if (vote === 'DOWN') down++;
          return { ...e, upVotes: up, downVotes: down, userVote: vote };
        })
      );
      try {
        const result = await voteOnEntry(entryId, vote, currentUserId);
        if (result.removed) setEntries((p) => p.filter((e) => e.id !== entryId));
        else {
          setEntries((p) =>
            p.map((e) =>
              e.id === entryId
                ? { ...e, upVotes: result.upVotes, downVotes: result.downVotes, userVote: result.userVote }
                : e
            )
          );
        }
      } catch (err) {
        setEntries(prevEntries);
        Alert.alert('Vote failed', (err as Error).message ?? 'Please try again.');
      } finally {
        setVoteLoadingEntryId(null);
      }
    },
    [entries, currentUserId, router]
  );

  const handleLogACatch = useCallback(async () => {
    if (!currentUserId) {
      router.replace('/(tabs)/profile');
      return;
    }
    if (isEntered) {
      Alert.alert('Already entered', 'You already have a catch in this tournament. Delete it to enter a different one.');
      return;
    }
    const plan = user?.subscriptionPlan ?? 'free';
    if (plan === 'free') {
      const count = await countUserTournamentEntries(currentUserId);
      if (count >= 1) {
        Alert.alert(
          'One tournament at a time',
          'Free accounts can only enter one tournament. Delete your current entry to enter another, or upgrade to Pro for unlimited entries.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upgrade', onPress: () => presentPaywall() },
          ]
        );
        return;
      }
    }
    setShowEntryFlow(true);
  }, [currentUserId, isEntered, user?.subscriptionPlan, presentPaywall, router]);

  const handleEntryFlowDone = useCallback(async () => {
    setShowEntryFlow(false);
    setIsEntered(true);
    await loadEntries();
  }, [loadEntries]);

  const handleShare = useCallback(async () => {
    const title = featuredTournament?.title ?? 'Snagged tournament';
    try {
      await Share.share({
        message: `Compete in ${title} on Snagged — log your catch and climb the leaderboard!`,
        title: 'Share tournament',
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e?.message === 'User did not share' || e?.message?.toLowerCase?.().includes('cancel')) return;
      Alert.alert('Share failed', 'Could not share tournament.');
    }
  }, [featuredTournament?.title]);

  const handleDeleteOwnEntry = useCallback(() => {
    if (!currentUserId) return;
    Alert.alert(
      'Delete entry?',
      'This will remove your entry from this tournament. Your catch will remain in your logbook.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete entry',
          style: 'destructive',
          onPress: async () => {
            try {
              await withdrawFromTournament(featuredCompetitionId, currentUserId);
              setIsEntered(false);
              await loadEntries();
            } catch (e) {
              Alert.alert('Error', (e as Error).message);
            }
          },
        },
      ]
    );
  }, [featuredCompetitionId, currentUserId, loadEntries]);

  const handleRemoveEntry = useCallback(
    async (entryId: string) => {
      const entry = entries.find((e) => e.id === entryId);
      if (entry && currentUserId && entry.userId === currentUserId) {
        handleDeleteOwnEntry();
        return;
      }
      if (entryId.startsWith('mock-entry-')) {
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
        return;
      }
      try {
        await deleteTournamentEntryByEntryId(entryId);
        await loadEntries();
      } catch (e) {
        console.error('[Compete] remove entry failed:', e);
      }
    },
    [entries, currentUserId, handleDeleteOwnEntry, loadEntries]
  );

  const showRemoveEntry = isDev || user?.isModerator === true;
  const top3 = entries.slice(0, 3);
  const restEntries = entries.slice(3);
  const leadValue = top3[0] ? getEntryMetricValue(top3[0], metricType) : undefined;
  const leadDisplay = leadValue != null ? formatMetric(leadValue, metricType) : '—';
  const entrantsCount = featuredTournament?.entrantsCount ?? entries.length;

  const renderPodium = (rank: 1 | 2 | 3, entry: FishEntry | undefined, slotStyle: object) => {
    const isYou = !!(entry && currentUserId && entry.userId === currentUserId);
    const canTrash = !!(entry && (isYou || showRemoveEntry));
    return (
      <View key={`podium-${rank}`} style={[styles.podiumSlot, slotStyle]}>
        <View style={styles.rewardPill}>
          <Ionicons name="trophy" size={11} color={colors.gold} />
          <Text style={styles.rewardText}>{PODIUM_REWARDS[rank]}</Text>
        </View>
        {entry ? (
          <LeaderboardRow
            entry={entry}
            rank={rank}
            metricType={metricType}
            onVote={handleVoteGated}
            voteLoading={voteLoadingEntryId}
            variant="hero"
            isYou={isYou}
            onRemoveEntry={canTrash ? handleRemoveEntry : undefined}
          />
        ) : (
          <View style={[styles.podiumEmpty, rank === 1 ? styles.podiumEmptyFirst : styles.podiumEmptySide]}>
            <Text style={styles.podiumEmptyText}>Open</Text>
            <Text style={styles.podiumEmptyRank}>{rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={pullRefreshing} onRefresh={onPullRefresh} tintColor={TEAL} />
        }
      >
        {/* Header — Snagged | BRONZE badge */}
        <View style={styles.header}>
          <SnaggedWordmark />
          <View style={[styles.rankBadge, { borderColor: `${rankBadgeColor}99` }]}>
            <Ionicons name="shield" size={14} color={rankBadgeColor} />
            <Text style={[styles.rankBadgeText, { color: rankBadgeColor }]}>{rankBadgeLabel}</Text>
          </View>
        </View>

        {/* Custom tournaments */}
        <TouchableOpacity
          style={styles.customBtn}
          activeOpacity={0.85}
          onPress={() =>
            Alert.alert('Custom tournaments', 'Create and join private tournaments with friends — coming soon.')
          }
        >
          <Ionicons name="people-outline" size={18} color={TEAL} />
          <Text style={styles.customBtnText}>Custom tournaments</Text>
          <Ionicons name="chevron-forward" size={16} color={TEAL} />
        </TouchableOpacity>

        {/* Chips — centered scroll feel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          {FILTER_IDS.map((f) => {
            const active = featuredCompetitionId === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFeaturedCompetitionId(f.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Log a catch + share — centered */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.logBtn}
            activeOpacity={0.88}
            onPress={handleLogACatch}
            disabled={isEntered}
          >
            <LinearGradient
              colors={isEntered ? ['#1a5c44', '#174d39'] : ['#12d18a', '#00b37a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logBtnGrad}
            >
              {isEntered ? (
                <Feather name="check" size={18} color="#00e5c8" />
              ) : (
                <Feather name="plus" size={18} color="#fff" />
              )}
              <Text style={[styles.logBtnText, isEntered && { color: '#00e5c8' }]}>
                {isEntered ? 'Entered' : 'Log a catch'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="paper-plane-outline" size={20} color={TEAL} />
          </TouchableOpacity>
        </View>

        {/* Stats — TOTAL ENTRANTS | TIME REMAINING, Lead centered */}
        <View style={styles.statsBlock}>
          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>TOTAL ENTRANTS</Text>
              <Text style={styles.statValue}>
                {entrantsCount} {entrantsCount === 1 ? 'entrant' : 'entrants'}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>TIME REMAINING</Text>
              <Text style={styles.statValue}>{timeRemaining}</Text>
            </View>
          </View>
          <Text style={styles.leadLine}>
            Lead: <Text style={styles.leadStrong}>{leadDisplay}</Text>
          </Text>
        </View>

        {isDev && featuredCompetitionId === 'biggest-fish-this-week' && (
          <TouchableOpacity
            style={styles.devBtn}
            onPress={async () => {
              setRestartingCycle(true);
              try {
                const res = await forceRestartTournament('biggest_fish', 10, 20);
                if (res.ok) {
                  await handleRefresh();
                  loadEntries();
                } else Alert.alert('Dev', res.error ?? 'Failed');
              } finally {
                setRestartingCycle(false);
              }
            }}
            disabled={restartingCycle}
          >
            <Text style={styles.devBtnText}>{restartingCycle ? '…' : 'Start 20 sec test cycle (dev)'}</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={TEAL} />
          </View>
        ) : entries.length === 0 ? (
          <Text style={styles.empty}>Be the first to enter</Text>
        ) : (
          <>
            {/* Podium — 2nd | 1st | 3rd, centered, 1st taller */}
            <View style={styles.podiumRow}>
              {renderPodium(2, top3[1], styles.podiumSide)}
              {renderPodium(1, top3[0], styles.podiumFirst)}
              {renderPodium(3, top3[2], styles.podiumSide)}
            </View>

            {/* Rest of leaderboard — list */}
            <View style={styles.restSection}>
              <Text style={styles.winningsLine}>
                Winnings <Text style={styles.winningsStrong}>4th +30</Text>
                {'  |  '}
                <Text style={styles.winningsStrong}>5th +15</Text>
                {'  |  '}
                <Text style={styles.winningsStrong}>6th-10th +10</Text>
              </Text>
              {restEntries.length === 0 ? (
                <Text style={styles.restEmpty}>No other entrants yet</Text>
              ) : (
                restEntries.map((entry, i) => {
                  const rank = 4 + i;
                  const isYou = !!(currentUserId && entry.userId === currentUserId);
                  return (
                    <RestListRow
                      key={entry.id}
                      entry={entry}
                      rank={rank}
                      metricType={metricType}
                      isYou={isYou}
                      onPress={() => router.push(`/user/${entry.userId}`)}
                    />
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      <TournamentEntryFlow
        visible={showEntryFlow}
        onDismiss={() => setShowEntryFlow(false)}
        tournamentId={featuredCompetitionId}
        tournamentTitle={featuredTournament?.title ?? 'Tournament'}
        metricType={metricType === 'WEIGHT_LBS' ? 'WEIGHT_LBS' : 'LENGTH_IN'}
        onEntered={handleEntryFlowDone}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(7,30,48,0.95)',
  },
  rankBadgeText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,229,200,0.45)',
    backgroundColor: 'rgba(0,229,200,0.06)',
    marginBottom: 14,
  },
  customBtnText: {
    flex: 1,
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
    color: TEAL,
    textAlign: 'center',
  },
  chipScroll: {
    marginBottom: 16,
    marginHorizontal: -16,
  },
  chipRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0,229,200,0.35)',
    backgroundColor: 'rgba(7,30,48,0.8)',
  },
  chipActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  chipText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 13,
    color: TEAL,
  },
  chipTextActive: {
    color: colors.abyss,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  logBtn: {
    flex: 1,
    maxWidth: 280,
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#12d18a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  logBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 22,
  },
  logBtnText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  shareBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,229,200,0.45)',
    backgroundColor: 'rgba(0,229,200,0.08)',
  },
  statsBlock: {
    alignItems: 'center',
    marginBottom: 18,
    paddingVertical: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(0,229,200,0.18)',
    marginVertical: 2,
  },
  statLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 9,
    letterSpacing: 1.2,
    color: 'rgba(214,238,248,0.55)',
    marginBottom: 6,
    textAlign: 'center',
  },
  statValue: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 16,
    color: TEAL,
    textAlign: 'center',
  },
  leadLine: {
    marginTop: 12,
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    color: 'rgba(214,238,248,0.75)',
    textAlign: 'center',
  },
  leadStrong: {
    fontFamily: 'Sora_600SemiBold',
    color: '#fff',
    fontWeight: '700',
  },
  devBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,184,0,0.22)',
    marginBottom: 12,
  },
  devBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b8860b',
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  empty: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: 36,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  podiumSlot: {
    minWidth: 0,
  },
  podiumSide: {
    flex: 1.15,
  },
  podiumFirst: {
    flex: 1.45,
  },
  rewardPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,200,69,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,69,0.35)',
  },
  rewardText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 11,
    color: colors.gold,
  },
  podiumEmpty: {
    backgroundColor: 'rgba(7,30,48,0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  podiumEmptyFirst: {
    aspectRatio: 9 / 16,
  },
  podiumEmptySide: {
    aspectRatio: 9 / 15,
  },
  podiumEmptyText: {
    fontSize: 12,
    color: colors.textFaint,
    fontWeight: '600',
  },
  podiumEmptyRank: {
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 4,
    opacity: 0.7,
  },
  restSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.12)',
    backgroundColor: 'rgba(7,30,48,0.55)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  winningsLine: {
    textAlign: 'center',
    fontFamily: 'Sora_400Regular',
    fontSize: 12,
    color: 'rgba(214,238,248,0.55)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,229,200,0.1)',
  },
  winningsStrong: {
    fontFamily: 'Sora_600SemiBold',
    color: TEAL,
  },
  restEmpty: {
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: 13,
    paddingVertical: 18,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,229,200,0.08)',
    gap: 10,
  },
  restRank: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 13,
    color: colors.textDim,
    width: 32,
  },
  restAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  restAvatarPh: {
    backgroundColor: colors.cardHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restAvatarInit: {
    color: TEAL,
    fontWeight: '700',
    fontSize: 14,
  },
  restNameCol: {
    flex: 1,
    minWidth: 0,
  },
  restName: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
    color: colors.text,
  },
  restMetric: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 13,
    color: TEAL,
  },
});
