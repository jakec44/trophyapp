/**
 * TournamentEndService (useTournamentWinCheck)
 * Single global hook for detecting ended tournaments and showing winner flow.
 * Used at app root (TournamentWinCheckProvider). Ensures winner modal + coins/XP/badge
 * trigger reliably in all cases: (A) in app when timer ends, (B) return to app after end,
 * (C) cold start after end. Award is exactly once per user per tournament (idempotent RPC).
 *
 * Detection: runs on (1) mount when auth available, (2) AppState -> active, (3) tab focus / countdown end. No background poll.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  getEndedTournamentPairsForUser,
  claimTournamentWin,
  setTrophyShown,
  type TrophyBadgeRow,
  type ClaimTournamentWinResult,
} from '@/src/lib/supabase';
import { devLog } from '@/src/lib/env';

/** No background poll — win check runs only on: mount, app foreground, tab focus, or countdown end. Prevents spam. */
/** After user dismisses a win modal, don't show another for this long (ms). */
const COOLDOWN_AFTER_DISMISS_MS = 30000;

export interface UseTournamentWinCheckOptions {
  /** Called when a new badge is awarded (server just created it). Use to sync coins/XP locally. */
  onAwarded?: (badge: TrophyBadgeRow) => void;
}

export function useTournamentWinCheck(userId: string | null, options?: UseTournamentWinCheckOptions) {
  const { onAwarded } = options ?? {};
  const [pendingBadge, setPendingBadge] = useState<TrophyBadgeRow | null>(null);
  const checkingRef = useRef(false);
  const shownBadgeIdsRef = useRef<Set<string>>(new Set());
  /** Session guard: don't attempt claim or show modal again for (tournament_id, cycle_id) already shown. */
  const shownTournamentCycleRef = useRef<Set<string>>(new Set());
  /** After dismissing a win modal, don't show another until this time (prevents spam). */
  const cooldownUntilRef = useRef<number>(0);

  const runCheck = useCallback(async (overrideOnAwarded?: (badge: TrophyBadgeRow) => void) => {
    if (!userId || checkingRef.current) return;
    if (Date.now() < cooldownUntilRef.current) return;
    checkingRef.current = true;
    try {
      const pairs = await getEndedTournamentPairsForUser(userId);
      const toClaim = pairs.filter(
        (p) => !shownTournamentCycleRef.current.has(`${p.tournamentId}:${p.endedCycleId}`)
      );
      if (toClaim.length > 0) {
        devLog('[TournamentEndService] ended (tournamentId, cycleId) to check:', toClaim.length, toClaim.map((p) => [p.tournamentId, p.endedCycleId]));
      }
      for (const { tournamentId: tid, endedCycleId } of toClaim) {
        devLog('[TournamentEndService] claiming tournamentId:', tid);
        const result: ClaimTournamentWinResult = await claimTournamentWin(tid);
        devLog('[TournamentEndService] claim RPC response:', JSON.stringify(result));
        if (result.status === 'rpc_error') {
          devLog('[TournamentEndService] RPC error (do not swallow):', result.message);
          continue;
        }
        const hasPlacement = result.status === 'awarded' || result.status === 'claimed';
        if (!hasPlacement || !result.badge) {
          devLog('[TournamentEndService] no result for user (status:', (result as { status: string }).status, ')');
          continue;
        }
        const badge = result.badge;
        const key = `${tid}:${endedCycleId}`;
        // Always mark as processed to prevent re-claiming every poll
        shownTournamentCycleRef.current.add(key);
        // Only show modal when server says badge not yet shown (shown_at null). Stops repeated popups for already-claimed wins.
        if (badge && badge.shown_at == null && !shownBadgeIdsRef.current.has(badge.id)) {
          shownBadgeIdsRef.current.add(badge.id);
          if (result.status === 'awarded') {
            devLog('[TournamentEndService] awarded:', tid, 'place', badge.place);
            (overrideOnAwarded ?? onAwarded)?.(badge);
          }
          setPendingBadge((prev) => (prev?.id === badge.id ? prev : badge));
          return;
        }
      }
    } catch (e) {
      devLog('[TournamentEndService] runCheck error:', e);
    } finally {
      checkingRef.current = false;
    }
  }, [userId, onAwarded]);

  // (1) Run immediately when auth becomes available (cold start / login)
  useEffect(() => {
    if (!userId) return;
    runCheck();
  }, [userId, runCheck]);

  // (2) Run when app returns to foreground (no interval — was causing spam for all users)
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') runCheck();
    });
    return () => sub.remove();
  }, [userId, runCheck]);

  /** Claim a specific tournament by id (e.g. when timer ends on detail screen). Retries help with server/client clock skew. */
  const runCheckForTournament = useCallback(
    async (tournamentId: string, overrideOnAwarded?: (badge: TrophyBadgeRow) => void) => {
      if (!userId) return;
      try {
        devLog('[TournamentEndService] triggerCheckForTournament claiming tournamentId:', tournamentId);
        const result: ClaimTournamentWinResult = await claimTournamentWin(tournamentId);
        devLog('[TournamentEndService] claim RPC response:', JSON.stringify(result));
        if (result.status === 'rpc_error') {
          devLog('[TournamentEndService] RPC error (do not swallow):', result.message);
          return;
        }
        if (!result.badge) {
          devLog('[TournamentEndService] no result for user (status:', (result as { status: string }).status, ')');
          return;
        }
        if (result.status === 'awarded' || result.status === 'claimed') {
          const badge = result.badge;
          if (badge && badge.shown_at == null && !shownBadgeIdsRef.current.has(badge.id)) {
            shownBadgeIdsRef.current.add(badge.id);
            if (badge.tournament_id != null && badge.cycle_id != null) {
              shownTournamentCycleRef.current.add(`${badge.tournament_id}:${badge.cycle_id}`);
            }
            if (result.status === 'awarded') (overrideOnAwarded ?? onAwarded)?.(badge);
            setPendingBadge((prev) => (prev?.id === badge.id ? prev : badge));
          }
        }
      } catch (e) {
        devLog('[TournamentEndService] runCheckForTournament error:', e);
      }
    },
    [userId, onAwarded]
  );

  const dismissWinner = useCallback(() => {
    const badge = pendingBadge;
    setPendingBadge(null);
    cooldownUntilRef.current = Date.now() + COOLDOWN_AFTER_DISMISS_MS;
    if (badge?.id) {
      setTrophyShown(badge.id).catch(() => {});
    }
  }, [pendingBadge]);

  return { pendingBadge, dismissWinner, runCheck, runCheckForTournament };
}
