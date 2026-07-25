/**
 * Species ranking options for the Rankings tab.
 * Bass/Tarpon/Catfish ranked by weight; Snook/Bluegill/Jack Crevalle by length.
 */

export const PLACEMENTS_REQUIRED = 5;

const TIER_NAMES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
const DIVISIONS = ['I', 'II', 'III'] as const;
const TROPHIES_PER_TIER = 500;
const TROPHIES_PER_DIVISION = Math.floor(TROPHIES_PER_TIER / 3);

export type SnaggedRankTier = {
  label: string;
  tierName: (typeof TIER_NAMES)[number];
  division: (typeof DIVISIONS)[number];
  trophies: number;
  nextTierLabel: string | null;
  trophiesToNext: number;
  progressInTier: number;
};

export function isRankUnlocked(catchCount: number): boolean {
  return catchCount >= PLACEMENTS_REQUIRED;
}

export function placementsRemaining(catchCount: number): number {
  return Math.max(0, PLACEMENTS_REQUIRED - catchCount);
}

export function getSnaggedRankTier(trophies: number): SnaggedRankTier {
  const t = Math.max(0, Math.floor(trophies));
  const tierIndex = Math.min(TIER_NAMES.length - 1, Math.floor(t / TROPHIES_PER_TIER));
  const withinTier = t - tierIndex * TROPHIES_PER_TIER;
  const divisionIndex = Math.min(2, Math.floor(withinTier / TROPHIES_PER_DIVISION));
  const tierName = TIER_NAMES[tierIndex];
  const division = DIVISIONS[divisionIndex];
  const label = `${tierName} ${division}`;

  const isMax = tierIndex === TIER_NAMES.length - 1 && divisionIndex === 2;
  let nextTierLabel: string | null = null;
  let trophiesToNext = 0;

  if (!isMax) {
    if (divisionIndex < 2) {
      nextTierLabel = `${tierName} ${DIVISIONS[divisionIndex + 1]}`;
      trophiesToNext = (divisionIndex + 1) * TROPHIES_PER_DIVISION - withinTier;
    } else if (tierIndex < TIER_NAMES.length - 1) {
      nextTierLabel = `${TIER_NAMES[tierIndex + 1]} I`;
      trophiesToNext = TROPHIES_PER_TIER - withinTier;
    }
  }

  return {
    label,
    tierName,
    division,
    trophies: t,
    nextTierLabel,
    trophiesToNext: Math.max(0, trophiesToNext),
    progressInTier: withinTier / TROPHIES_PER_TIER,
  };
}

export function getTierColor(tierName: (typeof TIER_NAMES)[number]): string {
  switch (tierName) {
    case 'BRONZE':
      return '#c87941';
    case 'SILVER':
      return '#a8c4d4';
    case 'GOLD':
      return '#ffc845';
    case 'PLATINUM':
      return '#b8e0ff';
    default:
      return '#c87941';
  }
}

export type SpeciesLeaderboardSpecies =
  | 'bass'
  | 'tarpon'
  | 'snook'
  | 'bluegill'
  | 'jack-crevalle'
  | 'catfish';

export const SPECIES_LEADERBOARD_OPTIONS: {
  id: SpeciesLeaderboardSpecies;
  label: string;
  unit: 'lbs' | 'in';
}[] = [
  { id: 'bass', label: 'Bass', unit: 'lbs' },
  { id: 'tarpon', label: 'Tarpon', unit: 'lbs' },
  { id: 'snook', label: 'Snook', unit: 'in' },
  { id: 'bluegill', label: 'Bluegill', unit: 'in' },
  { id: 'jack-crevalle', label: 'Jack Crevalle', unit: 'in' },
  { id: 'catfish', label: 'Catfish', unit: 'lbs' },
];

export type LeaderboardScope = 'friends' | 'global' | 'local';

export type LeaderboardCategory = 'overall' | SpeciesLeaderboardSpecies;

/** Weight-based species for rankings */
export function speciesUsesWeight(species: SpeciesLeaderboardSpecies): boolean {
  return species === 'bass' || species === 'tarpon' || species === 'catfish';
}
