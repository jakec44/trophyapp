import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrophyTheme, MountedFish, ThemeType } from '@/src/types/trophyRoom';

const THEMES_KEY = '@Snagged_themes';
const MOUNTS_KEY = '@Snagged_mounts';

const DEFAULT_THEMES: TrophyTheme[] = [
  { id: 'fish-cabin', name: 'fish', themeType: 'fish-cabin', isPublic: true, sortOrder: 0 },
  { id: 'duck-lodge', name: 'duck lodge', themeType: 'duck-lodge', isPublic: true, sortOrder: 1 },
  { id: 'underwater', name: 'pool', themeType: 'underwater', isPublic: true, sortOrder: 2 },
];

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useTrophyRoom() {
  const [themes, setThemes] = useState<TrophyTheme[]>(DEFAULT_THEMES);
  const [mounts, setMounts] = useState<MountedFish[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [tData, mData] = await Promise.all([
          AsyncStorage.getItem(THEMES_KEY),
          AsyncStorage.getItem(MOUNTS_KEY),
        ]);
        if (tData) setThemes(JSON.parse(tData));
        if (mData) {
          const parsed = JSON.parse(mData) as MountedFish[];
          let slotCounter = 0;
          const migrated = parsed.map((m) => {
            if (m.slotIndex != null) return m;
            const idx = slotCounter < 6 ? slotCounter++ : 0;
            return { ...m, slotIndex: idx };
          });
          setMounts(migrated);
          const needsMigrate = parsed.some((m) => m.slotIndex == null);
          if (needsMigrate) AsyncStorage.setItem(MOUNTS_KEY, JSON.stringify(migrated));
        }
      } catch (_) {}
      setLoaded(true);
    })();
  }, []);

  const persistThemes = useCallback(async (next: TrophyTheme[]) => {
    setThemes(next);
    try {
      await AsyncStorage.setItem(THEMES_KEY, JSON.stringify(next));
    } catch (_) {}
  }, []);

  const persistMounts = useCallback(async (next: MountedFish[]) => {
    setMounts(next);
    try {
      await AsyncStorage.setItem(MOUNTS_KEY, JSON.stringify(next));
    } catch (_) {}
  }, []);

  const addMount = useCallback(
    (themeId: string, catchId: string, positionX: number, positionY: number, slotIndex?: number) => {
      const mount: MountedFish = {
        id: uuid(),
        themeId,
        catchId,
        slotIndex,
        positionX,
        positionY,
        scale: 1,
        rotation: 0,
      };
      setMounts((prev) => {
        const next = [...prev, mount];
        AsyncStorage.setItem(MOUNTS_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const updateMount = useCallback(
    (id: string, updates: Partial<Pick<MountedFish, 'positionX' | 'positionY' | 'scale' | 'rotation'>>) => {
      setMounts((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, ...updates } : m));
        AsyncStorage.setItem(MOUNTS_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const removeMount = useCallback((id: string) => {
    setMounts((prev) => {
      const next = prev.filter((m) => m.id !== id);
      AsyncStorage.setItem(MOUNTS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getMountsForTheme = useCallback(
    (themeId: string) => mounts.filter((m) => m.themeId === themeId),
    [mounts]
  );

  const updateTheme = useCallback(
    (id: string, updates: Partial<Pick<TrophyTheme, 'name' | 'isPublic'>>) => {
      setThemes((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
        AsyncStorage.setItem(THEMES_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const addTheme = useCallback((themeType: ThemeType, name: string) => {
    const theme: TrophyTheme = {
      id: uuid(),
      name,
      themeType,
      isPublic: true,
      sortOrder: themes.length,
    };
    setThemes((prev) => {
      const next = [...prev, theme];
      AsyncStorage.setItem(THEMES_KEY, JSON.stringify(next));
      return next;
    });
  }, [themes.length]);

  return {
    themes,
    mounts,
    loaded,
    addMount,
    updateMount,
    removeMount,
    getMountsForTheme,
    updateTheme,
    addTheme,
  };
}
