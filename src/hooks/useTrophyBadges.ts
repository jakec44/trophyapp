/**
 * useTrophyBadges — fetch current user's trophy badges for profile display.
 */

import { useState, useCallback, useEffect } from 'react';
import { getTrophyBadges, type TrophyBadgeRow } from '@/src/lib/supabase';

export function useTrophyBadges(userId: string | null) {
  const [badges, setBadges] = useState<TrophyBadgeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setBadges([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getTrophyBadges(userId);
      setBadges(data);
    } catch {
      setBadges([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { badges, loading, refresh };
}
