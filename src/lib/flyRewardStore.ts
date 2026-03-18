/**
 * In-memory store for fly-in reward animation when navigating from tournament win to profile.
 * Avoids passing params through router (which can cause crashes with tabs).
 */

let pending: { xp: number } | null = null;

export function setPendingFlyReward(reward: { xp: number } | null): void {
  pending = reward;
}

export function consumePendingFlyReward(): { xp: number } | null {
  const r = pending;
  pending = null;
  return r;
}
