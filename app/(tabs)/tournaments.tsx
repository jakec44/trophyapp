import { useState, useCallback, useEffect, useRef } from 'react';
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
} from 'react-native';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
import { CARD_RADIUS } from '@/src/constants/styles';
import { useHomeTournaments } from '@/src/hooks/useHomeTournaments';
import { useLocationPermission } from '@/src/hooks/useLocationPermission';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import {
  fetchTournamentEntries,
  isUserEnteredInTournament,
  withdrawFromTournament,
  countUserTournamentEntries,
  voteOnEntry,
} from '@/src/api/tournaments';
import { mockUserProfile } from '@/utils/mockData';
import { useAuthContext } from '@/src/context/AuthContext';
import type { Tournament, FishEntry } from '@/src/types/tournaments';
import { getEntryMetricValue, formatMetric } from '@/src/types/tournaments';
import { LeaderboardRow } from '@/src/components/home/LeaderboardRow';
import { GlobalLocalToggle } from '@/src/components/competitions/GlobalLocalToggle';
import { TournamentCountdown } from '@/src/components/gamification/TournamentCountdown';
import { TournamentEntryFlow } from '@/src/components/competitions/TournamentEntryFlow';

const TEAL = colors.teal;
const ACCENT_BLUE = TEAL;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FILTER_IDS: { id: string; label: string }[] = [
  { id: 'biggest-fish-this-week', label: 'Biggest Fish' },
  { id: 'tournament-redfish', label: 'Redfish' },
  { id: 'tournament-bass', label: 'Bass' },
  { id: 'tournament-snook', label: 'Snook' },
  { id: 'tournament-flounder', label: 'Flounder' },
  { id: 'tournament-striper', label: 'Striper' },
  { id: 'tournament-tarpon', label: 'Tarpon' },
  { id: 'tournament-smallest', label: 'Smallest' },
];

const FEATURED_IDS = [
  'biggest-fish-this-week',
  'tournament-redfish',
  'tournament-bass',
  'tournament-snook',
  'tournament-flounder',
  'tournament-striper',
  'tournament-tarpon',
  'tournament-smallest',
];

export default function TournamentsScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { tournamentId: deepLinkId } = useLocalSearchParams<{ tournamentId?: string }>();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(4, insets.top - 4);
  const [scope, setScope] = useState<'global' | 'local'>('global');
  const bottomPadding = useBottomSafePadding();
  const { ensurePermission } = useLocationPermission();
  // If opened from the "Ending Soon" banner, start on that tournament; otherwise default to first
  const [featuredCompetitionId, setFeaturedCompetitionId] = useState(
    deepLinkId && FEATURED_IDS.includes(deepLinkId) ? deepLinkId : FEATURED_IDS[0]
  );
  const [entries, setEntries] = useState<FishEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [arrowVisible, setArrowVisible] = useState(true);
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

  const { tournaments, userFish, voteLoading, handleVote } = useHomeTournaments(scope, user?.id);

  // Sync when navigated here from the banner with a specific tournament
  useEffect(() => {
    if (deepLinkId && FEATURED_IDS.includes(deepLinkId)) {
      setFeaturedCompetitionId(deepLinkId);
    }
  }, [deepLinkId]);

  const featuredTournament = tournaments.find((t) => t.id === featuredCompetitionId);

  const currentUserId = user?.id ?? (mockUserProfile as { id?: string }).id ?? null;
  const userState = (mockUserProfile as { state?: string }).state;
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const userStateForLocal = scope === 'local' ? userState : undefined;
      const { entries: list } = await fetchTournamentEntries(
        featuredCompetitionId,
        0,
        20,
        scope,
        userStateForLocal,
        currentUserId
      );
      setEntries(list);
    } finally {
      setLoading(false);
    }
  }, [featuredCompetitionId, scope, userState, currentUserId]);

  const [voteLoadingEntryId, setVoteLoadingEntryId] = useState<string | null>(null);
  const handleVoteGated = useCallback(
    async (entryId: string, vote: 'UP' | 'DOWN' | null) => {
      if (!currentUserId) {
        Alert.alert('Sign in to vote', 'Please sign in to vote on entries.');
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
    [entries, currentUserId]
  );

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleScopeChange = async (v: 'global' | 'local') => {
    if (v === 'local') {
      const granted = await ensurePermission();
      if (!granted) return;
    }
    setScope(v);
    // TODO: Backend - fetchFeaturedCompetition(mode) and fetchCompetitionPreviews(mode)
    // when API supports global vs local. Client-side filter for now.
  };

  const getMetricLabel = (metricType: string) => {
    if (metricType === 'WEIGHT_LBS') return 'lbs';
    if (metricType === 'LENGTH_IN') return 'in';
    if (metricType === 'VOTES_UP') return 'votes';
    return 'score';
  };

  const currentUsername =
    (user as { username?: string } | null)?.username ??
    (mockUserProfile as { username?: string }).username ??
    'You';
  const currentAvatarUrl =
    (user as { avatarUrl?: string } | null)?.avatarUrl ??
    (mockUserProfile as { avatar?: string }).avatar ??
    undefined;

  // Track entry status as state so button updates immediately after entering
  const [isEntered, setIsEntered] = useState(false);

  // Sync isEntered from Supabase whenever tournament or user changes
  useEffect(() => {
    if (!currentUserId) {
      setIsEntered(false);
      return;
    }
    isUserEnteredInTournament(featuredCompetitionId, currentUserId).then(setIsEntered);
  }, [featuredCompetitionId, currentUserId, entries]);

  // Entry flow modal
  const [showEntryFlow, setShowEntryFlow] = useState(false);

  const handleEnterTournament = useCallback(async () => {
    if (!currentUserId) {
      Alert.alert('Sign in required', 'Please sign in to enter a tournament.');
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
          'Free accounts can only enter one tournament. Delete your current entry to enter another, or upgrade to Pro for unlimited entries.'
        );
        return;
      }
    }
    setShowEntryFlow(true);
  }, [currentUserId, isEntered, user?.subscriptionPlan]);

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
      >
        {/* Header — Snagged on top, tournament title below */}
        <View style={styles.header}>
          <SnaggedWordmark />
          <Text style={styles.title} numberOfLines={1}>
            {featuredTournament?.id === 'biggest-fish-this-week' ? 'BIGGEST FISH' : (featuredTournament?.title ?? 'TOURNAMENTS').toUpperCase()}
          </Text>
        </View>

        {/* Global / Local — entries sync to both */}
        <View style={styles.toggleWrap}>
          <GlobalLocalToggle value={scope} onChange={handleScopeChange} dark />
          <Text style={styles.syncHint}>Entries sync to both</Text>
        </View>

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
          {featuredTournament?.endsAt && (
            <TournamentCountdown endsAt={featuredTournament.endsAt} compact onDark />
          )}
        </View>

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
          <Text style={styles.votingRulesText}>👍 Verify size  ·  👎 50%+ votes = removal</Text>
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
    width: '48%',
    minWidth: '48%',
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
