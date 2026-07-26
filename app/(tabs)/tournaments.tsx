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
import type { Tournament, FishEntry } from '@/src/types/tournaments';
import { getEntryMetricValue, formatMetric } from '@/src/types/tournaments';
import { LeaderboardRow } from '@/src/components/home/LeaderboardRow';
import { ScopeToggle } from '@/src/components/rankings/ScopeToggle';
import type { LeaderboardScope } from '@/src/lib/supabase';
import { useFriendsContext } from '@/src/context/FriendsContext';
import { TournamentsAboutModal } from '@/src/components/competitions/TournamentsAboutModal';
import { TournamentCountdown } from '@/src/components/gamification/TournamentCountdown';
import { TournamentEntryFlow } from '@/src/components/competitions/TournamentEntryFlow';
import { isDev } from '@/src/lib/env';
import { forceRestartTournament, getProfileDisplayItemsBatch } from '@/src/lib/supabase';
import { deleteTournamentEntryByEntryId } from '@/src/lib/tournamentDb';
import { useTournamentWinCheckContext } from '@/src/context/TournamentWinCheckContext';
import { ENABLE_MOCK_USERS, getMockTournamentEntries } from '@/utils/mockLeaderboardData';

const TEAL = colors.teal;
const ACCENT_BLUE = TEAL;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FILTER_IDS: { id: string; label: string }[] = [
  { id: 'tournament-bass', label: 'Bass' },
  { id: 'tournament-redfish', label: 'Redfish' },
  { id: 'tournament-snook', label: 'Snook' },
  { id: 'tournament-tarpon', label: 'Tarpon' },
];

const FEATURED_IDS = [
  'tournament-bass',
  'tournament-redfish',
  'tournament-snook',
  'tournament-tarpon',
];

const SELECTED_TOURNAMENT_KEY = '@Snagged/selectedTournamentId';

export default function TournamentsScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { presentPaywall } = usePresentPaywall();
  const { tournamentId: deepLinkId } = useLocalSearchParams<{ tournamentId?: string }>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(4, insets.top - 4);
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const bottomPadding = useBottomSafePadding();
  const { state: locationState, fetchStateFromLocation } = useLocationState();
  const { friends } = useFriendsContext();
  const friendIds = useMemo(
    () => new Set([user?.id, ...friends.map((f) => f.id)].filter(Boolean) as string[]),
    [user?.id, friends]
  );
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
  const [showAboutModal, setShowAboutModal] = useState(false);
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
  const tournamentScope = scope === 'friends' ? 'global' : scope;
  const { tournaments, userFish, voteLoading, handleVote, handleRefresh, loading: tournamentsLoading } = useHomeTournaments(tournamentScope, user?.id, stateForLocal);
  const winCheck = useTournamentWinCheckContext();

  // Restore last selected tournament on mount (so reload doesn't always show first)
  useEffect(() => {
    if (hasRestoredSelection.current) return;
    if (deepLinkId && FEATURED_IDS.includes(deepLinkId)) return;
    hasRestoredSelection.current = true;
    AsyncStorage.getItem(SELECTED_TOURNAMENT_KEY).then((saved) => {
      if (saved && FEATURED_IDS.includes(saved)) {
        setFeaturedCompetitionIdState(saved);
      }
    }).catch(() => {});
  }, [deepLinkId]);

  // When tournaments load, if current selection isn't in the list, pick first available
  useEffect(() => {
    if (tournaments.length === 0) return;
    const ids = new Set(tournaments.map((t) => t.id));
    if (ids.has(featuredCompetitionId)) return;
    const first = tournaments[0]?.id ?? FEATURED_IDS[0];
    setFeaturedCompetitionIdState(first);
  }, [tournaments, featuredCompetitionId]);

  // Sync when navigated here from the banner with a specific tournament
  useEffect(() => {
    if (deepLinkId && FEATURED_IDS.includes(deepLinkId)) {
      setFeaturedCompetitionId(deepLinkId);
    }
  }, [deepLinkId]);

  const featuredTournament = tournaments.find((t) => t.id === featuredCompetitionId);
  const currentUserId = user?.id ?? null;

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const userStateForLocal = scope === 'local' ? (locationState ?? user?.state ?? undefined) : undefined;
      const fetchScope = scope === 'friends' ? 'global' : scope;
      const { entries: list } = await fetchTournamentEntries(
        featuredCompetitionId,
        0,
        200,
        fetchScope,
        userStateForLocal,
        currentUserId
      );
      let filtered = list;
      if (scope === 'friends') {
        filtered = list.filter((e) => friendIds.has(e.userId));
      }
      const authorIds = [...new Set(filtered.map((e) => e.userId))];
      const displayMap = await getProfileDisplayItemsBatch(authorIds);
      let enriched = filtered.map((e) => ({
        ...e,
        displayItems: displayMap[e.userId] ?? [],
      }));
      if (isDev && ENABLE_MOCK_USERS && featuredCompetitionId) {
        const metricType = featuredTournament?.metricType === 'LENGTH_IN' ? 'LENGTH_IN' : 'WEIGHT_LBS';
        const mockEntries = getMockTournamentEntries(featuredCompetitionId, metricType);
        enriched = [...enriched, ...mockEntries];
      }
      setEntries(enriched);
    } finally {
      setLoading(false);
    }
  }, [featuredCompetitionId, scope, locationState, user?.state, currentUserId, friendIds, featuredTournament?.metricType]);

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

  // Load entries only when user switches tournament, scope, or location (no refetch on tournaments list updates)
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

  // When user focuses Tournaments tab, run win check and ensure tournaments are loaded (fixes first-click times not showing)
  useFocusEffect(
    useCallback(() => {
      winCheck?.triggerCheck();
      if (tournaments.length === 0) handleRefresh();
    }, [winCheck, tournaments.length, handleRefresh])
  );

  const handleScopeChange = async (v: LeaderboardScope) => {
    if (v === 'local' && !locationState) {
      await fetchStateFromLocation();
    }
    setScope(v);
  };

  const getMetricLabel = (metricType: string) => {
    if (metricType === 'WEIGHT_LBS') return 'lbs';
    if (metricType === 'LENGTH_IN') return 'in';
    if (metricType === 'VOTES_UP') return 'votes';
    return 'score';
  };

  const currentUsername = (user as { username?: string } | null)?.username ?? 'You';
  const currentAvatarUrl = (user as { avatarUrl?: string } | null)?.avatarUrl;

  // Track entry status as state so button updates immediately after entering
  const [isEntered, setIsEntered] = useState(false);

  // Sync isEntered when tournament or user changes (not on every entries update)
  useEffect(() => {
    if (!currentUserId) {
      setIsEntered(false);
      return;
    }
    isUserEnteredInTournament(featuredCompetitionId, currentUserId).then(setIsEntered);
  }, [featuredCompetitionId, currentUserId]);

  // Entry flow modal
  const [showEntryFlow, setShowEntryFlow] = useState(false);

  const handleEnterTournament = useCallback(async () => {
    if (!currentUserId) {
      router.replace('/(tabs)/profile');
      return;
    }
    if (isEntered) {
      Alert.alert('Already entered', 'You already have a catch in this tournament.');
      return;
    }
    // Free users can only enter one tournament at a time
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
  }, [currentUserId, isEntered, user?.subscriptionPlan, presentPaywall]);

  const handleEntryFlowDone = useCallback(async () => {
    setShowEntryFlow(false);
    setIsEntered(true);
    await loadEntries();
  }, [loadEntries]);

  const [deleteLoading, setDeleteLoading] = useState(false);
  const handleDeleteEntry = useCallback(() => {
    if (!currentUserId) return;
    Alert.alert(
      'Delete entry?',
      "This will remove your entry from this tournament. Your catch will remain in your logbook.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete entry',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              await withdrawFromTournament(featuredCompetitionId, currentUserId);
              setIsEntered(false);
              await loadEntries();
            } catch (e) {
              Alert.alert('Error', (e as Error).message);
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ]
    );
  }, [featuredCompetitionId, currentUserId, loadEntries]);

  const handleRemoveEntry = useCallback(
    async (entryId: string) => {
      if (entryId.startsWith('mock-entry-')) {
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
        return;
      }
      try {
        await deleteTournamentEntryByEntryId(entryId);
        await loadEntries();
      } catch (e) {
        console.error('[Tournaments] remove entry failed:', e);
      }
    },
    [loadEntries]
  );

  const showRemoveEntry = isDev || user?.isModerator === true;

  const top3 = entries.slice(0, 3);
  const restEntries = entries.slice(3);
  const leadValue = top3[0] ? getEntryMetricValue(top3[0], featuredTournament?.metricType ?? 'WEIGHT_LBS') : undefined;
  const leadDisplay = leadValue != null ? formatMetric(leadValue, featuredTournament?.metricType ?? 'WEIGHT_LBS') : '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Animated rising particle background — behind all content */}
      <ParticleBackground />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={onPullRefresh}
            tintColor={TEAL}
          />
        }
      >
        {/* Header — Snagged on top, tournament title + About */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <SnaggedWordmark />
            <TouchableOpacity style={styles.aboutBtn} onPress={() => setShowAboutModal(true)}>
              <Text style={styles.aboutBtnText}>About</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {featuredTournament?.id === 'biggest-fish-this-week' ? 'BIGGEST FISH OVERALL' : (featuredTournament?.title ?? 'TOURNAMENTS').toUpperCase()}
          </Text>
        </View>

        {/* Global / Local */}
        <View style={styles.toggleWrap}>
          <View style={styles.toggleRow}>
            <ScopeToggle
              value={scope}
              onChange={handleScopeChange}
              localLabel={stateForLocal ?? undefined}
            />
          </View>
          <TouchableOpacity
            style={styles.viewLeaderboardLink}
            onPress={() => router.push('/(tabs)/leaderboard')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewLeaderboardLinkText}>View full leaderboards →</Text>
          </TouchableOpacity>
        </View>

        <TournamentsAboutModal visible={showAboutModal} onClose={() => setShowAboutModal(false)} />

        {/* Secondary filters — species + sort */}
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
                style={[
                  styles.chip,
                  featuredCompetitionId === f.id && styles.chipActive,
                ]}
                onPress={() => setFeaturedCompetitionId(f.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    featuredCompetitionId === f.id && styles.chipTextActive,
                  ]}
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

        {/* Featured Competition — countdown */}
        <View style={styles.headerBadgeRow}>
          {featuredTournament?.endsAt ? (
            <TournamentCountdown
              endsAt={featuredTournament.endsAt}
              compact
              onDark
              onEnded={winCheck?.triggerCheck}
            />
          ) : tournamentsLoading && tournaments.length === 0 ? (
            <Text style={styles.countdownPlaceholder}>Loading…</Text>
          ) : null}
        </View>

        {/* Dev: 20-sec test cycle for Biggest Fish — visible on Tournaments tab when Biggest Fish selected */}
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

        {/* Stats banner — 3-column */}
        <LinearGradient
          colors={['rgba(0,84,130,0.25)', 'rgba(0,30,60,0.4)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsBanner}
        >
          <View style={styles.statsShimmer} />
          <View style={styles.statsGrid}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>ENTRANTS</Text>
              <Text style={styles.statValue}>{featuredTournament?.entrantsCount ?? 0}</Text>
            </View>
            <View style={[styles.statCol, styles.statColBorder]}>
              <Text style={styles.statLabel}>LEAD {getMetricLabel(featuredTournament?.metricType ?? 'WEIGHT_LBS').toUpperCase()}</Text>
              <Text style={styles.statValue}>{leadDisplay}</Text>
            </View>
            <View style={[styles.statCol, styles.statColBorder]}>
              <Text style={styles.statLabel}>UNIT</Text>
              <Text style={styles.statValue}>{getMetricLabel(featuredTournament?.metricType ?? 'WEIGHT_LBS').toUpperCase()}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.votingRulesTop}>
          <View style={styles.enterDeleteRow}>
            <TouchableOpacity
              style={[styles.enterTournamentBtn, styles.enterHalf]}
              activeOpacity={0.82}
              onPress={handleEnterTournament}
              disabled={isEntered}
            >
              <LinearGradient
                colors={isEntered ? ['#1a5c44', '#174d39'] : ['#00c28a', '#00a87a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.enterTournamentGrad}
              >
                {isEntered ? (
                  <Feather name="check" size={16} color="#00e5c8" />
                ) : (
                  <Feather name="plus" size={16} color="#fff" />
                )}
                <Text style={[styles.enterTournamentTxt, isEntered && { color: '#00e5c8' }]}>
                  {isEntered ? 'Entered' : 'Enter Tournament'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            {isEntered && (
              <TouchableOpacity
                style={[styles.deleteEntryBtn, deleteLoading && styles.deleteEntryBtnDisabled]}
                activeOpacity={0.82}
                onPress={handleDeleteEntry}
                disabled={deleteLoading}
              >
                <Feather name="trash-2" size={16} color="#ff6b6b" />
                <Text style={styles.deleteEntryTxt}>Delete entry</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.votingRulesText}>👍 Verify size  ·  👎 50%+ votes = may be removed</Text>
          <Text style={styles.votingRulesWarning}>Obviously fake entries will result in a ban from tournaments.</Text>
        </View>

        {/* Leaderboard — podium (2nd left, 1st center, 3rd right) + rest of leaderboard */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={ACCENT_BLUE} />
          </View>
        ) : entries.length === 0 ? (
          <Text style={styles.empty}>Be the first to enter</Text>
        ) : (
          <View style={styles.leaderboardWrap}>
            {/* Podium: 2nd LEFT, 1st CENTER, 3rd RIGHT — always 3 slots, gray placeholder when empty */}
            <View style={styles.podiumRow}>
              <View key="podium-2" style={[styles.podiumCard, styles.podiumSecond]}>
                {top3[1] ? (
                  <LeaderboardRow
                    entry={top3[1]}
                    rank={2}
                    metricType={featuredTournament?.metricType ?? 'WEIGHT_LBS'}
                    onVote={handleVoteGated}
                    voteLoading={voteLoadingEntryId}
                    variant="hero"
                    isYou={currentUserId != null && top3[1].userId === currentUserId}
                    onRemoveEntry={showRemoveEntry ? handleRemoveEntry : undefined}
                  />
                ) : (
                  <View style={[styles.podiumEmpty, { aspectRatio: 9 / 16 }]}>
                    <Text style={styles.podiumEmptyText}>No entries</Text>
                    <Text style={styles.podiumEmptyRank}>2nd</Text>
                  </View>
                )}
              </View>
              <View key="podium-1" style={[styles.podiumCard, styles.podiumFirst]}>
                {top3[0] ? (
                  <LeaderboardRow
                    entry={top3[0]}
                    rank={1}
                    metricType={featuredTournament?.metricType ?? 'WEIGHT_LBS'}
                    onVote={handleVoteGated}
                    voteLoading={voteLoadingEntryId}
                    variant="hero"
                    isYou={currentUserId != null && top3[0].userId === currentUserId}
                    onRemoveEntry={showRemoveEntry ? handleRemoveEntry : undefined}
                  />
                ) : (
                  <View style={[styles.podiumEmpty, { aspectRatio: 9 / 16 }]}>
                    <Text style={styles.podiumEmptyText}>No entries</Text>
                    <Text style={styles.podiumEmptyRank}>1st</Text>
                  </View>
                )}
              </View>
              <View key="podium-3" style={[styles.podiumCard, styles.podiumThird]}>
                {top3[2] ? (
                  <LeaderboardRow
                    entry={top3[2]}
                    rank={3}
                    metricType={featuredTournament?.metricType ?? 'WEIGHT_LBS'}
                    onVote={handleVoteGated}
                    voteLoading={voteLoadingEntryId}
                    variant="hero"
                    isYou={currentUserId != null && top3[2].userId === currentUserId}
                    onRemoveEntry={showRemoveEntry ? handleRemoveEntry : undefined}
                  />
                ) : (
                  <View style={[styles.podiumEmpty, { aspectRatio: 9 / 16 }]}>
                    <Text style={styles.podiumEmptyText}>No entries</Text>
                    <Text style={styles.podiumEmptyRank}>3rd</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Rest of leaderboard — 2-column portrait grid */}
            <View style={styles.restSection}>
              <Text style={styles.restLabel}>Rest of leaderboard</Text>
              <View style={styles.restContent}>
                {restEntries.map((entry, i) => (
                  <View key={entry.id} style={styles.restGridCell}>
                    <LeaderboardRow
                      entry={entry}
                      rank={4 + i}
                      metricType={featuredTournament?.metricType ?? 'WEIGHT_LBS'}
                      onVote={handleVoteGated}
                      voteLoading={voteLoadingEntryId}
                      variant="restCard"
                      onRemoveEntry={showRemoveEntry ? handleRemoveEntry : undefined}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textDim} />
          <Text style={styles.disclaimerText}>
            Voting verifies the fish meets size/metrics. Down votes over 50% may remove. Enter once — synced to Global and Local.
          </Text>
        </View>
      </ScrollView>

      {/* Tournament entry flow — logbook picker + disclaimer confirmation */}
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
    paddingHorizontal: 6,
    paddingBottom: 40,
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
  restSection: {
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  restLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  restScroll: {
    flex: 1,
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
  header: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingBottom: 6,
    gap: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  aboutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,229,200,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.25)',
  },
  aboutBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal,
  },
  title: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 20,
    fontWeight: '900',
    color: colors.teal,
    marginBottom: 2,
    textShadowColor: 'rgba(0,229,200,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 10,
    color: colors.textFaint,
  },
  toggleWrap: {
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewLeaderboardLink: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 6,
  },
  viewLeaderboardLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEAL,
  },
  viewLeaderboardWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  viewLeaderboardBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  viewLeaderboardGradient: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  viewLeaderboardText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1a1000',
    letterSpacing: 0.5,
  },
  syncHint: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 4,
  },
  filtersWrap: {
    marginBottom: 8,
    position: 'relative',
  },
  scrollArrow: {
    position: 'absolute',
    right: 8,
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
    paddingBottom: 8,
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
    borderColor: 'rgba(0,229,200,0.4)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textFaint,
  },
  chipTextActive: {
    color: colors.teal,
    textShadowColor: 'rgba(0,229,200,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  countdownPlaceholder: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    paddingVertical: 4,
    paddingHorizontal: 8,
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
    borderColor: 'rgba(0,207,255,0.12)',
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  statsShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'transparent',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statColBorder: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0,207,255,0.15)',
  },
  statLabel: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 9,
    color: colors.textDim,
    marginBottom: 4,
    letterSpacing: 1,
  },
  statValue: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14,
    fontWeight: '700',
    color: colors.cyan,
    textShadowColor: 'rgba(0,207,255,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  votingRulesTop: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,229,200,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.1)',
    gap: 8,
  },
  enterDeleteRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  enterHalf: {
    flex: 1,
    minWidth: 0,
  },
  deleteEntryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.35)',
  },
  deleteEntryBtnDisabled: {
    opacity: 0.6,
  },
  deleteEntryTxt: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ff6b6b',
    letterSpacing: 0.2,
  },
  votingRulesText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDim,
  },
  votingRulesWarning: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c62828',
    marginTop: 4,
  },
  enterTournamentBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  enterTournamentGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  enterTournamentTxt: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  leaderboard: {
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
    paddingTop: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  empty: {
    fontSize: 15,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: 20,
  },
  viewFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewFullText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14,
    fontWeight: '700',
    color: colors.teal,
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
