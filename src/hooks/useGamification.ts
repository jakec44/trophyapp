/**
 * Central hook for gamification: XP, passport.
 * When userId is set: passport and totalCatches are derived from user's catches (Supabase).
 * When userId is null (guest): passport is empty, totalCatches from pending only.
 * Uses user-scoped AsyncStorage keys when signed in.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getLevelFromXp,
  XP_PER_CATCH,
  XP_PER_TOURNAMENT_ENTRY,
  XP_PER_PERSONAL_RECORD,
  XP_TOURNAMENT_WIN,
} from '@/src/types/gamification';

import { addMockTournamentResult } from '@/src/hooks/useTournamentResults';
import type { TournamentResult } from '@/src/types/tournamentResults';
import { getUserCatchesForPassport, syncUserXp, getUserProfile } from '@/src/lib/supabase';
import { findPassportSpeciesId } from '@/src/lib/speciesMapper';

function storageKeys(userId: string | null) {
  const prefix = userId ? `@Snagged/user/${userId}` : '@Snagged/guest';
  return {
    xp: `${prefix}/xp`,
    totalCatches: `${prefix}/totalCatches`,
    totalTournaments: `${prefix}/totalTournaments`,
    personalRecords: `${prefix}/personalRecords`,
    caughtSpecies: `${prefix}/caughtSpecies`,
    caughtSpeciesDates: `${prefix}/caughtSpeciesDates`,
  };
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useGamification(userId: string | null) {
  const keys = storageKeys(userId);
  const [xp, setXp] = useState(0);
  const [totalCatches, setTotalCatches] = useState(0);
  const [totalTournaments, setTotalTournaments] = useState(0);
  const [personalRecords, setPersonalRecords] = useState(0);
  const [caughtSpecies, setCaughtSpecies] = useState<Set<string>>(() => new Set());
  const [caughtSpeciesDates, setCaughtSpeciesDates] = useState<Record<string, string>>({});
  const [caughtSpeciesCount, setCaughtSpeciesCount] = useState<Record<string, number>>({});
  const [levelUpModal, setLevelUpModal] = useState<{
    fromLevel: number; fromTitle: string;
    toLevel: number;   toTitle: string; toIcon: string;
    totalXp: number;   xpInLevel: number; xpForNext: number;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Ref mirrors xp so addXp can always read the latest value without stale closures
  // (React 18 auto-batching means the functional updater may not have run yet when
  //  we need to write to AsyncStorage, which caused XP to be saved as 0.)
  const xpRef = useRef(0);

  // Reset when userId changes (sign-out or account switch)
  useEffect(() => {
    xpRef.current = 0;
    setXp(0);
    setCaughtSpecies(new Set());
    setCaughtSpeciesDates({});
    setCaughtSpeciesCount({});
    setLoaded(false);
  }, [userId]);

  // Load from Supabase catches when signed in; load XP from AsyncStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (userId) {
          const { data: catches, total } = await getUserCatchesForPassport(userId, 2000);
          if (cancelled) return;
          const speciesSet = new Set<string>();
          const speciesDates: Record<string, string> = {};
          const speciesCount: Record<string, number> = {};
          for (const c of catches) {
            const pid = findPassportSpeciesId(c.species || '');
            if (pid) {
              speciesSet.add(pid);
              speciesCount[pid] = (speciesCount[pid] ?? 0) + 1;
              const d = c.taken_at || c.created_at;
              if (d && (!speciesDates[pid] || d < speciesDates[pid])) {
                speciesDates[pid] = (d as string).slice(0, 10);
              }
            }
          }
          setCaughtSpecies(speciesSet);
          setCaughtSpeciesDates(speciesDates);
          setCaughtSpeciesCount(speciesCount);
          setTotalCatches(total);
        } else {
          setTotalCatches(0);
          setCaughtSpeciesCount({});
        }

        const [storedXp, storedTournaments, storedRecords] = await Promise.all([
          AsyncStorage.getItem(keys.xp),
          AsyncStorage.getItem(keys.totalTournaments),
          AsyncStorage.getItem(keys.personalRecords),
        ]);
        if (cancelled) return;

        const localXp = storedXp != null ? parseInt(storedXp, 10) : null;

        if (userId) {
          // Always check Supabase so we can recover from a corrupted local cache (e.g. saved as 0)
          const profile = await getUserProfile(userId);
          if (cancelled) return;
          const remoteXp = typeof profile?.total_xp === 'number' ? profile.total_xp : 0;
          // Use whichever is greater: local cache or remote — guards against the previous
          // bug where addXp was saving 0 to AsyncStorage on every call
          const resolvedXp = Math.max(localXp ?? 0, remoteXp);
          xpRef.current = resolvedXp;
          setXp(resolvedXp);
          await AsyncStorage.setItem(keys.xp, String(resolvedXp));
        } else if (localXp != null) {
          xpRef.current = localXp;
          setXp(localXp);
        }

        if (storedTournaments != null) setTotalTournaments(parseInt(storedTournaments, 10));
        if (storedRecords != null) setPersonalRecords(parseInt(storedRecords, 10));
      } catch {}
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [userId, keys.xp, keys.totalTournaments, keys.personalRecords]);

  // Keep Supabase total_xp in sync for level/XP display
  useEffect(() => {
    if (!userId || !loaded) return;
    syncUserXp(userId, xp).catch(() => {});
  }, [userId, xp, loaded]);

  // When app returns to foreground, reconcile XP from server (recover from missed syncs)
  useEffect(() => {
    if (!userId || !loaded) return;
    const handleAppState = (next: AppStateStatus) => {
      if (next !== 'active') return;
      getUserProfile(userId).then((profile) => {
        const remote = typeof profile?.total_xp === 'number' ? profile.total_xp : 0;
        const current = xpRef.current;
        if (remote > current) {
          xpRef.current = remote;
          setXp(remote);
          AsyncStorage.setItem(keys.xp, String(remote));
        }
      });
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [userId, loaded, keys.xp]);

  const addXp = useCallback(async (amount: number, reason?: 'levelUp') => {
    // Read from ref so we always have the latest value regardless of React's batching
    const prevSnap = xpRef.current;
    const nextSnap = prevSnap + amount;
    xpRef.current = nextSnap;
    setXp(nextSnap);
    await AsyncStorage.setItem(keys.xp, String(nextSnap));

    const prevLevel = getLevelFromXp(prevSnap);
    const nextLevel = getLevelFromXp(nextSnap);
    if (nextLevel.level > prevLevel.level && reason !== 'levelUp') {
      setLevelUpModal({
        fromLevel: prevLevel.level, fromTitle: prevLevel.title,
        toLevel:   nextLevel.level, toTitle:   nextLevel.title, toIcon: nextLevel.icon,
        totalXp:   nextSnap,        xpInLevel: nextLevel.xpInLevel, xpForNext: nextLevel.xpForNext,
      });
    }
  }, [keys.xp]);

  const onCatchLogged = useCallback(async (baseXp?: number) => {
    setTotalCatches((prev) => prev + 1);
    await addXp(baseXp ?? XP_PER_CATCH);
  }, [addXp]);

  const onTournamentEntered = useCallback(async () => {
    const newCount = totalTournaments + 1;
    setTotalTournaments(newCount);
    await AsyncStorage.setItem(keys.totalTournaments, String(newCount));
    await addXp(XP_PER_TOURNAMENT_ENTRY);
  }, [totalTournaments, addXp, keys.totalTournaments]);

  /**
   * Call when the current user places 1st–5th in a tournament.
   * Awards XP, stores a local mock result so the win screen pops up.
   */
  const onTournamentWin = useCallback(async (
    place: 1 | 2 | 3 | 4 | 5,
    tournamentId: string,
    tournamentName: string,
    entry?: {
      catchId?: string;
      fishPhotoUrl?: string;
      fishSpecies?: string;
      weightLbs?: number;
      lengthIn?: number;
      unit?: string;
    }
  ) => {
    const xpAmount = XP_TOURNAMENT_WIN[place];
    await addXp(xpAmount);

    if (!userId) return;

    const result: TournamentResult = {
      id: `local-${Date.now()}`,
      tournament_id: tournamentId,
      tournament_name: tournamentName,
      user_id: userId,
      place,
      catch_id: entry?.catchId ?? null,
      fish_photo_url: entry?.fishPhotoUrl ?? null,
      fish_species: entry?.fishSpecies ?? null,
      weight_lbs: entry?.weightLbs ?? null,
      length_in: entry?.lengthIn ?? null,
      unit: entry?.unit ?? 'in',
      xp_awarded: xpAmount,
      created_at: new Date().toISOString(),
      seen_at: null,
    };

    await addMockTournamentResult(result);
  }, [userId, addXp]);

  const onPersonalRecord = useCallback(async () => {
    const newCount = personalRecords + 1;
    setPersonalRecords(newCount);
    await AsyncStorage.setItem(keys.personalRecords, String(newCount));
    await addXp(XP_PER_PERSONAL_RECORD);
  }, [personalRecords, addXp, keys.personalRecords]);

  const addCaughtSpecies = useCallback(async (speciesId: string, dateCaught?: string) => {
    const date = dateCaught ?? getToday();
    setCaughtSpecies((prev) => {
      const next = new Set(prev);
      next.add(speciesId);
      AsyncStorage.setItem(keys.caughtSpecies, JSON.stringify([...next]));
      return next;
    });
    setCaughtSpeciesDates((prev) => {
      const next = { ...prev, [speciesId]: date };
      AsyncStorage.setItem(keys.caughtSpeciesDates, JSON.stringify(next));
      return next;
    });
    setCaughtSpeciesCount((prev) => ({
      ...prev,
      [speciesId]: (prev[speciesId] ?? 0) + 1,
    }));
  }, [keys.caughtSpecies, keys.caughtSpeciesDates]);

  /**
   * Undo a logged catch:
   * - Deducts XP (clamped to 0)
   * - Decrements totalCatches
   * - If this was the only catch of that species, removes it from passport
   */
  const removeCatch = useCallback(async (speciesId: string | null, xpToRemove: number) => {
    // Deduct XP
    const nextXp = Math.max(0, xpRef.current - xpToRemove);
    xpRef.current = nextXp;
    setXp(nextXp);
    AsyncStorage.setItem(keys.xp, String(nextXp));

    // Decrement total catches
    setTotalCatches((prev) => {
      const next = Math.max(0, prev - 1);
      return next;
    });

    // If this species still has other catches, just decrement the count
    if (!speciesId) return;
    setCaughtSpeciesCount((prevCount) => {
      const currentCount = prevCount[speciesId] ?? 0;
      const newCount = Math.max(0, currentCount - 1);
      const next = { ...prevCount, [speciesId]: newCount };

      if (newCount === 0) {
        // Last catch of this species — remove from passport
        setCaughtSpecies((prevSet) => {
          const nextSet = new Set(prevSet);
          nextSet.delete(speciesId);
          AsyncStorage.setItem(keys.caughtSpecies, JSON.stringify([...nextSet]));
          return nextSet;
        });
        setCaughtSpeciesDates((prevDates) => {
          const nextDates = { ...prevDates };
          delete nextDates[speciesId];
          AsyncStorage.setItem(keys.caughtSpeciesDates, JSON.stringify(nextDates));
          return nextDates;
        });
      }

      return next;
    });
  }, [keys.xp, keys.caughtSpecies, keys.caughtSpeciesDates]);

  const dismissLevelUp = useCallback(() => setLevelUpModal(null), []);

  /** Force sync XP from Supabase (e.g. after prestige). Overwrites local with server value. */
  const refreshXpFromServer = useCallback(async () => {
    if (!userId) return;
    const profile = await getUserProfile(userId);
    const remote = typeof profile?.total_xp === 'number' ? profile.total_xp : 0;
    xpRef.current = remote;
    setXp(remote);
    await AsyncStorage.setItem(keys.xp, String(remote));
  }, [userId, keys.xp]);

  const levelInfo = getLevelFromXp(xp);

  return {
    loaded,
    xp,
    levelInfo,
    refreshXpFromServer,
    totalCatches,
    totalTournaments,
    personalRecords,
    caughtSpecies,
    caughtSpeciesDates,
    caughtSpeciesCount,
    levelUpModal,
    addXp,
    onCatchLogged,
    onTournamentEntered,
    onTournamentWin,
    onPersonalRecord,
    addCaughtSpecies,
    removeCatch,
    dismissLevelUp,
  };
}
