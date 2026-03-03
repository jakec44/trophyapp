'use client';

import React, { createContext, useContext, ReactNode, useCallback, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useGamification } from '@/src/hooks/useGamification';
import { LevelUpModal } from '@/src/components/gamification/LevelUpModal';
import { TournamentWinQueue } from '@/src/components/competitions/TournamentWinQueue';
import { useAuthContext } from '@/src/context/AuthContext';

type GamificationContextType = ReturnType<typeof useGamification> & {
  /** Call before showing the new-species overlay so the level-up modal is suppressed. */
  holdLevelUp: () => void;
  /** Call when the new-species overlay finishes dismissing to let the level-up modal appear. */
  releaseLevelUp: (delayMs?: number) => void;
};

const GamificationContext = createContext<GamificationContextType | null>(null);

export function GamificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const gamification = useGamification(user?.id ?? null);
  const router = useRouter();

  // When true the LevelUpModal is suppressed (species screen is still visible)
  const [levelUpHeld, setLevelUpHeld] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const holdLevelUp = useCallback(() => {
    clearTimeout(holdTimerRef.current);
    setLevelUpHeld(true);
  }, []);

  const releaseLevelUp = useCallback((delayMs = 0) => {
    clearTimeout(holdTimerRef.current);
    if (delayMs > 0) {
      holdTimerRef.current = setTimeout(() => setLevelUpHeld(false), delayMs);
    } else {
      setLevelUpHeld(false);
    }
  }, []);

  const handleViewProfile = useCallback(() => {
    router.push('/(tabs)/passport');
  }, [router]);

  const handleDismissLevelUp = useCallback(() => {
    gamification.dismissLevelUp();
    setTimeout(() => {
      router.replace('/(tabs)/logbook');
    }, 300);
  }, [gamification.dismissLevelUp, router]);

  const contextValue: GamificationContextType = {
    ...gamification,
    holdLevelUp,
    releaseLevelUp,
  };

  return (
    <GamificationContext.Provider value={contextValue}>
      {children}
      {/* Only mount LevelUpModal once the species overlay has fully dismissed */}
      {!levelUpHeld && gamification.levelUpModal && (
        <LevelUpModal
          visible={!levelUpHeld && !!gamification.levelUpModal}
          fromLevel={gamification.levelUpModal.fromLevel}
          fromTitle={gamification.levelUpModal.fromTitle}
          toLevel={gamification.levelUpModal.toLevel}
          toTitle={gamification.levelUpModal.toTitle}
          toIcon={gamification.levelUpModal.toIcon}
          totalXp={gamification.levelUpModal.totalXp}
          xpInLevel={gamification.levelUpModal.xpInLevel}
          xpForNext={gamification.levelUpModal.xpForNext}
          username={user?.displayName ?? user?.username ?? 'Angler'}
          onDismiss={handleDismissLevelUp}
          onViewProfile={handleViewProfile}
        />
      )}
      <TournamentWinQueue />
    </GamificationContext.Provider>
  );
}

export function useGamificationContext() {
  const ctx = useContext(GamificationContext);
  if (!ctx) throw new Error('useGamificationContext must be used within GamificationProvider');
  return ctx;
}
