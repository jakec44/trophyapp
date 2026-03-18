/**
 * Live Tournament Hub types
 */

export type TournamentType =
  | 'BIGGEST_FISH'
  | 'BIGGEST_BASS'
  | 'BIGGEST_REDFISH'
  | 'BIGGEST_SNOOK'
  | 'BIGGEST_FLOUNDER'
  | 'BIGGEST_STRIPER'
  | 'BIGGEST_TARPON'
  | 'BIGGEST_TROUT'
  | 'SMALLEST_FISH';

export type MetricType = 'WEIGHT_LBS' | 'LENGTH_IN' | 'VOTES_UP';

export type UserVote = 'UP' | 'DOWN' | null;

export interface FishEntry {
  id: string;
  tournamentId?: string;
  userId: string;
  username: string;
  /** User's display name (from profile); shown on tournaments instead of username when set */
  displayName?: string | null;
  imageUrl: string;
  /** User's profile/avatar image */
  avatarUrl?: string;
  species?: string;
  weightLbs?: number;
  lengthIn?: number;
  upVotes: number;
  downVotes: number;
  userVote?: UserVote;
  createdAt: string;
  /** Supabase catch id; cleared when entry is deleted */
  logbookCatchId?: string | null;
  proVerified?: boolean;
  /** User level from total_xp (for display) */
  authorLevel?: number;
  /** Angler rating (for display) */
  authorAnglerRating?: number;
  /** Pinned badges from user_profile_display_items (for showing next to username) */
  displayItems?: Array<{
    type: string;
    id: string;
    badgeKey?: string;
    label: string;
    icon?: string;
    rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'MYTHIC';
    trophyId?: string;
    tournamentName?: string;
    place?: 1 | 2 | 3;
    imageUrl?: string;
  }>;
}

export interface Tournament {
  id: string;
  type: TournamentType;
  title: string;
  metricType: MetricType;
  endsAt?: string;
  countdown?: string;
  entrantsCount: number;
  topEntries: FishEntry[];
}

export interface UserFish {
  id: string;
  imageUrl: string;
  species?: string;
  weightLbs?: number;
  lengthIn?: number;
  createdAt: string;
}

/**
 * Get display value for an entry based on metric type
 */
export function getEntryMetricValue(
  entry: FishEntry,
  metricType: MetricType
): number | undefined {
  switch (metricType) {
    case 'WEIGHT_LBS':
      return entry.weightLbs;
    case 'LENGTH_IN':
      return entry.lengthIn;
    case 'VOTES_UP':
      return entry.upVotes;
    default:
      return undefined;
  }
}

/**
 * Get short unit label for metric type (for badges/pills)
 */
export function getMetricUnitShort(metricType: MetricType): string {
  switch (metricType) {
    case 'WEIGHT_LBS':
      return 'lbs';
    case 'LENGTH_IN':
      return 'in';
    case 'VOTES_UP':
      return '👍';
    default:
      return '';
  }
}

/**
 * Format metric for display
 */
export function formatMetric(
  value: number | undefined,
  metricType: MetricType
): string {
  if (value === undefined || value === null) {
    if (metricType === 'LENGTH_IN') return '— in';
    if (metricType === 'WEIGHT_LBS') return '— lbs';
    return '—';
  }
  switch (metricType) {
    case 'WEIGHT_LBS':
      return `${value.toFixed(1)} lbs`;
    case 'LENGTH_IN':
      return `${value.toFixed(1)} in`;
    case 'VOTES_UP':
      return `${value} 👍`;
    default:
      return String(value);
  }
}
