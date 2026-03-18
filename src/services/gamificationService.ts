/**
 * Shared gamification helpers (no React). Used by both GamificationContext and
 * TournamentWinCheckContext to avoid a circular dependency between the two contexts.
 * Tournament win flow notifies award via notifyAward(); GamificationProvider
 * subscribes and updates XP state.
 */

export type AwardListener = (xp: number) => void;

let awardListeners: AwardListener[] = [];

export function registerAwardListener(cb: AwardListener): () => void {
  awardListeners.push(cb);
  return () => {
    awardListeners = awardListeners.filter((l) => l !== cb);
  };
}

export function notifyAward(xp: number): void {
  awardListeners.forEach((cb) => {
    try {
      cb(xp);
    } catch (e) {
      console.warn('[gamificationService] listener error:', e);
    }
  });
}
