/**
 * Supabase-backed tournament entries and votes.
 * Persists tournament entries and votes to PostgreSQL.
 */

import { supabase } from './supabase';
import type { FishEntry, UserVote } from '@/src/types/tournaments';

export interface TournamentRow {
  id: string;
  type: string;
  title: string;
  metric_type: string;
  ends_at: string | null;
}

export interface TournamentEntryRow {
  id: string;
  tournament_id: string;
  user_id: string;
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
  profiles?: { display_name: string | null } | null;
}

function rowToFishEntry(row: TournamentEntryRow, userVote: UserVote = null): FishEntry {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    userId: row.user_id,
    username: row.username,
    displayName: row.profiles?.display_name ?? undefined,
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

/** Fetch all tournament definitions */
export async function getTournaments(): Promise<TournamentRow[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, type, title, metric_type, ends_at')
    .order('id');
  if (error) throw error;
  return (data ?? []) as TournamentRow[];
}

/** Fetch entries for a tournament, optionally filtered by user_state for local scope */
export async function getTournamentEntries(
  tournamentId: string,
  currentUserId: string | null,
  scope: 'global' | 'local',
  userState?: string
): Promise<FishEntry[]> {
  let query = supabase
    .from('tournament_entries')
    .select('*, profiles!tournament_entries_user_id_fkey(display_name)')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: false });

  if (scope === 'local' && userState) {
    query = query.eq('user_state', userState);
  }

  const { data: rows, error } = await query;
  if (error) throw error;

  const entries: FishEntry[] = [];
  for (const row of (rows ?? []) as TournamentEntryRow[]) {
    let userVote: UserVote = null;
    if (currentUserId) {
      const { data: voteRow } = await supabase
        .from('tournament_entry_votes')
        .select('vote')
        .eq('entry_id', row.id)
        .eq('user_id', currentUserId)
        .maybeSingle();
      if (voteRow && (voteRow.vote === 'UP' || voteRow.vote === 'DOWN')) {
        userVote = voteRow.vote;
      }
    }
    entries.push(rowToFishEntry(row, userVote));
  }
  return entries;
}

/** Enter a tournament. Replaces any existing entry for this user in this tournament. */
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
  // Delete existing entry for this user in this tournament
  await supabase
    .from('tournament_entries')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId);

  const { data, error } = await supabase
    .from('tournament_entries')
    .insert({
      id,
      tournament_id: tournamentId,
      user_id: userId,
      catch_id: options?.catchId ?? null,
      username,
      avatar_url: options?.avatarUrl ?? null,
      image_url: fish.imageUrl,
      species: fish.species ?? null,
      weight_lb: fish.weightLbs ?? null,
      length_in: fish.lengthIn ?? null,
      up_votes: 0,
      down_votes: 0,
      user_state: options?.userState ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToFishEntry(data as TournamentEntryRow);
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

/** Delete a user's entry from a tournament by tournament+user (for withdraw flow) */
export async function deleteTournamentEntryByUser(tournamentId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
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

/** Get current user's entry in a tournament */
export async function getMyTournamentEntry(
  tournamentId: string,
  userId: string | null
): Promise<FishEntry | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('tournament_entries')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToFishEntry(data as TournamentEntryRow);
}

/** Check if user has an entry in a tournament */
export async function isUserEnteredInTournament(
  tournamentId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
}

/** Count how many tournaments the user is entered in (for free-tier limit) */
export async function countUserTournamentEntries(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('tournament_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) return 0;
  return count ?? 0;
}
