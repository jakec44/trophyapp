/**
 * Tournament Detail Screen — single tournament focus.
 * Uses tournamentId from route params as the ONLY source of truth.
 * Never shows multiple tournaments; no "More Biggest Fish Tournaments".
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { mockUserProfile } from '@/utils/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';
import type { FishEntry, Tournament, MetricType } from '@/src/types/tournaments';
import {
  fetchHomeTournaments,
  fetchTournamentEntries,
  voteOnEntry,
} from '@/src/api/tournaments';
import { LeaderboardRow } from '@/src/components/home/LeaderboardRow';
import { TournamentDetailHeader } from '@/src/components/tournament/TournamentDetailHeader';
import { TournamentCelebrationModal } from '@/src/components/gamification/TournamentCelebrationModal';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import { useAuthContext } from '@/src/context/AuthContext';
import { useMyTournamentEntry } from '@/src/hooks/useMyTournamentEntry';

/** Single-tournament assertion: this screen only ever displays ONE tournament. */
function assertSingleTournament(tournament: Tournament | null, tournamentId: string | undefined): void {
  if (tournament && tournamentId && tournament.id !== tournamentId) {
    if (__DEV__) {
      console.warn('[TournamentDetail] Source of truth violation: tournament.id !== route param id');
    }
  }
}

export default function TournamentDetailScreen() {
  const router = useRouter();
  const bottomPadding = useBottomSafePadding();
  const { user } = useAuthContext();
  const { id: tournamentId, scope: scopeParam } = useLocalSearchParams<{
    id: string;
    scope?: string;
  }>();
  const scope = (scopeParam === 'local' ? 'local' : 'global') as 'global' | 'local';
  const userState = (mockUserProfile as { state?: string }).state;
  const currentUserId = user?.id ?? (mockUserProfile as { id?: string }).id ?? null;

  const { entry: myEntry } = useMyTournamentEntry(tournamentId ?? undefined, currentUserId);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [entries, setEntries] = useState<FishEntry[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadTournament = useCallback(async () => {
    if (!tournamentId) return;
    const userStateForLocal = scope === 'local' ? userState : undefined;
    const all = await fetchHomeTournaments(scope, userStateForLocal, currentUserId);
    const t = all.find((x) => x.id === tournamentId) ?? null;
    setTournament(t);
  }, [tournamentId, scope, userState, currentUserId]);

  const loadEntries = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!tournamentId) return;
      if (pageNum === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const userStateForLocal = scope === 'local' ? userState : undefined;
        const result = await fetchTournamentEntries(
          tournamentId,
          pageNum,
          20,
          scope,
          userStateForLocal,
          currentUserId
        );
        setEntries((prev) =>
          append ? [...prev, ...result.entries] : result.entries
        );
        setHasMore(result.nextPage != null);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tournamentId, scope, userState, currentUserId]
  );

  useEffect(() => {
    loadTournament();
  }, [loadTournament]);

  useEffect(() => {
    if (!tournamentId) return;
    setPage(0);
    loadEntries(0, false);
  }, [tournamentId, loadEntries]);

  useEffect(() => {
    assertSingleTournament(tournament, tournamentId);
  }, [tournament, tournamentId]);

  useEffect(() => {
    if (!tournament || !tournamentId) return;
    const ended = tournament.endsAt && new Date(tournament.endsAt).getTime() < Date.now();
    if (!ended) return;
    const CELEBRATION_KEY = `@Snagged/celebration-${tournamentId}`;
    AsyncStorage.getItem(CELEBRATION_KEY).then((seen) => {
      if (!seen && (tournamentId === 'biggest-fish-this-week' || tournamentId === 'tournament-bass')) {
        setShowCelebration(true);
        AsyncStorage.setItem(CELEBRATION_KEY, '1');
      }
    });
  }, [tournament, tournamentId]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const next = page + 1;
      setPage(next);
      loadEntries(next, true);
    }
  };

  const handleScopeChange = useCallback(
    (newScope: 'global' | 'local') => {
      router.replace(`/tournament/${tournamentId}?scope=${newScope}`);
    },
    [router, tournamentId]
  );

  const handleEnterOrLog = () => router.push('/(tabs)/log');

  const handleViewYourEntry = () => {
    if (!hasUserEntry || userEntryIndex < 0) {
      router.push('/(tabs)/log');
      return;
    }
    if (!flatListRef.current) return;
    if (userInTop3) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    } else {
      const indexInMoreEntries = userEntryIndex - 3;
      flatListRef.current.scrollToIndex({
        index: indexInMoreEntries,
        animated: true,
        viewPosition: 0.5,
      });
    }
  };

  const handleVote = useCallback(
    async (entryId: string, vote: 'UP' | 'DOWN' | null) => {
      const entry = entries.find((e) => e.id === entryId);
      if (entry?.userId === currentUserId) return;
      setVoteLoading(entryId);
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
        if (!currentUserId) return;
        const result = await voteOnEntry(entryId, vote, currentUserId);
        if (result.removed) {
          setEntries((prev) => prev.filter((e) => e.id !== entryId));
          setTournament((t) =>
            t ? { ...t, entrantsCount: Math.max(0, (t.entrantsCount ?? 0) - 1) } : null
          );
        } else {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entryId
                ? {
                    ...e,
                    upVotes: result.upVotes,
                    downVotes: result.downVotes,
                    userVote: result.userVote,
                  }
                : e
            )
          );
        }
      } catch {
        setEntries(prevEntries);
      } finally {
        setVoteLoading(null);
      }
    },
    [entries, currentUserId]
  );

  const handleVoteGated = useCallback(
    (entryId: string, vote: 'UP' | 'DOWN' | null) => handleVote(entryId, vote),
    [handleVote]
  );

  if (!tournament && !loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <SnaggedWordmark />
        </View>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Tournament not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const metricType: MetricType = tournament?.metricType ?? 'WEIGHT_LBS';

  const userEntryIndex = currentUserId
    ? entries.findIndex((e) => e.userId === currentUserId)
    : -1;
  const userEntry = userEntryIndex >= 0 ? entries[userEntryIndex] : myEntry ?? null;
  const userRank = userEntryIndex >= 0 ? userEntryIndex + 1 : myEntry ? (entries.findIndex((e) => e.id === myEntry.id) + 1 || 0) : 0;
  const userInTop3 = userRank >= 1 && userRank <= 3;

  // Main leaderboard: TOP ANGLERS (top 3) + MORE ENTRIES (4th+); single tournament only
  const leaderboardEntries = entries;

  const top3Entries = leaderboardEntries.slice(0, 3);
  const moreEntries = leaderboardEntries.slice(3);

  const renderMoreEntry = ({ item, index }: { item: FishEntry; index: number }) => (
    <View style={styles.restGridCell}>
      <LeaderboardRow
        entry={item}
        rank={index + 4}
        metricType={metricType}
        onVote={handleVoteGated}
        voteLoading={voteLoading}
        variant="restCard"
        disableVote={item.userId === currentUserId}
      />
    </View>
  );

  const listHeader = (
    <View style={styles.sectionsWrap}>
      {/* TOP ANGLERS — podium: 2nd left, 1st center, 3rd right, gray slots when empty */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionTitle}>TOP ANGLERS</Text>
          <View style={styles.sectionLine} />
        </View>
        <View style={styles.podiumRow}>
          <View style={[styles.podiumCard, styles.podiumSecond]}>
            {top3Entries[1] ? (
              <LeaderboardRow
                entry={top3Entries[1]}
                rank={2}
                metricType={metricType}
                onVote={handleVoteGated}
                voteLoading={voteLoading}
                variant="hero"
                isYou={currentUserId != null && top3Entries[1].userId === currentUserId}
                disableVote={top3Entries[1].userId === currentUserId}
              />
            ) : (
              <View style={[styles.podiumEmpty, { aspectRatio: 9 / 16 }]}>
                <Text style={styles.podiumEmptyText}>No entries</Text>
                <Text style={styles.podiumEmptyRank}>2nd</Text>
              </View>
            )}
          </View>
          <View style={[styles.podiumCard, styles.podiumFirst]}>
            {top3Entries[0] ? (
              <LeaderboardRow
                entry={top3Entries[0]}
                rank={1}
                metricType={metricType}
                onVote={handleVoteGated}
                voteLoading={voteLoading}
                variant="hero"
                isYou={currentUserId != null && top3Entries[0].userId === currentUserId}
                disableVote={top3Entries[0].userId === currentUserId}
              />
            ) : (
              <View style={[styles.podiumEmpty, { aspectRatio: 9 / 16 }]}>
                <Text style={styles.podiumEmptyText}>No entries</Text>
                <Text style={styles.podiumEmptyRank}>1st</Text>
              </View>
            )}
          </View>
          <View style={[styles.podiumCard, styles.podiumThird]}>
            {top3Entries[2] ? (
              <LeaderboardRow
                entry={top3Entries[2]}
                rank={3}
                metricType={metricType}
                onVote={handleVoteGated}
                voteLoading={voteLoading}
                variant="hero"
                isYou={currentUserId != null && top3Entries[2].userId === currentUserId}
                disableVote={top3Entries[2].userId === currentUserId}
              />
            ) : (
              <View style={[styles.podiumEmpty, { aspectRatio: 9 / 16 }]}>
                <Text style={styles.podiumEmptyText}>No entries</Text>
                <Text style={styles.podiumEmptyRank}>3rd</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      {/* MORE ENTRIES — 4th+ row cards */}
      {moreEntries.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>MORE ENTRIES</Text>
            <View style={styles.sectionLine} />
          </View>
        </View>
      )}
    </View>
  );

  const hasUserEntry = userEntryIndex >= 0 || hasUserEntryFirestore;
  const handleCtaPress = handleEnterOrLog;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Sticky header — single tournament only */}
      {tournament && (
        <TournamentDetailHeader
          tournament={tournament}
          scope={scope}
          onScopeChange={handleScopeChange}
          showSyncSubtitle={true}
        />
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accentBlue} />
        </View>
      ) : leaderboardEntries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Be the first to enter</Text>
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleEnterOrLog}
          >
            <Text style={styles.submitBtnText}>Submit Entry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={moreEntries}
          renderItem={renderMoreEntry}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.restRow}
          ListHeaderComponent={listHeader}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.5,
              });
            }, 100);
          }}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomPadding + 80 },
          ]}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.accentBlue} />
              </View>
            ) : null
          }
        />
      )}

      <View style={[styles.fabRow, { bottom: bottomPadding + 12 }]}>
        {hasUserEntry && (
          <TouchableOpacity
            style={styles.fabViewEntry}
            onPress={() => router.push(`/tournament/${tournamentId}/my-entry${scopeParam ? `?scope=${scopeParam}` : ''}`)}
          >
            <Feather name="eye" size={20} color={colors.teal} />
            <Text style={styles.fabViewEntryText}>VIEW MY ENTRY</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.fab, hasUserEntry && styles.fabSecondary]}
          onPress={handleCtaPress}
        >
          <Feather name="plus" size={22} color="#FFFFFF" />
          <Text style={styles.fabText}>Enter Tournament</Text>
        </TouchableOpacity>
      </View>

      {tournament && (
        <TournamentCelebrationModal
          visible={showCelebration}
          place={2}
          tournamentName={tournament.title}
          onDismiss={() => setShowCelebration(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  backButton: {
    padding: 16,
    alignSelf: 'flex-start',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: colors.lightSubtext,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: colors.accentBlue,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionsWrap: {
    paddingBottom: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.lightBorder,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.lightSubtext,
    letterSpacing: 1,
  },
  topCardWrap: {
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  restRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  restGridCell: {
    flex: 1,
    minWidth: 0,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 12,
  },
  podiumCard: {
    minWidth: 0,
    flex: 1,
  },
  podiumSecond: { flex: 1.2 },
  podiumFirst: { flex: 1.6 },
  podiumThird: { flex: 1.2 },
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
    color: colors.lightSubtext,
    fontWeight: '600',
  },
  podiumEmptyRank: {
    fontSize: 10,
    color: colors.lightSubtext,
    marginTop: 4,
    opacity: 0.7,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.lightSubtext,
  },
  fabRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    gap: 10,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accentBlue,
    paddingVertical: 16,
    borderRadius: 14,
  },
  fabSecondary: {
    marginTop: 0,
  },
  fabViewEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.teal,
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  fabViewEntryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.teal,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
