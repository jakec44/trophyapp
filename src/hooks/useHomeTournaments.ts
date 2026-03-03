/**
 * Hook for Live Tournament Hub: tournaments, voting, refresh, "could place" alert
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Tournament, UserFish, MetricType, TournamentType } from '@/src/types/tournaments';
import { getEntryMetricValue } from '@/src/types/tournaments';
import {
  fetchHomeTournaments,
  voteOnEntry,
} from '@/src/api/tournaments';
import { getUserCatches } from '@/src/lib/supabase';
import { mockUserProfile } from '@/utils/mockData';

const REFRESH_INTERVAL_MS = 45000; // 45 seconds
const LOAD_TIMEOUT_MS = 15000; // 15s — prevent stuck loading if API hangs

export interface CouldPlaceAlert {
  tournamentId: string;
  tournamentTitle: string;
  predictedRank: number;
  userFish: UserFish;
  userFishMetricDisplay: string;
  currentThirdPlaceMetric: string;
}

const USER_STATE = (mockUserProfile as { state?: string }).state ?? 'South Carolina';

function mapCatchToUserFish(row: { id: string; species?: string; weight_lb?: number; length_in?: number; taken_at?: string; photo_url?: string }): UserFish {
  return {
    id: row.id,
    imageUrl: row.photo_url ?? '',
    species: row.species,
    weightLbs: row.weight_lb,
    lengthIn: row.length_in,
    createdAt: row.taken_at ?? new Date().toISOString(),
  };
}

export function useHomeTournaments(scope: 'global' | 'local' = 'global', userId?: string | null) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [userFish, setUserFish] = useState<UserFish[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), LOAD_TIMEOUT_MS)
      );
      try {
        const userState = scope === 'local' ? USER_STATE : undefined;
        const [t, u] = await Promise.race([
          Promise.all([
            fetchHomeTournaments(scope, userState, userId),
            userId ? (async () => {
              const { data } = await getUserCatches(userId, 200, 0);
              return (data ?? []).map((r) => mapCatchToUserFish(r as Parameters<typeof mapCatchToUserFish>[0]));
            })() : Promise.resolve([] as UserFish[]),
          ]),
          timeoutPromise,
        ]);
        setTournaments(t);
        setUserFish(u);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setTournaments([]);
        setUserFish([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [scope, userId]
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
      intervalRef.current = setInterval(() => loadData(true), REFRESH_INTERVAL_MS);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [loadData])
  );

  const handleRefresh = useCallback(() => loadData(true), [loadData]);

  const handleVote = useCallback(
    async (
      entryId: string,
      vote: 'UP' | 'DOWN' | null
    ): Promise<{ removed?: boolean } | void> => {
      setVoteLoading(entryId);
      const prevTournaments = [...tournaments];
      // Optimistic update
      setTournaments((prev) =>
        prev.map((t) => ({
          ...t,
          topEntries: t.topEntries.map((e) => {
            if (e.id !== entryId) return e;
            const prevVote = e.userVote;
            let upVotes = e.upVotes;
            let downVotes = e.downVotes;
            if (prevVote === 'UP') upVotes--;
            if (prevVote === 'DOWN') downVotes--;
            if (vote === 'UP') upVotes++;
            if (vote === 'DOWN') downVotes++;
            return { ...e, upVotes, downVotes, userVote: vote };
          }),
        }))
      );
      try {
        if (!userId) throw new Error('Must be signed in to vote');
        const result = await voteOnEntry(entryId, vote, userId);
        if (result.removed) {
          // Remove entry from all tournaments' topEntries and refresh counts
          setTournaments((prev) =>
            prev.map((t) => ({
              ...t,
              topEntries: t.topEntries.filter((e) => e.id !== entryId),
              entrantsCount: Math.max(0, (t.entrantsCount ?? 0) - 1),
            }))
          );
          return { removed: true };
        }
        setTournaments((prev) =>
          prev.map((t) => ({
            ...t,
            topEntries: t.topEntries.map((e) =>
              e.id === entryId
                ? {
                    ...e,
                    upVotes: result.upVotes,
                    downVotes: result.downVotes,
                    userVote: result.userVote,
                  }
                : e
            ),
          }))
        );
        return { removed: false };
      } catch {
        setTournaments(prevTournaments);
      } finally {
        setVoteLoading(null);
      }
    },
    [tournaments, userId]
  );

  const couldPlace: CouldPlaceAlert | null = computeCouldPlace(tournaments, userFish);

  return {
    tournaments,
    userFish,
    loading,
    refreshing,
    voteLoading,
    error,
    couldPlace,
    handleRefresh,
    handleVote,
    loadData,
  };
}

function computeCouldPlace(
  tournaments: Tournament[],
  userFish: UserFish[]
): CouldPlaceAlert | null {
  const alerts: CouldPlaceAlert[] = [];

  for (const tournament of tournaments) {
    const metricType = tournament.metricType;
    const top3 = tournament.topEntries.slice(0, 3);
    const thirdValue =
      top3.length >= 3
        ? getEntryMetricValue(top3[2], metricType)
        : undefined;

    if (metricType === 'VOTES_UP') continue;

    const matchesSpecies = (species?: string) => {
      const s = (species || '').toLowerCase();
      if (tournament.type === 'BIGGEST_FISH') return true;
      if (tournament.type === 'BIGGEST_BASS') return s.includes('bass');
      if (tournament.type === 'BIGGEST_REDFISH') return s.includes('redfish');
      if (tournament.type === 'BIGGEST_SNOOK') return s.includes('snook');
      if (tournament.type === 'BIGGEST_FLOUNDER') return s.includes('flounder');
      if (tournament.type === 'BIGGEST_STRIPER') return s.includes('striped') || s.includes('striper');
      if (tournament.type === 'SMALLEST_FISH') return !s.includes('minnow') && !s.includes('shad') && !s.includes('baitfish');
      return true;
    };

    for (const fish of userFish) {
      if (!matchesSpecies(fish.species)) continue;
      const fishValue = getFishMetric(fish, metricType, tournament.type);
      if (fishValue === undefined) continue;

      const isSmallestTournament = tournament.type === 'SMALLEST_FISH';
      let beatsThird = false;
      if (thirdValue !== undefined) {
        beatsThird = isSmallestTournament ? fishValue < thirdValue : fishValue > thirdValue;
      } else {
        beatsThird = top3.length < 3;
      }
      if (!beatsThird) continue;

      let predictedRank = 1;
      const better = (a: number, b: number) => (isSmallestTournament ? a < b : a > b);
      for (let i = 0; i < top3.length; i++) {
        const v = getEntryMetricValue(top3[i], metricType);
        if (v !== undefined && !better(fishValue, v)) {
          predictedRank = i + 2;
        } else if (v !== undefined && better(fishValue, v)) {
          predictedRank = Math.min(predictedRank, i + 1);
          break;
        }
      }
      if (predictedRank > 3) continue;

      const userMetricDisplay = formatFishMetric(fish, metricType);
      const thirdMetricDisplay =
        top3.length >= 3
          ? formatEntryMetric(top3[2], metricType)
          : '—';

      alerts.push({
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        predictedRank,
        userFish: fish,
        userFishMetricDisplay: userMetricDisplay,
        currentThirdPlaceMetric: thirdMetricDisplay,
      });
    }
  }

  if (alerts.length === 0) return null;
  // Prefer best opportunity (lowest rank)
  alerts.sort((a, b) => a.predictedRank - b.predictedRank);
  return alerts[0];
}

function getFishMetric(
  fish: UserFish,
  metricType: MetricType,
  tournamentType: TournamentType
): number | undefined {
  switch (metricType) {
    case 'WEIGHT_LBS':
      return fish.weightLbs;
    case 'LENGTH_IN':
      return fish.lengthIn;
    case 'VOTES_UP':
      return undefined; // User fish don't have votes
    default:
      return undefined;
  }
}

function formatFishMetric(fish: UserFish, metricType: MetricType): string {
  if (metricType === 'WEIGHT_LBS' && fish.weightLbs != null)
    return `${fish.weightLbs.toFixed(1)} lbs ${fish.species || 'fish'}`;
  if (metricType === 'LENGTH_IN' && fish.lengthIn != null)
    return `${fish.lengthIn.toFixed(1)} in ${fish.species || 'fish'}`;
  return fish.species || 'fish';
}

function formatEntryMetric(entry: { weightLbs?: number; lengthIn?: number; upVotes?: number }, metricType: MetricType): string {
  if (metricType === 'WEIGHT_LBS' && entry.weightLbs != null)
    return `${entry.weightLbs.toFixed(1)} lbs`;
  if (metricType === 'LENGTH_IN' && entry.lengthIn != null)
    return `${entry.lengthIn.toFixed(1)} in`;
  if (metricType === 'VOTES_UP' && entry.upVotes != null)
    return `${entry.upVotes} 👍`;
  return '—';
}
