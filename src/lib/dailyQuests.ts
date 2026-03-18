/**
 * Daily quests: progress tracking and definitions.
 * Quests: Log 3 species (+200 XP), Log 5 fish (+200 XP), Enter a tournament (+150 XP).
 * Resets every 24h at 6:00 AM local time.
 */

import { supabase } from './supabase';

const RESET_HOUR = 6; // 6:00 AM local

/** Next 6:00 AM local (today or tomorrow) */
export function getNextResetAt(): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), RESET_HOUR, 0, 0, 0);
  return now < today ? today : new Date(today.getTime() + 24 * 60 * 60 * 1000);
}

/** Format ms until target as "Xh Xm" or "Xm Xs" */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m 0s';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h >= 1) return `${h}h ${m}m`;
  if (m >= 1) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Quest date key for current period (6 AM boundary). Before 6 AM = yesterday's date. Uses local date. */
export function getQuestDateKey(): string {
  const now = new Date();
  const reset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), RESET_HOUR, 0, 0, 0);
  const d = now < reset ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : now;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DAILY_QUEST_IDS = {
  LOG_3_SPECIES: 'log_3_species',
  LOG_5_FISH: 'log_5_fish',
  ENTER_TOURNAMENT: 'enter_tournament',
} as const;

export const DAILY_QUESTS = [
  { id: DAILY_QUEST_IDS.LOG_3_SPECIES, title: 'Log 3 species', xp: 200 },
  { id: DAILY_QUEST_IDS.LOG_5_FISH, title: 'Log 5 fish', xp: 200 },
  { id: DAILY_QUEST_IDS.ENTER_TOURNAMENT, title: 'Enter a tournament', xp: 150 },
] as const;

export type DailyQuestId = (typeof DAILY_QUEST_IDS)[keyof typeof DAILY_QUEST_IDS];

export interface DailyQuestProgressRow {
  user_id: string;
  date: string;
  fish_logged_count: number;
  species_logged: string[];
  entered_tournament: boolean;
  xp_awarded_quest_ids: string[];
  updated_at: string;
}

/** Quest date YYYY-MM-DD (uses 6 AM local boundary) */
export function getTodayKey(): string {
  return getQuestDateKey();
}

/** Fetch progress for user for the given date (default today). Creates row if missing. */
export async function getDailyProgress(
  userId: string,
  dateKey: string = getTodayKey()
): Promise<DailyQuestProgressRow | null> {
  const { data, error } = await supabase
    .from('daily_quest_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('date', dateKey)
    .maybeSingle();

  if (error) {
    console.error('[dailyQuests] getDailyProgress', error);
    return null;
  }
  return data as DailyQuestProgressRow | null;
}

/** Ensure a row exists for user/date; return it. */
async function ensureRow(userId: string, dateKey: string): Promise<DailyQuestProgressRow | null> {
  const existing = await getDailyProgress(userId, dateKey);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('daily_quest_progress')
    .insert({
      user_id: userId,
      date: dateKey,
      fish_logged_count: 0,
      species_logged: [],
      entered_tournament: false,
      xp_awarded_quest_ids: [],
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[dailyQuests] ensureRow insert', error);
    return null;
  }
  return data as DailyQuestProgressRow;
}

/** Record a new catch: increment fish count and add species if not already in list. */
export async function recordCatchForDailyQuest(
  userId: string,
  species: string,
  dateKey: string = getTodayKey()
): Promise<DailyQuestProgressRow | null> {
  const row = await ensureRow(userId, dateKey);
  if (!row) return null;

  const speciesNormalized = (species || '').trim().toLowerCase();
  const alreadyHasSpecies = row.species_logged.some((s) => s.toLowerCase() === speciesNormalized);
  const newSpeciesLog = alreadyHasSpecies ? row.species_logged : [...row.species_logged, speciesNormalized];
  const newFishCount = row.fish_logged_count + 1;

  const { data, error } = await supabase
    .from('daily_quest_progress')
    .update({
      fish_logged_count: newFishCount,
      species_logged: newSpeciesLog,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('date', dateKey)
    .select()
    .single();

  if (error) {
    console.error('[dailyQuests] recordCatchForDailyQuest', error);
    return null;
  }
  return data as DailyQuestProgressRow;
}

/** Record that the user entered a tournament today. */
export async function recordTournamentEntryForDailyQuest(
  userId: string,
  dateKey: string = getTodayKey()
): Promise<DailyQuestProgressRow | null> {
  await ensureRow(userId, dateKey);

  const { data, error } = await supabase
    .from('daily_quest_progress')
    .update({
      entered_tournament: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('date', dateKey)
    .select()
    .single();

  if (error) {
    console.error('[dailyQuests] recordTournamentEntryForDailyQuest', error);
    return null;
  }
  return data as DailyQuestProgressRow;
}

/** Mark a quest as having had XP awarded (so we don't double-award). */
export async function markQuestXpAwarded(
  userId: string,
  questId: string,
  dateKey: string = getTodayKey()
): Promise<boolean> {
  const row = await getDailyProgress(userId, dateKey);
  if (!row || row.xp_awarded_quest_ids.includes(questId)) return true;

  const newAwarded = [...row.xp_awarded_quest_ids, questId];

  const { error } = await supabase
    .from('daily_quest_progress')
    .update({
      xp_awarded_quest_ids: newAwarded,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('date', dateKey);

  if (error) {
    console.error('[dailyQuests] markQuestXpAwarded', error);
    return false;
  }
  return true;
}

export function isQuestComplete(
  progress: DailyQuestProgressRow | null,
  questId: string
): { complete: boolean; current?: number; target?: number } {
  if (!progress) {
    if (questId === DAILY_QUEST_IDS.LOG_3_SPECIES) return { complete: false, current: 0, target: 3 };
    if (questId === DAILY_QUEST_IDS.LOG_5_FISH) return { complete: false, current: 0, target: 5 };
    if (questId === DAILY_QUEST_IDS.ENTER_TOURNAMENT) return { complete: false };
    return { complete: false };
  }

  switch (questId) {
    case DAILY_QUEST_IDS.LOG_3_SPECIES: {
      const count = progress.species_logged.length;
      return { complete: count >= 3, current: count, target: 3 };
    }
    case DAILY_QUEST_IDS.LOG_5_FISH:
      return {
        complete: progress.fish_logged_count >= 5,
        current: progress.fish_logged_count,
        target: 5,
      };
    case DAILY_QUEST_IDS.ENTER_TOURNAMENT:
      return { complete: progress.entered_tournament };
    default:
      return { complete: false };
  }
}
