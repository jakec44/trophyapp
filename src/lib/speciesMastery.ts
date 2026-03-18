/**
 * Species Mastery Badges: Hunter (3), Master (6), Elite (10), Legend (15) per species.
 * Full badge catalog: species mastery + level badges + tournament placement + mystery.
 */

import { supabase } from './supabase';
import { LEVEL_UNLOCKS, LEVEL_ROADMAP, getLevelFromXp, MAX_LEVEL } from '@/src/types/gamification';
import { findPassportSpeciesId } from './speciesMapper';
import { SPECIES_BADGE_DEFINITIONS, getSpeciesThresholds, getSpeciesBadgeUnlockCount } from './badgeDefinitions';
import {
  MYTHIC_ACHIEVEMENT_BADGES,
  getAchievementBadgeUnlockStatus,
} from './achievementBadges';

function speciesToSlug(species: string): string {
  return species.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'fish';
}

function speciesToDisplayName(species: string): string {
  const s = species.trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Count user's catches of a given species (deleted_at is null) */
export async function getUserSpeciesCount(
  userId: string,
  species: string
): Promise<number> {
  const slug = speciesToSlug(species);
  const { count, error } = await supabase
    .from('catches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .ilike('species', species.trim())
    .is('deleted_at', null);

  if (error) return 0;
  return count ?? 0;
}

export interface SpeciesBadgeUnlock {
  badgeName: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'MYTHIC';
  subtitle: string;
  badgeKey: string;
}

/** Only these species can earn Hunter/Master/Elite/Legend badges */
const ALLOWED_SPECIES_PASSPORT_IDS = new Set([
  'red-drum',       // Redfish
  'snook',
  'tarpon',
  'largemouth-bass',
]);

/** Award species mastery badge if threshold crossed and not already awarded. Returns unlock payload or null. */
export async function awardSpeciesBadgeIfEligible(
  userId: string,
  species: string
): Promise<SpeciesBadgeUnlock | null> {
  const passportId = findPassportSpeciesId(species);
  if (!passportId || !ALLOWED_SPECIES_PASSPORT_IDS.has(passportId)) return null;

  const thresholds = getSpeciesThresholds(passportId);
  if (thresholds.length === 0) return null;

  const count = await getUserSpeciesCount(userId, species);
  const displayName = speciesToDisplayName(species);

  // Check highest threshold first (e.g. Legend 15, then Elite 10, ...)
  const sorted = [...thresholds].sort((a, b) => b.count - a.count);
  for (const t of sorted) {
    if (count < t.count) continue;

    const badgeKey = `species-${passportId}-${t.tier}`;

    const { data: existing } = await supabase
      .from('species_mastery_badges')
      .select('id')
      .eq('user_id', userId)
      .eq('badge_key', badgeKey)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from('species_mastery_badges').insert({
      user_id: userId,
      species: species.trim(),
      badge_tier: t.tier,
      badge_key: badgeKey,
    });

    if (error) {
      console.error('[speciesMastery] insert failed', error);
      return null;
    }

    return {
      badgeName: `${displayName} ${t.label}`,
      rarity: t.rarity,
      subtitle: `Unlocked by logging ${t.count} ${displayName}.`,
      badgeKey,
    };
  }
  return null;
}

/** Get all species mastery badges for a user */
export async function getUserSpeciesBadges(userId: string): Promise<
  { badge_key: string; species: string; badge_tier: string; unlocked_at: string }[]
> {
  const { data, error } = await supabase
    .from('species_mastery_badges')
    .select('badge_key, species, badge_tier, unlocked_at')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as { badge_key: string; species: string; badge_tier: string; unlocked_at: string }[];
}

/** Get distinct species from user's catches */
async function getUserCaughtSpecies(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('catches')
    .select('species')
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (error) return [];
  const set = new Set<string>();
  for (const r of data ?? []) {
    const s = (r as { species: string }).species?.trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort();
}

export interface BadgeCollectionItemData {
  id: string;
  name: string;
  unlockHint: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'MYTHIC';
  icon?: string;
  place?: 1 | 2 | 3 | 4 | 5;
  unlocked: boolean;
  badgeKey: string;
  species?: string;
}

/** Level badge keys and metadata (from LEVEL_UNLOCKS where type=BADGE) */
const LEVEL_BADGES: { level: number; label: string; badgeKey: string; xpRequired: number }[] = [];
for (let l = 1; l <= MAX_LEVEL; l++) {
  const unlocks = LEVEL_UNLOCKS[l];
  if (!unlocks) continue;
  const badges = unlocks.filter((u) => u.type === 'BADGE');
  const roadmap = LEVEL_ROADMAP.find((r) => r.level === l);
  const xpRequired = roadmap?.xpRequired ?? 0;
  for (const b of badges) {
    const slug = b.label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'badge';
    LEVEL_BADGES.push({
      level: l,
      label: b.label,
      badgeKey: `level-${l}-${slug}`,
      xpRequired,
    });
  }
}

/** Tournament placement badge keys (1st–5th) */
const TOURNAMENT_BADGES = [
  { place: 1 as const, label: '1st Place', badgeKey: 'tournament-place-1', unlockHint: 'Place 1st in any tournament' },
  { place: 2 as const, label: '2nd Place', badgeKey: 'tournament-place-2', unlockHint: 'Place 2nd in any tournament' },
  { place: 3 as const, label: '3rd Place', badgeKey: 'tournament-place-3', unlockHint: 'Place 3rd in any tournament' },
  { place: 4 as const, label: '4th Place', badgeKey: 'tournament-place-4', unlockHint: 'Place 4th in any tournament' },
  { place: 5 as const, label: '5th Place', badgeKey: 'tournament-place-5', unlockHint: 'Place 5th in any tournament' },
];

/** Build full badge catalog: all possible badges, marked unlocked or locked (gray). */
export async function getBadgeCollectionItems(userId: string): Promise<BadgeCollectionItemData[]> {
  const [
    unlockedSpeciesRows,
    profile,
    tournamentPlaces,
    achievementUnlocked,
  ] = await Promise.all([
    supabase
      .from('species_mastery_badges')
      .select('badge_key, species, badge_tier')
      .eq('user_id', userId)
      .then(({ data }) => (data ?? []) as { badge_key: string; species: string; badge_tier: string }[]),
    supabase.from('profiles').select('total_xp').eq('id', userId).single(),
    supabase
      .from('tournament_results')
      .select('place')
      .eq('user_id', userId)
      .then(({ data }) => {
        const places = new Set<1 | 2 | 3 | 4 | 5>();
        for (const r of data ?? []) {
          const p = (r as { place: number }).place;
          if (p >= 1 && p <= 5) places.add(p as 1 | 2 | 3 | 4 | 5);
        }
        return places;
      }),
    getAchievementBadgeUnlockStatus(userId),
  ]);

  const xp = typeof profile?.data?.total_xp === 'number' ? profile.data.total_xp : 0;
  const { level } = getLevelFromXp(xp);

  // Map species mastery to passport id for matching (user may have logged "Redfish" -> red-drum)
  const unlockedSpeciesSet = new Set<string>();
  for (const row of unlockedSpeciesRows) {
    unlockedSpeciesSet.add(row.badge_key);
  }

  const result: BadgeCollectionItemData[] = [];

  // 0. Mythic achievement badges — shown first
  for (const ab of MYTHIC_ACHIEVEMENT_BADGES) {
    result.push({
      id: ab.id,
      name: ab.name,
      unlockHint: ab.description,
      rarity: 'MYTHIC',
      unlocked: achievementUnlocked.has(ab.badgeKey),
      badgeKey: ab.badgeKey,
    });
  }

  // 1. Level badges (8) — unlocked if user has reached that level
  for (const lb of LEVEL_BADGES) {
    const unlocked = level >= lb.level;
    const icon = LEVEL_ROADMAP[lb.level - 1]?.icon ?? '🎖️';
    result.push({
      id: lb.badgeKey,
      name: lb.label,
      unlockHint: unlocked ? `Level ${lb.level} reached` : `Reach level ${lb.level} (${lb.xpRequired} XP)`,
      rarity: lb.level <= 4 ? 'COMMON' : lb.level <= 8 ? 'RARE' : lb.level <= 12 ? 'EPIC' : 'MYTHIC',
      icon,
      unlocked,
      badgeKey: lb.badgeKey,
    });
  }

  // 2. Tournament placement badges (5)
  for (const tb of TOURNAMENT_BADGES) {
    const unlocked = tournamentPlaces.has(tb.place);
    const rarity = tb.place === 1 ? 'MYTHIC' : tb.place === 2 ? 'EPIC' : tb.place === 3 ? 'RARE' : 'COMMON';
    result.push({
      id: tb.badgeKey,
      name: tb.label,
      unlockHint: tb.unlockHint,
      rarity,
      place: tb.place,
      unlocked,
      badgeKey: tb.badgeKey,
    });
  }

  // 3. Species mastery — 4 species only (Redfish, Snook, Tarpon, Largemouth Bass)
  for (const def of SPECIES_BADGE_DEFINITIONS) {
    const tier = def.badgeKey.split('-').pop();
    const unlocked =
      unlockedSpeciesSet.has(def.badgeKey) ||
      unlockedSpeciesRows.some(
        (r) => findPassportSpeciesId(r.species) === def.passportId && r.badge_tier === tier
      );
    result.push({
      id: def.id,
      name: def.name,
      unlockHint: `Catch ${def.unlockRequirement} ${def.species ?? def.name.split(' ')[0]}`,
      rarity: def.rarity,
      unlocked,
      badgeKey: def.badgeKey,
      species: def.species,
    });
  }

  // Sort: unlocked first, then locked. Within same status, keep order (level, tournament, species)
  result.sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return 0;
  });

  // Dev only: treat all badges as unlocked so you can tap and test every one
  if (__DEV__) {
    return result.map((item) => ({ ...item, unlocked: true }));
  }

  return result;
}

/** Catch data for badge unlock display */
export interface UnlockCatch {
  id: string;
  species?: string;
  photo_url?: string | null;
  photo_path?: string | null;
  weight_lb?: number;
  length_in?: number | null;
  taken_at?: string | null;
}

/** Fetch catches that contributed to a badge unlock (for display in BadgeDetailModal). */
export async function getUnlockCatchesForBadge(
  userId: string,
  badgeKey: string,
  unlocked: boolean
): Promise<UnlockCatch[]> {
  if (!unlocked) return [];

  // Species mastery: species-{passportId}-{tier}
  const speciesMatch = badgeKey.match(/^species-(.+?)-(hunter|master|elite|legend)$/);
  if (speciesMatch) {
    const threshold = getSpeciesBadgeUnlockCount(badgeKey) ?? 3;
    const { data } = await supabase
      .from('catches')
      .select('id, species, photo_url, photo_path, weight_lb, length_in, taken_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('taken_at', { ascending: false })
      .limit(200);

    const rows = (data ?? []) as UnlockCatch[];
    const [, passportId] = speciesMatch;
    const matching = rows.filter((r) => findPassportSpeciesId(r.species ?? '') === passportId);
    return matching.slice(0, threshold);
  }

  // Achievement badges
  if (badgeKey === 'achievement-40-club') {
    const { data } = await supabase
      .from('catches')
      .select('id, species, photo_url, photo_path, weight_lb, length_in, taken_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('length_in', 40)
      .order('length_in', { ascending: false })
      .limit(1);
    return (data ?? []) as UnlockCatch[];
  }
  if (badgeKey === 'achievement-50-club') {
    const { data } = await supabase
      .from('catches')
      .select('id, species, photo_url, photo_path, weight_lb, length_in, taken_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('length_in', 50)
      .order('length_in', { ascending: false })
      .limit(1);
    return (data ?? []) as UnlockCatch[];
  }
  if (badgeKey === 'achievement-trophy-hunter') {
    const { data } = await supabase
      .from('catches')
      .select('id, species, photo_url, photo_path, weight_lb, length_in, taken_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('length_in', 30)
      .order('length_in', { ascending: false })
      .limit(3);
    return (data ?? []) as UnlockCatch[];
  }
  if (badgeKey === 'achievement-grand-slam-legend') {
    const { data } = await supabase
      .from('catches')
      .select('id, species, photo_url, photo_path, weight_lb, length_in, taken_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('taken_at', { ascending: false })
      .limit(100);
    const byDay = new Map<string, UnlockCatch[]>();
    for (const c of (data ?? []) as UnlockCatch[]) {
      const day = (c.taken_at ?? '').slice(0, 10);
      if (!day) continue;
      const species = (c.species ?? '').trim().toLowerCase();
      if (!byDay.has(day)) byDay.set(day, []);
      const arr = byDay.get(day)!;
      const speciesSet = new Set(arr.map((x) => (x.species ?? '').trim().toLowerCase()));
      if (!speciesSet.has(species)) arr.push(c);
      if (arr.length >= 4) return arr;
    }
  }
  if (badgeKey === 'achievement-century-angler' || badgeKey === 'achievement-species-collector') {
    const { data } = await supabase
      .from('catches')
      .select('id, species, photo_url, photo_path, weight_lb, length_in, taken_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('taken_at', { ascending: false })
      .limit(10);
    return (data ?? []) as UnlockCatch[];
  }

  return [];
}

/** Get display name and unlock hint for a badge key (for profile/other-user views). */
export function getBadgeDisplayInfo(badgeKey: string): { name: string; unlockHint: string; rarity: 'COMMON' | 'RARE' | 'EPIC' | 'MYTHIC' } {
  if (badgeKey.startsWith('species-')) {
    const m = badgeKey.match(/^species-(.+?)-(hunter|master|elite|legend)$/);
    const speciesName = m
      ? m[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Fish';
    const tier = m ? m[2].charAt(0).toUpperCase() + m[2].slice(1) : '';
    const count = getSpeciesBadgeUnlockCount(badgeKey) ?? 3;
    const def = SPECIES_BADGE_DEFINITIONS.find((d) => d.badgeKey === badgeKey);
    const rarity = def?.rarity ?? 'COMMON';
    return {
      name: `${speciesName} ${tier}`,
      unlockHint: `Unlocked by logging ${count} ${speciesName}.`,
      rarity,
    };
  }
  if (badgeKey.startsWith('level-')) {
    const m = badgeKey.match(/^level-(\d+)-/);
    const level = m ? m[1] : '?';
    const rarity = m ? (parseInt(m[1], 10) <= 4 ? 'COMMON' : parseInt(m[1], 10) <= 8 ? 'RARE' : parseInt(m[1], 10) <= 12 ? 'EPIC' : 'MYTHIC') : 'COMMON';
    return {
      name: badgeKey.replace(/^level-\d+-/, '').replace(/-/g, ' ') || 'Level Badge',
      unlockHint: `Unlocked at Level ${level}.`,
      rarity,
    };
  }
  if (badgeKey.startsWith('achievement-')) {
    const def = MYTHIC_ACHIEVEMENT_BADGES.find((a) => a.badgeKey === badgeKey);
    if (def) return { name: def.name, unlockHint: def.description, rarity: 'MYTHIC' };
  }
  if (badgeKey === 'tournament-place-1') return { name: '1st Place', unlockHint: 'Place 1st in any tournament.', rarity: 'MYTHIC' };
  if (badgeKey === 'tournament-place-2') return { name: '2nd Place', unlockHint: 'Place 2nd in any tournament.', rarity: 'EPIC' };
  if (badgeKey === 'tournament-place-3') return { name: '3rd Place', unlockHint: 'Place 3rd in any tournament.', rarity: 'RARE' };
  if (badgeKey === 'tournament-place-4') return { name: '4th Place', unlockHint: 'Place 4th in any tournament.', rarity: 'COMMON' };
  if (badgeKey === 'tournament-place-5') return { name: '5th Place', unlockHint: 'Place 5th in any tournament.', rarity: 'COMMON' };
  return { name: 'Badge', unlockHint: '', rarity: 'COMMON' };
}
