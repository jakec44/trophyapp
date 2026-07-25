/**
 * Shared gamification helpers (no React).
 * Trophies are earned by logging fish. Tournament award notifications are ignored.
 */

export type AwardListener = (xp: number) => void;

let awardListeners: AwardListener[] = [];

export function registerAwardListener(cb: AwardListener): () => void {
  awardListeners.push(cb);
  return () => {
    awardListeners = awardListeners.filter((l) => l !== cb);
  };
}

/** @deprecated Tournament trophies removed — no-op. Use catch logging to award trophies. */
export function notifyAward(_xp: number): void {
  // Intentionally empty: trophies come from logging fish, not tournament placements.
}
