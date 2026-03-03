/**
 * Competitive ranking data for LIVE POSITION, rivals, people around you.
 * TODO: Wire to Supabase when backend supports rank tracking.
 */

export interface LivePositionData {
  rank: number;
  totalCompetitors: number;
  rankChangeSinceYesterday: number; // positive = up, negative = down
  voteDelta24h?: number;
  updatedAt: string; // ISO
}

export interface RivalEntry {
  userId: string;
  username: string;
  avatar: string;
  rank: number;
  rankGap: number; // votes or points ahead/behind (negative = they're ahead)
  isAbove: boolean;
}

export interface LeaderboardEntryWithMovement {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  species?: string;
  weight?: number;
  length?: number;
  fishImageUrl?: string;
  votes?: number;
  rankChange?: number; // positive = moved up, negative = moved down
  voteGap?: number; // votes behind the user (if below) or ahead (if above)
  isCurrentUser?: boolean;
  isDangerZone?: boolean; // within 3 spots of passing user
}

const CURRENT_USER_ID = 'current-user';

export const mockLivePosition: LivePositionData = {
  rank: 4,
  totalCompetitors: 1247,
  rankChangeSinceYesterday: 2,
  voteDelta24h: 12,
  updatedAt: new Date().toISOString(),
};

export const mockRivals: RivalEntry[] = [
  {
    userId: 'user-3',
    username: 'TroutWhisperer',
    avatar: 'https://via.placeholder.com/80x80/C9A84C/0A0A0A?text=TW',
    rank: 3,
    rankGap: -8,
    isAbove: true,
  },
  {
    userId: 'user-5',
    username: 'WalleyeNinja',
    avatar: 'https://via.placeholder.com/80x80/C9A84C/0A0A0A?text=WN',
    rank: 5,
    rankGap: 6,
    isAbove: false,
  },
];

export const mockPeopleAroundYou: LeaderboardEntryWithMovement[] = [
  {
    rank: 2,
    userId: 'user-2',
    username: 'PikeHunter',
    avatar: 'https://via.placeholder.com/80x80/C9A84C/0A0A0A?text=PH',
    species: 'Northern Pike',
    weight: 11.8,
    fishImageUrl: 'https://via.placeholder.com/120x80/0A0A0A/C9A84C?text=Pike',
    votes: 28,
    rankChange: -1,
    voteGap: 14,
    isDangerZone: false,
  },
  {
    rank: 3,
    userId: 'user-3',
    username: 'TroutWhisperer',
    avatar: 'https://via.placeholder.com/80x80/C9A84C/0A0A0A?text=TW',
    species: 'Rainbow Trout',
    weight: 9.5,
    fishImageUrl: 'https://via.placeholder.com/120x80/0A0A0A/C9A84C?text=Trout',
    votes: 24,
    rankChange: 1,
    voteGap: 8,
    isDangerZone: true,
  },
  {
    rank: 4,
    userId: CURRENT_USER_ID,
    username: 'You',
    avatar: 'https://via.placeholder.com/80x80/87CEEB/C9A84C?text=JC',
    species: 'Largemouth Bass',
    weight: 8.7,
    fishImageUrl: 'https://via.placeholder.com/120x80/0A0A0A/C9A84C?text=Bass',
    votes: 16,
    rankChange: 2,
    isCurrentUser: true,
    isDangerZone: false,
  },
  {
    rank: 5,
    userId: 'user-5',
    username: 'WalleyeNinja',
    avatar: 'https://via.placeholder.com/80x80/C9A84C/0A0A0A?text=WN',
    species: 'Walleye',
    weight: 7.2,
    fishImageUrl: 'https://via.placeholder.com/120x80/0A0A0A/C9A84C?text=Walleye',
    votes: 10,
    rankChange: -2,
    voteGap: -6,
    isDangerZone: true,
  },
  {
    rank: 6,
    userId: 'user-6',
    username: 'RedfishRoy',
    avatar: 'https://via.placeholder.com/80x80/C9A84C/0A0A0A?text=RR',
    species: 'Redfish',
    weight: 6.8,
    fishImageUrl: 'https://via.placeholder.com/120x80/0A0A0A/C9A84C?text=Red',
    votes: 4,
    rankChange: 0,
    voteGap: -12,
    isDangerZone: false,
  },
];
