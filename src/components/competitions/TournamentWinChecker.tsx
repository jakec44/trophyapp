/**
 * TournamentWinChecker
 * Runs useTournamentWinCheck on startup and foreground; shows TournamentWinnerModal
 * when user has an unshown trophy badge. On award, syncs XP via gamificationService (no GamificationContext import).
 */

import { useTournamentWinCheck } from '@/src/hooks/useTournamentWinCheck';
import { useAuthContext } from '@/src/context/AuthContext';
import { notifyAward } from '@/src/services/gamificationService';
import { TournamentWinnerModal } from './TournamentWinnerModal';

export function TournamentWinChecker() {
  const { user } = useAuthContext();
  const { pendingBadge, dismissWinner } = useTournamentWinCheck(user?.id ?? null, {
    onAwarded: (badge) => notifyAward(badge.xp_awarded),
  });

  return (
    <TournamentWinnerModal
      visible={!!pendingBadge}
      badge={pendingBadge}
      onClose={dismissWinner}
    />
  );
}
