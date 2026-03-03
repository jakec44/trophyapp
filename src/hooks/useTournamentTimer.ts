/**
 * Tournament countdown timer. Source of truth is always the saved endsAt (e.g. from DB).
 * Ticks locally every second so timers survive app close, refresh, and device switch.
 */

import { useState, useEffect, useMemo } from 'react';

export interface TournamentTimerState {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  totalHours: number;
  totalSeconds: number;
  ended: boolean;
}

function computeRemaining(endsAt: string): TournamentTimerState {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, end - now);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return {
    days,
    hours,
    mins,
    secs,
    totalHours: diff / (1000 * 3600),
    totalSeconds,
    ended: diff <= 0,
  };
}

export function useTournamentTimer(endsAt: string | undefined): TournamentTimerState {
  const [remaining, setRemaining] = useState<TournamentTimerState>(() =>
    endsAt ? computeRemaining(endsAt) : { days: 0, hours: 0, mins: 0, secs: 0, totalHours: 0, totalSeconds: 0, ended: true }
  );

  useEffect(() => {
    if (!endsAt) {
      setRemaining({ days: 0, hours: 0, mins: 0, secs: 0, totalHours: 0, totalSeconds: 0, ended: true });
      return;
    }
    setRemaining(computeRemaining(endsAt));
    const interval = setInterval(() => {
      setRemaining(computeRemaining(endsAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return remaining;
}

/** Format remaining time for display (e.g. "2d 5h 03m 42s") */
export function formatTournamentCountdown(state: TournamentTimerState): string {
  if (state.ended) return 'Ended';
  const parts: string[] = [];
  if (state.days > 0) parts.push(`${state.days}d`);
  parts.push(`${state.hours}h`);
  parts.push(`${String(state.mins).padStart(2, '0')}m`);
  parts.push(`${String(state.secs).padStart(2, '0')}s`);
  return parts.join(' ');
}
