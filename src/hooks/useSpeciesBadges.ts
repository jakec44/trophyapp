/**
 * Fetches species mastery badges for the badge picker / display sheet.
 */

import { useState, useCallback, useEffect } from 'react';
import { getUserSpeciesBadges } from '@/src/lib/speciesMastery';
import type { EarnedBadgeItem } from '@/src/components/profile/ProfileHeader';

function speciesToDisplayName(species: string): string {
  const s = species.trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function tierToLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function useSpeciesBadges(userId: string | null) {
  const [badges, setBadges] = useState<EarnedBadgeItem[]>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setBadges([]);
      return;
    }
    const rows = await getUserSpeciesBadges(userId);
    const list: EarnedBadgeItem[] = rows.map((r) => ({
      id: r.badge_key,
      label: `${speciesToDisplayName(r.species)} ${tierToLabel(r.badge_tier)}`,
      icon: '🎖️',
    }));
    setBadges(list);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { badges, refresh: load };
}
