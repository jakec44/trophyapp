/**
 * View My Entry — shows the user's tournament entry with live rank, vote bar, gap to leader, delete.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
import type { FishEntry, MetricType } from '@/src/types/tournaments';
import { formatMetric, getEntryMetricValue } from '@/src/types/tournaments';
import { VoteButtons } from '@/src/components/home/VoteButtons';
import { useAuthContext } from '@/src/context/AuthContext';
import { useMyTournamentEntry } from '@/src/hooks/useMyTournamentEntry';
import { deleteTournamentEntryByUser } from '@/src/lib/tournamentDb';
import { fetchHomeTournaments, fetchTournamentEntries } from '@/src/api/tournaments';
import { mockUserProfile } from '@/utils/mockData';

const TEAL = colors.teal;

function computeRank(
  myEntry: FishEntry,
  allEntries: FishEntry[],
  metricType: MetricType,
  tournamentId: string,
  tournamentType?: string
): { rank: number; total: number; leaderValue: number | undefined } {
  // Smallest-fish: smallest inches win (ascending); else biggest wins
  const smallestFirst = tournamentType === 'SMALLEST_FISH' || tournamentId === 'tournament-smallest';
  const myVal =
    metricType === 'WEIGHT_LBS'
      ? (myEntry.weightLbs ?? 0)
      : (myEntry.lengthIn ?? (smallestFirst ? 999 : 0));
  let rank = 1;
  for (const e of allEntries) {
    const v =
      metricType === 'WEIGHT_LBS'
        ? (e.weightLbs ?? 0)
        : (e.lengthIn ?? (smallestFirst ? 999 : 0));
    if (smallestFirst ? v < myVal : v > myVal) rank++;
  }
  const leader = allEntries[0];
  const leaderValue =
    leader == null
      ? undefined
      : metricType === 'WEIGHT_LBS'
        ? (leader.weightLbs ?? 0)
        : (leader.lengthIn ?? 0);
  return { rank, total: allEntries.length, leaderValue };
}

export default function ViewMyEntryScreen() {
  const router = useRouter();
  const { id: tournamentId, scope: scopeParam } = useLocalSearchParams<{
    id: string;
    scope?: string;
  }>();
  const scope = (scopeParam === 'local' ? 'local' : 'global') as 'global' | 'local';
  const { user } = useAuthContext();
  const userState = user?.state ?? undefined;
  const currentUserId = user?.id ?? (mockUserProfile as { id?: string }).id ?? null;

  const { entry: myEntry, loading: entryLoading } = useMyTournamentEntry(
    tournamentId ?? undefined,
    currentUserId
  );
  const [entries, setEntries] = useState<FishEntry[]>([]);
  const [tournamentTitle, setTournamentTitle] = useState('');
  const [metricType, setMetricType] = useState<MetricType>('LENGTH_IN');
  const [tournamentType, setTournamentType] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;
    fetchHomeTournaments(scope, scope === 'local' ? userState : undefined, currentUserId).then(
      (list) => {
        const t = list.find((x) => x.id === tournamentId);
        if (t) {
          setTournamentTitle(t.title);
          setMetricType(t.metricType ?? 'LENGTH_IN');
          setTournamentType(t.type ?? '');
        }
      }
    );
    fetchTournamentEntries(
      tournamentId,
      0,
      100,
      scope,
      scope === 'local' ? userState : undefined,
      currentUserId ?? undefined
    ).then((res) => {
      setEntries(res.entries);
    });
  }, [tournamentId, scope, userState, currentUserId]);

  const rankInfo =
    myEntry && entries.length > 0
      ? computeRank(myEntry, entries, metricType, tournamentId ?? '', tournamentType)
      : null;
  const smallestFirst = tournamentType === 'SMALLEST_FISH' || tournamentId === 'tournament-smallest';
  const gapToLeader =
    rankInfo &&
    rankInfo.rank > 1 &&
    rankInfo.leaderValue != null &&
    myEntry
      ? (() => {
          const myVal =
            metricType === 'WEIGHT_LBS'
              ? (myEntry.weightLbs ?? 0)
              : (myEntry.lengthIn ?? 0);
          const diff = smallestFirst ? myVal - (rankInfo.leaderValue ?? 0) : (rankInfo.leaderValue ?? 0) - myVal;
          const unit = metricType === 'WEIGHT_LBS' ? ' lbs' : ' in';
          return diff > 0 ? `You are ${diff.toFixed(1)}${unit} behind` : null;
        })()
      : null;

  const handleDelete = useCallback(() => {
    if (!myEntry || !currentUserId) return;
    Alert.alert(
      'Remove entry?',
      'Your fish will be removed from this tournament. You can enter again with a different catch.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
            onPress: async () => {
              setDeleteLoading(true);
              try {
                await deleteTournamentEntryByUser(tournamentId!, currentUserId!);
                router.replace(`/tournament/${tournamentId}`);
              } catch (e) {
                Alert.alert('Error', (e as Error).message);
              } finally {
                setDeleteLoading(false);
              }
            },
        },
      ]
    );
  }, [myEntry, currentUserId, router, tournamentId]);

  if (entryLoading || !tournamentId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadWrap}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadText}>Loading your entry…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!myEntry) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadWrap}>
          <Text style={styles.emptyText}>You haven't entered this tournament</Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalVotes = myEntry.upVotes + myEntry.downVotes;
  const ratio = totalVotes > 0 ? myEntry.upVotes / totalVotes : 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <SnaggedWordmark />
        <Text style={styles.headerTitle} numberOfLines={1}>
          My Entry
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.tournamentLabel}>{tournamentTitle}</Text>

        <View style={styles.photoWrap}>
          <Image
            source={{ uri: myEntry.imageUrl }}
            style={styles.photo}
            resizeMode="cover"
          />
          {rankInfo && (
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>
                #{rankInfo.rank} of {rankInfo.total}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.species}>{myEntry.species ?? 'Fish'}</Text>
          <Text style={styles.metric}>
            {formatMetric(
              getEntryMetricValue(myEntry, metricType),
              metricType
            )}
          </Text>
        </View>

        <View style={styles.voteSection}>
          <View style={styles.voteBar}>
            <LinearGradient
              colors={['rgba(255,60,80,0.55)', 'rgba(200,20,40,0.7)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.voteFill, { width: `${ratio * 100}%` }]}>
              <LinearGradient
                colors={[TEAL, colors.green]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </View>
          <Text style={styles.voteCounts}>
            👍 {myEntry.upVotes} · 👎 {myEntry.downVotes}
          </Text>
        </View>

        <View style={styles.votingRulesBox}>
          <Text style={styles.votingRulesText}>
            👍 Verify size · 👎 Down votes over 50% may be removed
          </Text>
          <Text style={styles.votingRulesWarning}>Obviously fake entries may be banned from tournaments.</Text>
        </View>

        {gapToLeader && (
          <Text style={styles.gapText}>{gapToLeader}</Text>
        )}

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          disabled={deleteLoading}
        >
          {deleteLoading ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <>
              <Feather name="trash-2" size={18} color="#DC2626" />
              <Text style={styles.deleteBtnText}>Remove entry</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  loadWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.lightSubtext,
  },
  emptyText: {
    fontSize: 16,
    color: colors.lightSubtext,
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.lightCard,
    borderRadius: 12,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightText,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  backIcon: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  tournamentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEAL,
    marginBottom: 16,
  },
  photoWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.lightCard,
    marginBottom: 16,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  rankBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rankBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  species: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
  },
  metric: {
    fontSize: 18,
    fontWeight: '800',
    color: TEAL,
  },
  voteSection: {
    marginBottom: 12,
  },
  voteBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginBottom: 8,
  },
  voteFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  voteCounts: {
    fontSize: 13,
    color: colors.lightSubtext,
  },
  votingRulesBox: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(74, 144, 226, 0.08)',
    borderRadius: 10,
  },
  votingRulesText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  votingRulesWarning: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c62828',
    marginTop: 4,
  },
  gapText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.lightSubtext,
    marginBottom: 24,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.4)',
    borderRadius: 12,
    backgroundColor: 'rgba(220,38,38,0.06)',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
});
