'use client';

import React, { createContext, useContext, ReactNode, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useTournamentWinCheck } from '@/src/hooks/useTournamentWinCheck';
import { useAuthContext } from '@/src/context/AuthContext';
import { notifyAward } from '@/src/services/gamificationService';
import { TournamentWinnerModal, type Position } from '@/src/components/competitions/TournamentWinnerModal';

type TournamentWinCheckContextType = {
  triggerCheck: () => void;
  /** Claim a specific tournament (e.g. when timer ends on detail screen). Retries to handle clock skew. */
  triggerCheckForTournament: (tournamentId: string) => void;
  registerProfileIcon: (measure: () => Promise<Position>) => void;
  registerTrophyIcon: (measure: () => Promise<Position>) => void;
};

const TournamentWinCheckContext = createContext<TournamentWinCheckContextType | null>(null);

export function TournamentWinCheckProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuthContext();
  const { pendingBadge, dismissWinner, runCheck, runCheckForTournament } = useTournamentWinCheck(user?.id ?? null, {
    onAwarded: (badge) => notifyAward(badge.xp_awarded),
  });

  const retryRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const navRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatingRef = useRef(false);
  const measureProfileRef = useRef<(() => Promise<Position>) | null>(null);
  const measureTrophyRef = useRef<(() => Promise<Position>) | null>(null);

  const triggerCheck = useCallback(() => {
    runCheck();
    retryRef.current.forEach((t) => clearTimeout(t));
    retryRef.current = [setTimeout(runCheck, 3000)];
  }, [runCheck]);

  /** When timer ends on tournament detail, claim this tournament. Retry every 3s for 30s so we show win as soon as server finalizes. */
  const triggerCheckForTournament = useCallback(
    (tournamentId: string) => {
      const onAward = (badge: { xp_awarded: number }) => {
        notifyAward(badge.xp_awarded);
      };
      runCheckForTournament(tournamentId, onAward);
      retryRef.current.forEach((t) => clearTimeout(t));
      const delays = [3000, 6000, 10000, 15000, 20000, 27000]; // 3s, 6s, 10s, 15s, 20s, 27s
      retryRef.current = delays.map((delay) =>
        setTimeout(() => runCheckForTournament(tournamentId, onAward), delay)
      );
    },
    [runCheckForTournament]
  );

  const registerProfileIcon = useCallback((measure: () => Promise<Position>) => {
    measureProfileRef.current = measure;
  }, []);
  const registerTrophyIcon = useCallback((measure: () => Promise<Position>) => {
    measureTrophyRef.current = measure;
  }, []);

  const doNav = useCallback((path: '/(tabs)/profile' | '/(tabs)/tournaments') => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    dismissWinner();
    requestAnimationFrame(() => {
      try {
        router.replace(path);
      } catch (_) {}
      navRef.current = setTimeout(() => {
        navigatingRef.current = false;
        navRef.current = null;
      }, 1000);
    });
  }, [dismissWinner, router]);

  const handleViewProfile = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    dismissWinner();
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          router.replace('/(tabs)/profile');
        } catch (_) {}
        navigatingRef.current = false;
      }, 80);
    });
  }, [dismissWinner, router]);

  const handleViewTournaments = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    dismissWinner();
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          router.replace('/(tabs)/tournaments');
        } catch (_) {}
        navigatingRef.current = false;
      }, 80);
    });
  }, [dismissWinner, router]);

  useEffect(() => {
    if (pendingBadge) {
      retryRef.current.forEach((t) => clearTimeout(t));
      retryRef.current = [];
    }
  }, [pendingBadge]);

  useEffect(() => () => {
    retryRef.current.forEach((t) => clearTimeout(t));
    retryRef.current = [];
    if (navRef.current) clearTimeout(navRef.current);
    navRef.current = null;
  }, []);

  return (
    <TournamentWinCheckContext.Provider value={{ triggerCheck, triggerCheckForTournament, registerProfileIcon, registerTrophyIcon }}>
      {children}
      <TournamentWinnerModal
        visible={!!pendingBadge}
        badge={pendingBadge}
        onClose={dismissWinner}
        onViewProfile={handleViewProfile}
        onViewTournaments={handleViewTournaments}
      />
    </TournamentWinCheckContext.Provider>
  );
}

export function useTournamentWinCheckContext(): TournamentWinCheckContextType | null {
  return useContext(TournamentWinCheckContext);
}
