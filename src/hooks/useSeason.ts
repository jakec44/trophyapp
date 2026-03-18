/**
 * Current season info for leaderboard/UI: name, days remaining.
 */

import { useState, useCallback, useEffect } from 'react';
import { getCurrentSeason, type SeasonInfo } from '@/src/lib/supabase';

export function useSeason() {
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getCurrentSeason();
      setSeason(s);
    } catch (e) {
      console.error('[useSeason]', e);
      setSeason(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { season, loading, refresh };
}
