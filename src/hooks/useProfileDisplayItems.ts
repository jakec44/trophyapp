/**
 * Fetches and saves profile display items (pinned badges + trophies for "Trophies & Badges" row).
 */

import { useState, useCallback, useEffect } from 'react';
import {
  getProfileDisplayItems,
  getTrophiesForUser,
  saveProfileDisplayItems,
  type ProfileDisplayItem,
  type TrophyWithDetails,
} from '@/src/lib/supabase';

const MAX_DISPLAY = 3;

export function useProfileDisplayItems(userId: string | null) {
  const [items, setItems] = useState<ProfileDisplayItem[]>([]);
  const [trophies, setTrophies] = useState<TrophyWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setTrophies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [itemsRes, trophiesRes] = await Promise.all([
        getProfileDisplayItems(userId),
        getTrophiesForUser(userId),
      ]);
      setItems(itemsRes);
      setTrophies(trophiesRes);
    } catch {
      setItems([]);
      setTrophies([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (newItems: Array<{ type: 'badge'; badge_key: string } | { type: 'trophy'; trophy_id: string }>) => {
      if (!userId) return false;
      const ok = await saveProfileDisplayItems(userId, newItems.slice(0, MAX_DISPLAY));
      if (ok) await load();
      return ok;
    },
    [userId, load]
  );

  return {
    items,
    trophies,
    loading,
    refresh: load,
    save,
    maxDisplay: MAX_DISPLAY,
  };
}
