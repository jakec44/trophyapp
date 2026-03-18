/**
 * Persists which badge IDs the user has chosen to display on profile (max 3).
 */

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@Snagged/displayBadgeIds';
const MAX_DISPLAY = 3;

export function useDisplayBadges(userId: string | undefined) {
  const [displayedIds, setDisplayedIdsState] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const raw = await AsyncStorage.getItem(`${STORAGE_KEY}/${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        setDisplayedIdsState(Array.isArray(parsed) ? parsed.slice(0, MAX_DISPLAY) : []);
      } else {
        setDisplayedIdsState([]);
      }
    } catch {
      setDisplayedIdsState([]);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const setDisplayedIds = useCallback(
    async (ids: string[]) => {
      const next = ids.slice(0, MAX_DISPLAY);
      setDisplayedIdsState(next);
      if (userId) {
        try {
          await AsyncStorage.setItem(`${STORAGE_KEY}/${userId}`, JSON.stringify(next));
        } catch (e) {
          console.warn('Failed to save display badges', e);
        }
      }
    },
    [userId]
  );

  return { displayedIds, setDisplayedIds, load, maxDisplay: MAX_DISPLAY };
}
