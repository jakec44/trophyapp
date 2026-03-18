/**
 * Master badge definitions — species mastery and other badge types.
 * Used by the badge collection grid to show all possible badges (locked + unlocked).
 * Per-species tiers: Tarpon and Snook have no Hunter; unlock counts vary by species.
 */

export type BadgeRarity = 'COMMON' | 'RARE' | 'EPIC' | 'MYTHIC';

export interface BadgeDefinition {
  id: string;
  name: string;
  species?: string;
  rarity: BadgeRarity;
  category: 'species';
  unlockRequirement: number;
  description: string;
  sortOrder: number;
  /** Matches species_mastery_badges.badge_key and passport id format */
  badgeKey: string;
  /** Passport species id for matching user catches */
  passportId: string;
  tier: 'hunter' | 'master' | 'elite' | 'legend';
}

/** Per-species tier config: which tiers exist and at what count. Tarpon/Snook have no Hunter. */
export const SPECIES_TIER_CONFIG: Record<
  string,
  { tier: 'hunter' | 'master' | 'elite' | 'legend'; count: number; rarity: BadgeRarity; label: string }[]
> = {
  'red-drum': [
    { tier: 'hunter', count: 3, rarity: 'COMMON', label: 'Hunter' },
    { tier: 'master', count: 6, rarity: 'RARE', label: 'Master' },
    { tier: 'elite', count: 10, rarity: 'EPIC', label: 'Elite' },
    { tier: 'legend', count: 15, rarity: 'MYTHIC', label: 'Legend' },
  ],
  snook: [
    { tier: 'master', count: 5, rarity: 'RARE', label: 'Master' },
    { tier: 'elite', count: 10, rarity: 'EPIC', label: 'Elite' },
    { tier: 'legend', count: 15, rarity: 'MYTHIC', label: 'Legend' },
  ],
  tarpon: [
    { tier: 'master', count: 5, rarity: 'RARE', label: 'Master' },
    { tier: 'elite', count: 10, rarity: 'EPIC', label: 'Elite' },
    { tier: 'legend', count: 15, rarity: 'MYTHIC', label: 'Legend' },
  ],
  'largemouth-bass': [
    { tier: 'hunter', count: 5, rarity: 'COMMON', label: 'Hunter' },
    { tier: 'master', count: 6, rarity: 'RARE', label: 'Master' },
    { tier: 'elite', count: 10, rarity: 'EPIC', label: 'Elite' },
    { tier: 'legend', count: 15, rarity: 'MYTHIC', label: 'Legend' },
  ],
};

/** Only 4 species have species mastery badges — id slug, display name, passport id */
const SPECIES_LIST = [
  { slug: 'redfish', name: 'Redfish', passportId: 'red-drum' },
  { slug: 'tarpon', name: 'Tarpon', passportId: 'tarpon' },
  { slug: 'snook', name: 'Snook', passportId: 'snook' },
  { slug: 'largemouth_bass', name: 'Largemouth Bass', passportId: 'largemouth-bass' },
];

/** Species names that map to these definitions (for awardSpeciesBadgeIfEligible lookup) */
export const DEFINED_SPECIES_PASSPORT_IDS = new Set(
  SPECIES_LIST.map((s) => s.passportId)
);

/** Get thresholds for a species (for speciesMastery). Returns empty if species not in config. */
export function getSpeciesThresholds(
  passportId: string
): { tier: 'hunter' | 'master' | 'elite' | 'legend'; count: number; rarity: BadgeRarity; label: string }[] {
  return SPECIES_TIER_CONFIG[passportId] ?? [];
}

/** Get unlock count for a specific badge key (species-{passportId}-{tier}). */
export function getSpeciesBadgeUnlockCount(badgeKey: string): number | null {
  const m = badgeKey.match(/^species-(.+?)-(hunter|master|elite|legend)$/);
  if (!m) return null;
  const [, passportId, tier] = m;
  const config = SPECIES_TIER_CONFIG[passportId];
  const entry = config?.find((e) => e.tier === tier);
  return entry?.count ?? null;
}

function buildSpeciesBadgeDefinitions(): BadgeDefinition[] {
  const defs: BadgeDefinition[] = [];
  let sortOrder = 0;
  for (const sp of SPECIES_LIST) {
    const tiers = SPECIES_TIER_CONFIG[sp.passportId];
    if (!tiers) continue;
    for (const t of tiers) {
      defs.push({
        id: `${sp.slug}_${t.tier}`,
        name: `${sp.name} ${t.label}`,
        species: sp.name,
        rarity: t.rarity,
        category: 'species',
        unlockRequirement: t.count,
        description: `Log ${t.count} ${sp.name} to unlock this badge.`,
        sortOrder: sortOrder++,
        badgeKey: `species-${sp.passportId}-${t.tier}`,
        passportId: sp.passportId,
        tier: t.tier,
      });
    }
  }
  return defs;
}

/** Species mastery badge definitions (per-species tiers; Tarpon/Snook have no Hunter) */
export const SPECIES_BADGE_DEFINITIONS = buildSpeciesBadgeDefinitions();

/** All badge definitions (species mastery; level/tournament come from other sources) */
export const BADGE_DEFINITIONS: BadgeDefinition[] = [...SPECIES_BADGE_DEFINITIONS];
