/**
 * useTournamentResults
 * Fetches tournament_results for the current user from Supabase.
 * Provides:
 *   - allResults  — full history (for profile badges)
 *   - unseenQueue — results where seen_at IS NULL, newest first
 *   - markSeen(id) — sets seen_at = now() on a result
 *   - refresh()   — re-fetch from Supabase
 * No mock fallback — empty when Supabase returns nothing.
 */

import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';
import type { TournamentResult } from '@/src/types/tournamentResults';
import { isDev } from '@/src/lib/env';

const MOCK_RESULTS_KEY = '@Snagged/mockTournamentResults';

/** Remove duplicate results for the same win (same tournament + place, inserted within 2 min). */
function dedupeTournamentResults(results: TournamentResult[]): TournamentResult[] {
  if (results.length <= 1) return results;
  const DUPE_WINDOW_MS = 2 * 60 * 1000;
  const byKey = new Map<string, TournamentResult[]>();
  for (const r of results) {
    const key = `${r.tournament_id}:${r.place}`;
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }
  const kept: TournamentResult[] = [];
  for (const list of byKey.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let lastKeptTime = -Infinity;
    for (const r of list) {
      const t = new Date(r.created_at).getTime();
      if (t - lastKeptTime <= DUPE_WINDOW_MS) continue;
      kept.push(r);
      lastKeptTime = t;
    }
  }
  kept.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return kept;
}

/** __DEV__ only: persist a mock result locally for win-screen testing. */
export async function addMockTournamentResult(result: TournamentResult): Promise<void> {
  if (!isDev) return;
  try {
    const raw = await AsyncStorage.getItem(MOCK_RESULTS_KEY);
    const existing: TournamentResult[] = raw ? JSON.parse(raw) : [];
    const deduped = [result, ...existing.filter((r) => r.id !== result.id)];
    await AsyncStorage.setItem(MOCK_RESULTS_KEY, JSON.stringify(deduped));
  } catch {}
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

      if (error || !data) {
        setAllResults([]);
      } else {
        const raw = data as TournamentResult[];
        setAllResults(dedupeTournamentResults(raw));
      }
    } catch {
      setAllResults([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markSeen = useCallback(async (resultId: string) => {
    const seenAt = new Date().toISOString();
    setAllResults((prev) =>
      prev.map((r) => (r.id === resultId ? { ...r, seen_at: seenAt } : r))
    );

    const { error } = await supabase
      .from('tournament_results')
      .update({ seen_at: seenAt })
      .eq('id', resultId);

    if (error) {
      setAllResults((prev) =>
        prev.map((r) => (r.id === resultId ? { ...r, seen_at: null } : r))
      );
    }
  }, []);

  // Unseen results, newest first, capped at 2 per app session
  const unseenQueue = allResults
    .filter((r) => !r.seen_at)
    .slice(0, 2);

  return { allResults, unseenQueue, loading, refresh, markSeen };
}
