/**
 * Competition IDs (0-6) and how metrics are displayed.
 * Bass: weight in lbs. Redfish, Snook, and most other species: length in inches.
 */
export const COMPETITION_IDS = {
  MOST_FISH: 0,
  BIGGEST_FISH: 1,
  BIGGEST_BASS: 2,
  BIGGEST_REDFISH: 3,
  BIGGEST_SNOOK: 4,
  BIGGEST_OTHER_1: 5,
  BIGGEST_OTHER_2: 6,
} as const;

/** Species that use weight (lbs) for leaderboard display */
const WEIGHT_SPECIES = new Set([
  'bass',
  'largemouth bass',
  'smallmouth bass',
  'striped bass',
  'spotted bass',
  'black bass',
]);

/**
 * Returns whether the species uses weight (lbs) or length (inches) for display.
 * Bass = lbs, Redfish/Snook/other = length.
 */
export function usesWeightForDisplay(species: string): boolean {
  const lower = species?.toLowerCase() || '';
  return Array.from(WEIGHT_SPECIES).some((s) => lower.includes(s));
}

/**
 * Format the metric for leaderboard display.
 */
export function formatLeaderboardMetric(
  species: string,
  weightLb: number,
  lengthIn?: number | null
): { value: string; unit: string } {
  if (usesWeightForDisplay(species)) {
    return { value: weightLb.toFixed(1), unit: 'lbs' };
  }
  const len = lengthIn ?? weightLb; // fallback if only weight stored
  return { value: len.toFixed(1), unit: 'in' };
}

export const COMPETITION_LABELS: Record<number, string> = {
  [COMPETITION_IDS.MOST_FISH]: 'Most Fish',
  [COMPETITION_IDS.BIGGEST_FISH]: 'Biggest Fish',
  [COMPETITION_IDS.BIGGEST_BASS]: 'Biggest Bass',
  [COMPETITION_IDS.BIGGEST_REDFISH]: 'Biggest Redfish',
  [COMPETITION_IDS.BIGGEST_SNOOK]: 'Biggest Snook',
  [COMPETITION_IDS.BIGGEST_OTHER_1]: 'Biggest Other',
  [COMPETITION_IDS.BIGGEST_OTHER_2]: 'Biggest Other 2',
};
