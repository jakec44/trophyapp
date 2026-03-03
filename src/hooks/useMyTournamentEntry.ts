/**
 * Hook for the current user's entry in a single tournament.
 * Uses Supabase (no Firestore). Fetches on mount and when params change.
 */

import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { getMyTournamentEntry } from '@/src/lib/tournamentDb';
import type { FishEntry } from '@/src/types/tournaments';

export function useMyTournamentEntry(
  tournamentId: string | undefined,
  userId: string | null
): { entry: FishEntry | null; loading: boolean; refetch: () => Promise<void> } {
  const [entry, setEntry] = useState<FishEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!tournamentId || !userId) {
      setEntry(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const e = await getMyTournamentEntry(tournamentId, userId);
      setEntry(e);
    } catch {
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, userId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch])
  );

  return { entry, loading, refetch: fetch };
}
