/**
 * Mythic achievement badges — Monster Catch, Tournament, Social.
 * Unlock status computed from catches, tournament_results, feed_posts.
 */

import { supabase } from './supabase';

export interface AchievementBadgeDef {
  id: string;
  name: string;
  description: string;
  badgeKey: string;
  category: 'monster' | 'tournament' | 'social';
}

export const MYTHIC_ACHIEVEMENT_BADGES: AchievementBadgeDef[] = [
  // Monster Catch Mythics
  {
    id: 'grand_slam_legend',
    name: 'Grand Slam Legend',
    description: 'Catch 4 different species in one day.',
    badgeKey: 'achievement-grand-slam-legend',
    category: 'monster',
  },
  {
    id: '40_club',
    name: '40 Club',
    description: 'Log a fish over 40 inches.',
    badgeKey: 'achievement-40-club',
    category: 'monster',
  },
  {
    id: '50_club',
    name: '50 Club',
    description: 'Log a fish over 50 inches.',
    badgeKey: 'achievement-50-club',
    category: 'monster',
  },
  {
    id: 'trophy_hunter',
    name: 'Trophy Hunter',
    description: 'Log 3 fish over 30 inches.',
    badgeKey: 'achievement-trophy-hunter',
    category: 'monster',
  },
  // Tournament Mythics
  {
    id: 'champion_of_the_water',
    name: 'Champion of the Water',
    description: 'Win 3 tournaments.',
    badgeKey: 'achievement-champion-of-the-water',
    category: 'tournament',
  },
  {
    id: 'century_angler',
    name: 'Century Angler',
    description: 'Log 100 fish total.',
    badgeKey: 'achievement-century-angler',
    category: 'tournament',
  },
  {
    id: 'species_collector',
    name: 'Species Collector',
    description: 'Log 10 different species.',
    badgeKey: 'achievement-species-collector',
    category: 'tournament',
  },
  {
    id: 'hall_of_fame',
    name: 'Hall of Fame',
    description: 'Win 10 tournaments.',
    badgeKey: 'achievement-hall-of-fame',
    category: 'tournament',
  },
  // Social Mythics
  {
    id: 'crowd_favorite',
    name: 'Crowd Favorite',
    description: 'Receive 1,000 total hypes/likes.',
    badgeKey: 'achievement-crowd-favorite',
    category: 'social',
  },
  {
    id: 'viral_catch',
    name: 'Viral Catch',
    description: 'One catch gets 100+ hypes.',
    badgeKey: 'achievement-viral-catch',
    category: 'social',
  },
];

/** Compute which achievement badges the user has unlocked */
export async function getAchievementBadgeUnlockStatus(
  userId: string
): Promise<Set<string>> {
  const unlocked = new Set<string>();

  const [
    catchesRes,
    tournamentWinsRes,
    feedHypesRes,
  ] = await Promise.all([
    supabase
      .from('catches')
      .select('species, length_in, taken_at')
      .eq('user_id', userId)
      .is('deleted_at', null),
    supabase
      .from('tournament_results')
      .select('place')
      .eq('user_id', userId)
      .eq('place', 1),
    supabase
      .from('feed_posts')
      .select('id, hype_count')
      .eq('user_id', userId),
  ]);

  const catches = (catchesRes.data ?? []) as { species: string; length_in: number | null; taken_at: string | null }[];
  const wins = tournamentWinsRes.data?.length ?? 0;
  const posts = (feedHypesRes.data ?? []) as { id: string; hype_count: number }[];

  // Grand Slam Legend: 4 species in one day
  const byDate = new Map<string, Set<string>>();
  for (const c of catches) {
    const day = (c.taken_at ?? '').slice(0, 10);
    if (!day) continue;
    if (!byDate.has(day)) byDate.set(day, new Set());
    byDate.get(day)!.add(c.species.trim().toLowerCase());
  }
  for (const species of byDate.values()) {
    if (species.size >= 4) {
      unlocked.add('achievement-grand-slam-legend');
      break;
    }
  }

  // 40 Club
  if (catches.some((c) => (c.length_in ?? 0) >= 40)) unlocked.add('achievement-40-club');

  // 50 Club
  if (catches.some((c) => (c.length_in ?? 0) >= 50)) unlocked.add('achievement-50-club');

  // Trophy Hunter: 3 fish over 30"
  const over30 = catches.filter((c) => (c.length_in ?? 0) >= 30).length;
  if (over30 >= 3) unlocked.add('achievement-trophy-hunter');

  // Champion of the Water
  if (wins >= 3) unlocked.add('achievement-champion-of-the-water');

  // Century Angler
  if (catches.length >= 100) unlocked.add('achievement-century-angler');

  // Species Collector
  const distinctSpecies = new Set(catches.map((c) => c.species.trim().toLowerCase()));
  if (distinctSpecies.size >= 10) unlocked.add('achievement-species-collector');

  // Hall of Fame
  if (wins >= 10) unlocked.add('achievement-hall-of-fame');

  // Crowd Favorite: 1000 total hypes on user's posts
  const totalHypes = posts.reduce((s, p) => s + (p.hype_count ?? 0), 0);
  if (totalHypes >= 1000) unlocked.add('achievement-crowd-favorite');

  // Viral Catch: one post with 100+ hypes
  if (posts.some((p) => (p.hype_count ?? 0) >= 100)) unlocked.add('achievement-viral-catch');

  return unlocked;
}
