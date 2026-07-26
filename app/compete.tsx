import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  Dimensions,
  Platform,
  Alert,
  RefreshControl,
  Share,
} from 'react-native';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
import { CARD_RADIUS } from '@/src/constants/styles';
import { useHomeTournaments } from '@/src/hooks/useHomeTournaments';
import { useLocationState } from '@/src/hooks/useLocationState';
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
import type { FishEntry } from '@/src/types/tournaments';
import { getEntryMetricValue, formatMetric } from '@/src/types/tournaments';
import { LeaderboardRow } from '@/src/components/home/LeaderboardRow';
import { GlobalLocalToggle } from '@/src/components/competitions/GlobalLocalToggle';
import { TournamentEntryFlow } from '@/src/components/competitions/TournamentEntryFlow';
import { isDev } from '@/src/lib/env';
import { forceRestartTournament, getProfileDisplayItemsBatch } from '@/src/lib/supabase';
import { deleteTournamentEntryByEntryId } from '@/src/lib/tournamentDb';
import { useTournamentWinCheckContext } from '@/src/context/TournamentWinCheckContext';
import { ENABLE_MOCK_USERS, getMockTournamentEntries } from '@/utils/mockLeaderboardData';
import { getSnaggedRankTier, getTierColor } from '@/src/lib/snaggedRank';
import { useTournamentTimer, formatTournamentCountdown } from '@/src/hooks/useTournamentTimer';

const TEAL = colors.teal;
const ACCENT_BLUE = TEAL;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** App Store Compete chips — no Custom tournaments. */
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
  { id: 'tournament-smallest', label: 'Smallest Fish' },
];

const FEATURED_IDS = FILTER_IDS.map((f) => f.id);

/** Display rewards matching App Store Compete podium (trophies). */
const PODIUM_REWARDS: Record<number, string> = {
  1: '+200',
  2: '+120',
  3: '+60',
};

const SELECTED_TOURNAMENT_KEY = '@Snagged/selectedTournamentId';

function formatRankBadgeLabel(tierLabel: string): string {
  // "BRONZE I" → "BRONZE 1" to match store UI
  return tierLabel
    .replace(/\bIII\b/, '3')
    .replace(/\bII\b/, '2')
    .replace(/\bI\b/, '1');
}

export default function CompeteScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const gamification = useGamificationContext();
  const { presentPaywall } = usePresentPaywall();
  const { tournamentId: deepLinkId } = useLocalSearchParams<{ tournamentId?: string }>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(4, insets.top - 4);
  const [scope, setScope] = useState<'global' | 'local'>('global');
  const bottomPadding = Math.max(24, insets.bottom + 16);
  const { state: locationState, fetchStateFromLocation } = useLocationState();
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
  const [arrowVisible, setArrowVisible] = useState(true);
  const [restartingCycle, setRestartingCycle] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const arrowOpacity = useRef(new Animated.Value(1)).current;

  const handleFilterScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize } = e.nativeEvent;
    const scrollX = contentOffset.x;
    const maxScroll = contentSize.width - SCREEN_WIDTH + 32;
    if (maxScroll > 0 && scrollX > 20) {
      setArrowVisible(false);
      Animated.timing(arrowOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

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
        if (saved && FEATURED_IDS.includes(saved)) {
          setFeaturedCompetitionIdState(saved);
        }
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
    if (deepLinkId && FEATURED_IDS.includes(deepLinkId)) {
      setFeaturedCompetitionId(deepLinkId);
    }
  }, [deepLinkId, setFeaturedCompetitionId]);

  const featuredTournament = tournaments.find((t) => t.id === featuredCompetitionId);
  const currentUserId = user?.id ?? null;
  const timer = useTournamentTimer(featuredTournament?.endsAt);
  const timeRemaining = featuredTournament?.endsAt
    ? formatTournamentCountdown(timer)
    : tournamentsLoading
      ? '…'
      : '—';

  const rankTier = useMemo(
    () => getSnaggedRankTier(gamification?.xp ?? 0),
    [gamification?.xp]
  );
  const rankBadgeLabel = formatRankBadgeLabel(rankTier.label);
  const rankBadgeColor = getTierColor(rankTier.tierName);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const userStateForLocal = scope === 'local' ? (locationState ?? user?.state ?? undefined) : undefined;
      const { entries: list } = await fetchTournamentEntries(
        featuredCompetitionId,
        0,
        200,
        scope,
        userStateForLocal,
        currentUserId
      );
      const authorIds = [...new Set(list.map((e) => e.userId))];
      const displayMap = await getProfileDisplayItemsBatch(authorIds);
      let enriched = list.map((e) => ({
        ...e,
        displayItems: displayMap[e.userId] ?? [],
      }));
      if (isDev && ENABLE_MOCK_USERS && featuredCompetitionId) {
        const metricType = featuredTournament?.metricType === 'LENGTH_IN' ? 'LENGTH_IN' : 'WEIGHT_LBS';
        const mockEntries = getMockTournamentEntries(featuredCompetitionId, metricType);
        enriched = [...enriched, ...mockEntries];
      }
      setEntries(enriched);
    } catch (e) {
      console.error('Query failed:', e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [featuredCompetitionId, scope, locationState, user?.state, currentUserId, featuredTournament?.metricType]);

  const [voteLoadingEntryId, setVoteLoadingEntryId] = useState<string | null>(null);
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
        if (result.removed) {
          setEntries((p) => p.filter((e) => e.id !== entryId));
        } else {
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

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const onPullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([handleRefresh(), loadEntries()]);
    } finally {
      setPullRefreshing(false);
    }
  }, [handleRefresh, loadEntries]);

  useFocusEffect(
    useCallback(() => {
      winCheck?.triggerCheck();
      if (tournaments.length === 0) handleRefresh();
    }, [winCheck, tournaments.length, handleRefresh])
  );

  const handleScopeChange = async (v: 'global' | 'local') => {
    if (v === 'local' && !locationState) {
      await fetchStateFromLocation();
    }
    setScope(v);
  };

  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    if (!currentUserId) {
      setIsEntered(false);
      return;
    }
    isUserEnteredInTournament(featuredCompetitionId, currentUserId).then(setIsEntered);
  }, [featuredCompetitionId, currentUserId]);

  const [showEntryFlow, setShowEntryFlow] = useState(false);

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

  const handleShareTournament = useCallback(async () => {
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
  const leadValue = top3[0]
    ? getEntryMetricValue(top3[0], featuredTournament?.metricType ?? 'WEIGHT_LBS')
    : undefined;
  const leadDisplay =
    leadValue != null
      ? formatMetric(leadValue, featuredTournament?.metricType ?? 'WEIGHT_LBS')
      : '—';

  const renderPodiumSlot = (rank: 1 | 2 | 3, entry: FishEntry | undefined, styleFlex: object) => {
    const isYou = !!(entry && currentUserId && entry.userId === currentUserId);
    const canTrash = !!(entry && (isYou || showRemoveEntry));
    return (
      <View key={`podium-${rank}`} style={[styles.podiumCard, styleFlex]}>
        <View style={styles.rewardBadge}>
          <Ionicons name="trophy" size={12} color={colors.gold} />
          <Text style={styles.rewardBadgeText}>{PODIUM_REWARDS[rank]}</Text>
        </View>
        {entry ? (
          <LeaderboardRow
            entry={entry}
            rank={rank}
            metricType={featuredTournament?.metricType ?? 'WEIGHT_LBS'}
            onVote={handleVoteGated}
            voteLoading={voteLoadingEntryId}
            variant="hero"
            isYou={isYou}
            onRemoveEntry={canTrash ? handleRemoveEntry : undefined}
          />
        ) : (
          <View style={[styles.podiumEmpty, { aspectRatio: 9 / 16 }]}>
            <Text style={styles.podiumEmptyText}>No entries</Text>
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
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={pullRefreshing} onRefresh={onPullRefresh} tintColor={TEAL} />
        }
      >
        {/* Header — wordmark + rank badge + back */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <SnaggedWordmark />
            <View style={[styles.rankBadge, { borderColor: `${rankBadgeColor}88` }]}>
              <Ionicons name="shield" size={14} color={rankBadgeColor} />
              <Text style={[styles.rankBadgeText, { color: rankBadgeColor }]}>{rankBadgeLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.toggleRow}>
          <GlobalLocalToggle value={scope} onChange={handleScopeChange} dark />
        </View>

        {/* Species / weekly chips */}
        <View style={styles.filtersWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            onScroll={handleFilterScroll}
            scrollEventThrottle={16}
          >
            {FILTER_IDS.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, featuredCompetitionId === f.id && styles.chipActive]}
                onPress={() => setFeaturedCompetitionId(f.id)}
              >
                <Text
                  style={[styles.chipText, featuredCompetitionId === f.id && styles.chipTextActive]}
                  numberOfLines={1}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {arrowVisible && (
            <Animated.View style={[styles.scrollArrow, { opacity: arrowOpacity }]} pointerEvents="none">
              <Ionicons name="chevron-forward" size={24} color={ACCENT_BLUE} />
            </Animated.View>
          )}
        </View>

        {/* CTA — Log a catch + share */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.logCatchBtn}
            activeOpacity={0.85}
            onPress={handleLogACatch}
            disabled={isEntered}
          >
            <LinearGradient
              colors={isEntered ? ['#1a5c44', '#174d39'] : ['#00c28a', '#00a87a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logCatchGrad}
            >
              {isEntered ? (
                <Feather name="check" size={18} color="#00e5c8" />
              ) : (
                <Feather name="plus" size={18} color="#fff" />
              )}
              <Text style={[styles.logCatchTxt, isEntered && { color: '#00e5c8' }]}>
                {isEntered ? 'Entered' : 'Log a catch'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareTournament} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {isDev && featuredCompetitionId === 'biggest-fish-this-week' && (
          <View style={styles.devCycleRow}>
            <TouchableOpacity
              style={styles.devCycleBtn}
              onPress={async () => {
                setRestartingCycle(true);
                try {
                  const res = await forceRestartTournament('biggest_fish', 10, 20);
                  if (res.ok) {
                    await handleRefresh();
                    loadEntries();
                  } else {
                    Alert.alert('Dev', res.error ?? 'Failed');
                  }
                } finally {
                  setRestartingCycle(false);
                }
              }}
              disabled={restartingCycle}
            >
              <Text style={styles.devCycleBtnText}>
                {restartingCycle ? '…' : 'Start 20 sec test cycle (dev)'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats — TOTAL ENTRANTS / TIME REMAINING + Lead */}
        <LinearGradient
          colors={['rgba(0,84,130,0.28)', 'rgba(0,30,60,0.45)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsBanner}
        >
          <View style={styles.statsGrid}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>TOTAL ENTRANTS</Text>
              <Text style={styles.statValue}>{featuredTournament?.entrantsCount ?? entries.length ?? 0}</Text>
            </View>
            <View style={[styles.statCol, styles.statColBorder]}>
              <Text style={styles.statLabel}>TIME REMAINING</Text>
              <Text style={styles.statValue} numberOfLines={2}>
                {timeRemaining}
              </Text>
            </View>
          </View>
          <Text style={styles.leadLine}>Lead: {leadDisplay}</Text>
        </LinearGradient>

        <Text style={styles.votingHint}>👍 Verify size  ·  👎 50%+ votes may remove</Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={ACCENT_BLUE} />
          </View>
        ) : entries.length === 0 ? (
          <Text style={styles.empty}>Be the first to enter</Text>
        ) : (
          <View style={styles.leaderboardWrap}>
            <View style={styles.podiumRow}>
              {renderPodiumSlot(2, top3[1], styles.podiumSecond)}
              {renderPodiumSlot(1, top3[0], styles.podiumFirst)}
              {renderPodiumSlot(3, top3[2], styles.podiumThird)}
            </View>

            <View style={styles.restSection}>
              <View style={styles.restHeader}>
                <Text style={styles.restLabel}>Rest of leaderboard</Text>
                <Text style={styles.winningsLine}>Winnings 4th +30 · 5th +15 · 6th–10th +10</Text>
              </View>
              <View style={styles.restContent}>
                {restEntries.map((entry, i) => {
                  const rank = 4 + i;
                  const isYou = !!(currentUserId && entry.userId === currentUserId);
                  const canTrash = isYou || showRemoveEntry;
                  return (
                    <View key={entry.id} style={styles.restGridCell}>
                      <LeaderboardRow
                        entry={entry}
                        rank={rank}
                        metricType={featuredTournament?.metricType ?? 'WEIGHT_LBS'}
                        onVote={handleVoteGated}
                        voteLoading={voteLoadingEntryId}
                        variant="restCard"
                        isYou={isYou}
                        onRemoveEntry={canTrash ? handleRemoveEntry : undefined}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textDim} />
          <Text style={styles.disclaimerText}>
            Voting verifies the fish meets size/metrics. Down votes over 50% may remove. Enter once — synced to
            Global and Local.
          </Text>
        </View>
      </ScrollView>

      <TournamentEntryFlow
        visible={showEntryFlow}
        onDismiss={() => setShowEntryFlow(false)}
        tournamentId={featuredCompetitionId}
        tournamentTitle={featuredTournament?.title ?? 'Tournament'}
        metricType={featuredTournament?.metricType ?? 'LENGTH_IN'}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(7,30,48,0.9)',
  },
  rankBadgeText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  toggleRow: {
    marginBottom: 10,
  },
  filtersWrap: {
    marginBottom: 12,
    position: 'relative',
  },
  scrollArrow: {
    position: 'absolute',
    right: 4,
    top: '50%',
    marginTop: -12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 1, height: 0 }, shadowOpacity: 0.2, shadowRadius: 2 },
      android: { elevation: 4 },
    }),
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 4,
    paddingRight: 20,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: 'rgba(0,229,200,0.15)',
    borderColor: 'rgba(0,229,200,0.45)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textFaint,
  },
  chipTextActive: {
    color: colors.teal,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginBottom: 12,
  },
  logCatchBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#00c28a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  logCatchGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  logCatchTxt: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  shareBtn: {
    width: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  devCycleRow: {
    marginBottom: 8,
  },
  devCycleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,184,0,0.25)',
    alignSelf: 'flex-start',
  },
  devCycleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b8860b',
  },
  statsBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,207,255,0.14)',
    marginBottom: 10,
    overflow: 'hidden',
    paddingBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingTop: 14,
    paddingHorizontal: 8,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  statColBorder: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0,207,255,0.15)',
  },
  statLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 9,
    color: colors.textDim,
    marginBottom: 6,
    letterSpacing: 1,
  },
  statValue: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 15,
    fontWeight: '700',
    color: colors.cyan,
    textAlign: 'center',
  },
  leadLine: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
    color: colors.gold,
  },
  votingHint: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDim,
    textAlign: 'center',
    marginBottom: 12,
  },
  leaderboardWrap: {
    marginBottom: 20,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
  },
  podiumCard: {
    minWidth: 0,
  },
  podiumSecond: {
    flex: 1.2,
  },
  podiumFirst: {
    flex: 1.6,
  },
  podiumThird: {
    flex: 1.2,
  },
  rewardBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,200,69,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,69,0.35)',
  },
  rewardBadgeText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12,
    color: colors.gold,
  },
  podiumEmpty: {
    backgroundColor: 'rgba(7,30,48,0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
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
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  restHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  restLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDim,
  },
  winningsLine: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 11,
    color: colors.gold,
  },
  restContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 6,
    gap: 6,
  },
  restGridCell: {
    flex: 1,
    flexBasis: '47%',
    minWidth: 0,
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  empty: {
    fontSize: 15,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: 20,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: colors.textDim,
    lineHeight: 16,
  },
});
