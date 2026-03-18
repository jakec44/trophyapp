/**
 * Mock users for Leaderboard and Tournaments so you can preview badge/level display.
 * Set ENABLE_MOCK_USERS to false to remove all mock data (easily deletable).
 */
import type { AnglerLeaderboardRow } from '@/src/lib/supabase';
import type { FishEntry } from '@/src/types/tournaments';
import type { ProfileDisplayItem } from '@/src/lib/supabase';

/** Set to true only for dev preview (leaderboard + tournaments). Production: false so real users see real rankings only. */
export const ENABLE_MOCK_USERS = false;

const MOCK_PREFIX = 'mock-leaderboard-';
const avatar = (id: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`;

/** 10 mock leaderboard rows with varied levels/badges for UI testing */
export function getMockLeaderboardRows(): AnglerLeaderboardRow[] {
  if (!ENABLE_MOCK_USERS) return [];
  const names = [
    { display_name: 'River King', username: 'river_king', state: 'FL', ar: 892, wins: 3, podiums: 8 },
    { display_name: 'Bass Master', username: 'bass_master', state: 'TX', ar: 865, wins: 2, podiums: 6 },
    { display_name: 'Salty Dog', username: 'salty_dog', state: 'LA', ar: 841, wins: 1, podiums: 5 },
    { display_name: 'Reel Deal', username: 'reel_deal', state: 'FL', ar: 818, wins: 0, podiums: 4 },
    { display_name: 'Hook Line', username: 'hook_line', state: 'GA', ar: 795, wins: 1, podiums: 3 },
    { display_name: 'Lure Legend', username: 'lure_legend', state: 'SC', ar: 772, wins: 0, podiums: 2 },
    { display_name: 'Trophy Hunter', username: 'trophy_hunter', state: 'NC', ar: 748, wins: 0, podiums: 1 },
    { display_name: 'Catch Queen', username: 'catch_queen', state: 'FL', ar: 721, wins: 0, podiums: 0 },
    { display_name: 'Bait Boss', username: 'bait_boss', state: 'AL', ar: 698, wins: 0, podiums: 0 },
    { display_name: 'Line Sinker', username: 'line_sinker', state: 'MS', ar: 672, wins: 0, podiums: 0 },
  ];
  return names.map((n, i) => ({
    rank: i + 1,
    id: `${MOCK_PREFIX}${i + 1}`,
    username: n.username,
    display_name: n.display_name,
    avatar_url: avatar(`${MOCK_PREFIX}${i + 1}`),
    state: n.state,
    angler_rating: n.ar,
    wins: n.wins,
    podiums: n.podiums,
  }));
}

/** Display items per mock user (levels, species badges, trophies) for badge/level preview */
export function getMockDisplayItemsMap(): Record<string, ProfileDisplayItem[]> {
  if (!ENABLE_MOCK_USERS) return {};
  const map: Record<string, ProfileDisplayItem[]> = {};
  // User 1: level + species + trophy
  map[`${MOCK_PREFIX}1`] = [
    { type: 'badge', id: 'mock-1-level', badgeKey: 'level-12-angler', label: 'Level 12', icon: '🎖️' },
    { type: 'badge', id: 'mock-1-species', badgeKey: 'species-redfish-elite', label: 'Redfish Elite', icon: '🎖️', rarity: 'EPIC' },
    { type: 'trophy', id: 'mock-1-trophy', trophyId: 't1', tournamentName: 'Biggest Fish', place: 1 },
  ];
  // User 2: level + 2 species
  map[`${MOCK_PREFIX}2`] = [
    { type: 'badge', id: 'mock-2-level', badgeKey: 'level-10-angler', label: 'Level 10', icon: '🎖️' },
    { type: 'badge', id: 'mock-2-s1', badgeKey: 'species-largemouth-bass-master', label: 'Bass Master', icon: '🎖️', rarity: 'RARE' },
    { type: 'badge', id: 'mock-2-s2', badgeKey: 'species-snook-hunter', label: 'Snook Hunter', icon: '🎖️', rarity: 'COMMON' },
  ];
  // User 3: trophy 2nd + 3rd
  map[`${MOCK_PREFIX}3`] = [
    { type: 'trophy', id: 'mock-3-t2', trophyId: 't2', tournamentName: 'Redfish', place: 2 },
    { type: 'trophy', id: 'mock-3-t3', trophyId: 't3', tournamentName: 'Bass', place: 3 },
    { type: 'badge', id: 'mock-3-level', badgeKey: 'level-8-angler', label: 'Level 8', icon: '🎖️' },
  ];
  // Users 4–7: mix of level and species
  map[`${MOCK_PREFIX}4`] = [
    { type: 'badge', id: 'mock-4-l', badgeKey: 'level-7-angler', label: 'Level 7', icon: '🎖️' },
    { type: 'badge', id: 'mock-4-s', badgeKey: 'species-tarpon-master', label: 'Tarpon Master', icon: '🎖️', rarity: 'RARE' },
  ];
  map[`${MOCK_PREFIX}5`] = [
    { type: 'badge', id: 'mock-5-l', badgeKey: 'level-6-angler', label: 'Level 6', icon: '🎖️' },
    { type: 'trophy', id: 'mock-5-t', trophyId: 't5', tournamentName: 'Snook', place: 1 },
  ];
  map[`${MOCK_PREFIX}6`] = [
    { type: 'badge', id: 'mock-6-l', badgeKey: 'level-5-angler', label: 'Level 5', icon: '🎖️' },
  ];
  map[`${MOCK_PREFIX}7`] = [
    { type: 'badge', id: 'mock-7-s', badgeKey: 'species-flounder-hunter', label: 'Flounder Hunter', icon: '🎖️', rarity: 'COMMON' },
    { type: 'badge', id: 'mock-7-l', badgeKey: 'level-4-angler', label: 'Level 4', icon: '🎖️' },
  ];
  // 8–10: minimal or none
  map[`${MOCK_PREFIX}8`] = [
    { type: 'badge', id: 'mock-8-l', badgeKey: 'level-3-angler', label: 'Level 3', icon: '🎖️' },
  ];
  map[`${MOCK_PREFIX}9`] = [
    { type: 'badge', id: 'mock-9-l', badgeKey: 'level-2-angler', label: 'Level 2', icon: '🎖️' },
  ];
  map[`${MOCK_PREFIX}10`] = [];
  return map;
}

/** 10 mock tournament entries (for Tournaments tab) with display items */
export function getMockTournamentEntries(tournamentId: string, metricType: 'WEIGHT_LBS' | 'LENGTH_IN' = 'WEIGHT_LBS'): FishEntry[] {
  if (!ENABLE_MOCK_USERS) return [];
  const displayMap = getMockDisplayItemsMap();
  const rows = getMockLeaderboardRows();
  const placeholders = [
    'https://via.placeholder.com/400x300/0d2132/00e5c8?text=Mock+Fish',
    'https://via.placeholder.com/400x300/0d2132/C9A84C?text=Catch',
    'https://via.placeholder.com/400x300/0d2132/3B82F6?text=Fish',
  ];
  return rows.map((r, i) => ({
    id: `mock-entry-${tournamentId}-${i + 1}`,
    tournamentId,
    userId: r.id,
    username: r.username ?? r.display_name ?? 'Angler',
    displayName: r.display_name,
    imageUrl: placeholders[i % placeholders.length],
    avatarUrl: r.avatar_url ?? undefined,
    species: ['Redfish', 'Bass', 'Snook', 'Tarpon', 'Flounder', 'Trout', 'Snook', 'Bass', 'Redfish', 'Tarpon'][i],
    weightLbs: 12.5 - i * 0.7,
    lengthIn: 28 - i * 1.5,
    upVotes: 10 - i,
    downVotes: 0,
    createdAt: new Date().toISOString(),
    displayItems: displayMap[r.id] ?? [],
  }));
}

export function isMockUserId(id: string): boolean {
  return typeof id === 'string' && id.startsWith(MOCK_PREFIX);
}
