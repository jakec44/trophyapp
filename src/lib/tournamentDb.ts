/**
 * Supabase-backed tournament entries and votes.
 * Persists tournament entries and votes to PostgreSQL.
 */

import { getProfileDisplayName, supabase } from './supabase';
import { getLevelFromXp } from '@/src/types/gamification';
import type { FishEntry, UserVote } from '@/src/types/tournaments';

export interface TournamentRow {
  id: string;
  type: string;
  title: string;
  metric_type: string;
  ends_at: string | null;
  cycle_id: number;
  cycle_starts_at: string;
  cycle_ends_at: string;
  duration_minutes: number;
  template_key: string | null;
  is_active: boolean;
}

export interface TournamentEntryRow {
  id: string;
  tournament_id: string;
  user_id: string;
  cycle_id: number;
  catch_id: string | null;
  username: string;
  avatar_url: string | null;
  image_url: string;
  species: string | null;
  weight_lb: number | null;
  length_in: number | null;
  up_votes: number;
  down_votes: number;
  user_state: string | null;
  created_at: string;
  profiles?: { name?: string | null; display_name: string | null; username?: string | null; subscription_plan?: string | null; pro_expires_at?: string | null; total_xp?: number | null; angler_rating?: number | null } | null;
}

function isPro(p: { subscription_plan?: string | null; pro_expires_at?: string | null } | null): boolean {
  if (!p || p.subscription_plan !== 'pro') return false;
  if (p.pro_expires_at && new Date(p.pro_expires_at) <= new Date()) return false;
  return true;
}

function rowToFishEntry(row: TournamentEntryRow, userVote: UserVote = null): FishEntry {
  const xp = row.profiles?.total_xp;
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    userId: row.user_id,
    username: row.username,
    displayName: getProfileDisplayName(row.profiles),
    proVerified: isPro(row.profiles),
    authorLevel: typeof xp === 'number' ? getLevelFromXp(xp).level : undefined,
    authorAnglerRating: row.profiles?.angler_rating ?? undefined,
    imageUrl: row.image_url,
    avatarUrl: row.avatar_url ?? undefined,
    species: row.species ?? undefined,
    weightLbs: row.weight_lb ?? undefined,
    lengthIn: row.length_in ?? undefined,
    upVotes: row.up_votes,
    downVotes: row.down_votes,
    userVote,
    createdAt: row.created_at,
  };
}

/** Fetch all tournament definitions. Ordered by cycle_ends_at asc for consistent countdown. */
export async function getTournaments(): Promise<TournamentRow[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, type, title, metric_type, ends_at, cycle_id, cycle_starts_at, cycle_ends_at, duration_minutes, template_key, is_active')
    .eq('is_active', true)
    .order('cycle_ends_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TournamentRow[];
}

/** Fetch a single tournament by id (one query). Use for detail screen so countdown loads fast. */
export async function getTournamentById(tournamentId: string): Promise<TournamentRow | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, type, title, metric_type, ends_at, cycle_id, cycle_starts_at, cycle_ends_at, duration_minutes, template_key, is_active')
    .eq('id', tournamentId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data as TournamentRow | null;
}

/** Fetch entries for a tournament (current cycle only), optionally filtered by user_state for local scope */
export async function getTournamentEntries(
  tournamentId: string,
  currentUserId: string | null,
  scope: 'global' | 'local',
  userState?: string,
  cycleId?: number
): Promise<FishEntry[]> {
  let cycle = cycleId;
  if (cycle === undefined) {
    const { data: tRows } = await supabase.from('tournaments').select('cycle_id').eq('id', tournamentId).limit(1);
    cycle = (tRows?.[0] as { cycle_id: number } | undefined)?.cycle_id ?? 1;
  }
  let query = supabase
    .from('tournament_entries')
    .select('*, profiles!tournament_entries_user_id_fkey(display_name, username, subscription_plan, pro_expires_at, total_xp, angler_rating)')
    .eq('tournament_id', tournamentId)
    .eq('cycle_id', cycle)
    .order('created_at', { ascending: false });

  if (scope === 'local' && userState) {
    query = query.eq('user_state', userState);
  }

  const { data: rows, error } = await query;
  if (error) throw error;

  const rowList = (rows ?? []) as TournamentEntryRow[];
  let voteByEntryId: Record<string, 'UP' | 'DOWN'> = {};
  if (currentUserId && rowList.length > 0) {
    const entryIds = rowList.map((r) => r.id);
    const { data: voteRows } = await supabase
      .from('tournament_entry_votes')
      .select('entry_id, vote')
      .eq('user_id', currentUserId)
      .in('entry_id', entryIds);
    if (voteRows?.length) {
      voteByEntryId = (voteRows as { entry_id: string; vote: string }[]).reduce(
        (acc, r) => {
          if (r.vote === 'UP' || r.vote === 'DOWN') acc[r.entry_id] = r.vote;
          return acc;
        },
        {} as Record<string, 'UP' | 'DOWN'>
      );
    }
  }

  const entries: FishEntry[] = [];
  for (const row of rowList) {
    const userVote: UserVote = voteByEntryId[row.id] ?? null;
    entries.push(rowToFishEntry(row, userVote));
  }
  return entries;
}

/** Enter a tournament. RPC replaces any existing entry for this user in the current cycle. */
export async function insertTournamentEntry(
  id: string,
  tournamentId: string,
  userId: string,
  username: string,
  fish: {
    imageUrl: string;
    species?: string;
    weightLbs?: number;
    lengthIn?: number;
  },
  options?: { catchId?: string; avatarUrl?: string; userState?: string }
): Promise<FishEntry> {
  const { data, error } = await supabase.rpc('create_tournament_entry', {
    p_id: id,
    p_tournament_id: tournamentId,
    p_catch_id: options?.catchId ?? null,
    p_username: username,
    p_avatar_url: options?.avatarUrl ?? null,
    p_image_url: fish.imageUrl ?? '',
    p_species: fish.species ?? null,
    p_weight_lb: fish.weightLbs ?? null,
    p_length_in: fish.lengthIn ?? null,
    p_user_state: options?.userState ?? null,
  });

  if (error) throw error;
  const row = data as TournamentEntryRow;
  return rowToFishEntry(row);
}

/** Vote on an entry via RPC (bypasses RLS). Shared across all users. 50%+ downvotes at 10+ votes = removal. */
export async function voteOnTournamentEntry(
  entryId: string,
  _userId: string,
  vote: UserVote
): Promise<{ upVotes: number; downVotes: number; userVote: UserVote; removed: boolean }> {
  const voteVal = vote === null ? null : vote;
  const { data, error } = await supabase.rpc('vote_on_tournament_entry', {
    p_entry_id: entryId,
    p_vote: voteVal,
  });

  if (error) throw error;
  const r = data as { upVotes: number; downVotes: number; userVote: UserVote; removed: boolean };
  return {
    upVotes: r.upVotes,
    downVotes: r.downVotes,
    userVote: r.userVote ?? voteVal,
    removed: r.removed ?? false,
  };
}

/** Delete the current user's entry in the current cycle (for withdraw flow). */
export async function deleteTournamentEntryByUser(tournamentId: string, userId: string): Promise<void> {
  const { data: tRow } = await supabase.from('tournaments').select('cycle_id').eq('id', tournamentId).limit(1).maybeSingle();
  const cycleId = (tRow as { cycle_id: number } | null)?.cycle_id ?? 1;
  const { data, error } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return;

  await deleteTournamentEntry((data as { id: string }).id, userId);
}

/** Delete a user's entry from a tournament */
export async function deleteTournamentEntry(entryId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('tournament_entries')
    .select('user_id')
    .eq('id', entryId)
    .single();

  if (error || !data) throw new Error('Entry not found');
  if ((data as { user_id: string }).user_id !== userId) throw new Error('Only the entry owner can delete it');

  await supabase.from('tournament_entry_votes').delete().eq('entry_id', entryId);
  await supabase.from('tournament_entries').delete().eq('id', entryId);
}

/** Delete any tournament entry by id. Allowed only for entry owner or moderator (RLS). Use for moderator remove-entry. */
export async function deleteTournamentEntryByEntryId(entryId: string): Promise<void> {
  const { error } = await supabase.from('tournament_entries').delete().eq('id', entryId);
  if (error) throw error;
}

/** Get current user's entry in a tournament (current cycle only). */
export async function getMyTournamentEntry(
  tournamentId: string,
  userId: string | null
): Promise<FishEntry | null> {
  if (!userId) return null;
  const { data: tRow } = await supabase.from('tournaments').select('cycle_id').eq('id', tournamentId).limit(1).maybeSingle();
  const cycleId = (tRow as { cycle_id: number } | null)?.cycle_id ?? 1;
  const { data, error } = await supabase
    .from('tournament_entries')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToFishEntry(data as TournamentEntryRow);
}

/** Check if user has an entry in a tournament (current cycle only). */
export async function isUserEnteredInTournament(
  tournamentId: string,
  userId: string
): Promise<boolean> {
  const { data: tRow } = await supabase.from('tournaments').select('cycle_id').eq('id', tournamentId).limit(1).maybeSingle();
  const cycleId = (tRow as { cycle_id: number } | null)?.cycle_id ?? 1;
  const { data, error } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
}

/** Count how many tournaments the user is entered in for the current cycle (for free-tier limit). */
export async function countUserTournamentEntries(userId: string): Promise<number> {
  const { data: entries, error: eErr } = await supabase
    .from('tournament_entries')
    .select('tournament_id, cycle_id')
    .eq('user_id', userId);
  if (eErr || !entries?.length) return 0;
  const { data: tournaments } = await supabase.from('tournaments').select('id, cycle_id');
  const currentSet = new Set((tournaments ?? []).map((t: { id: string; cycle_id: number }) => `${t.id}:${t.cycle_id}`));
  let count = 0;
  for (const e of entries as { tournament_id: string; cycle_id: number }[]) {
    if (currentSet.has(`${e.tournament_id}:${e.cycle_id}`)) count++;
  }
  return count;
}
