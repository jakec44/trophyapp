import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthContext } from '@/src/context/AuthContext';
import { getUserProfile, updateUserProfile } from '@/src/lib/supabase';

const LOGBOOK_NAME_KEY = '@Snagged_logbook_name';
const FAVORITES_KEY = '@Snagged_favorites';
const FAVORITES_FILTER_KEY = '@Snagged_favorites_filter';

const DEFAULT_NAME = 'My Logbook';

export function useLogbookPrefs() {
  const { user } = useAuthContext();
  const [logbookName, setLogbookNameState] = useState(DEFAULT_NAME);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritesFilterOn, setFavoritesFilterOnState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [localName, favs, filter] = await Promise.all([
          AsyncStorage.getItem(LOGBOOK_NAME_KEY),
          AsyncStorage.getItem(FAVORITES_KEY),
          AsyncStorage.getItem(FAVORITES_FILTER_KEY),
        ]);
        if (favs) setFavoriteIds(new Set(JSON.parse(favs)));
        if (filter === 'true') setFavoritesFilterOnState(true);

        if (user?.id) {
          const profile = await getUserProfile(user.id);
          const dbName = (profile as { logbook_name?: string | null } | null)?.logbook_name;
          if (dbName && dbName.trim()) {
            setLogbookNameState(dbName.trim());
          } else if (localName && localName.trim()) {
            setLogbookNameState(localName.trim());
            await updateUserProfile(user.id, { logbook_name: localName.trim() });
          } else {
            setLogbookNameState(DEFAULT_NAME);
          }
        } else if (localName && localName.trim()) {
          setLogbookNameState(localName.trim());
        }
      } catch (_) {}
      setLoaded(true);
    })();
  }, [user?.id]);

  const setLogbookName = useCallback(async (name: string) => {
    const trimmed = name.trim() || DEFAULT_NAME;
    setLogbookNameState(trimmed);
    try {
      await AsyncStorage.setItem(LOGBOOK_NAME_KEY, trimmed);
      if (user?.id) {
        await updateUserProfile(user.id, { logbook_name: trimmed });
      }
    } catch (_) {}
  }, [user?.id]);

  const toggleFavorite = useCallback(async (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const setFavoritesFilterOn = useCallback(async (on: boolean) => {
    setFavoritesFilterOnState(on);
    try {
      await AsyncStorage.setItem(FAVORITES_FILTER_KEY, on ? 'true' : 'false');
    } catch (_) {}
  }, []);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.has(id),
    [favoriteIds]
  );

  return {
    logbookName,
    setLogbookName,
    favoriteIds,
    toggleFavorite,
    isFavorite,
    favoritesFilterOn,
    setFavoritesFilterOn,
    loaded,
  };
}
