/**
 * TournamentWinQueue
 * Mount this once at the app root (inside GamificationProvider + AuthContext).
 * On mount and on AppState foreground, it:
 *   1. Fetches unseen tournament results for the current user.
 *   2. Shows TournamentWinScreen for the first unseen result.
 *   3. When the user closes it, marks it seen and shows the next (if any, max 2).
 */

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthContext } from '@/src/context/AuthContext';
import { useTournamentResults } from '@/src/hooks/useTournamentResults';
import { TournamentWinScreen } from './TournamentWinScreen';
import type { TournamentResult } from '@/src/types/tournamentResults';

export function TournamentWinQueue() {
  const { user } = useAuthContext();
  const { unseenQueue, refresh, markSeen } = useTournamentResults(user?.id ?? null);

  const [currentResult, setCurrentResult] = useState<TournamentResult | null>(null);
  // Tracks which results have already been queued this session
  const shownIds = useRef(new Set<string>());
  const appStateRef = useRef(AppState.currentState);

  // Load on mount
  useEffect(() => {
    if (user?.id) refresh();
  }, [user?.id]);

  // Listen for foreground transitions
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        if (user?.id) refresh();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [user?.id, refresh]);

  // When unseenQueue changes, show the first result not yet shown this session
  useEffect(() => {
    if (currentResult) return; // already showing one
    const next = unseenQueue.find((r) => !shownIds.current.has(r.id));
    if (next) {
      shownIds.current.add(next.id);
      setCurrentResult(next);
    }
  }, [unseenQueue, currentResult]);

  const handleClose = async () => {
    if (!currentResult) return;
    await markSeen(currentResult.id);
    setCurrentResult(null);

    // Check for the next unseen result after a small delay
    setTimeout(() => {
      const next = unseenQueue.find(
        (r) => !shownIds.current.has(r.id) && r.id !== currentResult?.id
      );
      if (next) {
        shownIds.current.add(next.id);
        setCurrentResult(next);
      }
    }, 400);
  };

  if (!currentResult) return null;

  return (
    <TournamentWinScreen
      result={currentResult}
      username={user?.displayName ?? user?.username ?? 'Angler'}
      avatarUrl={user?.avatarUrl ?? null}
      visible
      onClose={handleClose}
    />
  );
}
