/**
 * useTournamentResults
 * Fetches tournament_results for the current user from Supabase.
 * Provides:
 *   - allResults  — full history (for profile badges)
 *   - unseenQueue — results where seen_at IS NULL, newest first
 *   - markSeen(id) — sets seen_at = now() on a result
 *   - refresh()   — re-fetch from Supabase
 *
 * Falls back to local mock data when Supabase returns nothing (dev mode).
 */

import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';
import type { TournamentResult } from '@/src/types/tournamentResults';

const MOCK_RESULTS_KEY = '@Snagged/mockTournamentResults';

// ── Dev-mode helpers ─────────────────────────────────────────────────────────

/** Persist a mock result locally so it survives reloads during development. */
export async function addMockTournamentResult(result: TournamentResult): Promise<void> {
  const raw = await AsyncStorage.getItem(MOCK_RESULTS_KEY);
  const existing: TournamentResult[] = raw ? JSON.parse(raw) : [];
  // Deduplicate by id
  const deduped = [result, ...existing.filter((r) => r.id !== result.id)];
  await AsyncStorage.setItem(MOCK_RESULTS_KEY, JSON.stringify(deduped));
}

async function loadMockResults(): Promise<TournamentResult[]> {
  try {
    const raw = await AsyncStorage.getItem(MOCK_RESULTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTournamentResults(userId: string | null) {
  const [allResults, setAllResults] = useState<TournamentResult[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setAllResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tournament_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        // Fall back to local mock data (dev)
        const mock = await loadMockResults();
        setAllResults(mock.filter((r) => r.user_id === userId));
      } else {
        setAllResults(data as TournamentResult[]);
      }
    } catch {
      const mock = await loadMockResults();
      setAllResults(mock.filter((r) => r.user_id === userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markSeen = useCallback(async (resultId: string) => {
    const seenAt = new Date().toISOString();

    // Optimistic update
    setAllResults((prev) =>
      prev.map((r) => (r.id === resultId ? { ...r, seen_at: seenAt } : r))
    );

    // Try Supabase first
    const { error } = await supabase
      .from('tournament_results')
      .update({ seen_at: seenAt })
      .eq('id', resultId);

    if (error) {
      // Fall back: update in AsyncStorage mock
      const mock = await loadMockResults();
      const updated = mock.map((r) => (r.id === resultId ? { ...r, seen_at: seenAt } : r));
      await AsyncStorage.setItem(MOCK_RESULTS_KEY, JSON.stringify(updated));
    }
  }, []);

  // Unseen results, newest first, capped at 2 per app session
  const unseenQueue = allResults
    .filter((r) => !r.seen_at)
    .slice(0, 2);

  return { allResults, unseenQueue, loading, refresh, markSeen };
}
