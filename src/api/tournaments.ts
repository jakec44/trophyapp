/**
 * Live Tournament Hub API
 * Persisted via Supabase (tournament_entries, tournament_entry_votes).
 */

import type {
  Tournament,
  FishEntry,
  UserFish,
  UserVote,
  MetricType,
  TournamentType,
} from '@/src/types/tournaments';
import {
  getTournaments,
  getTournamentEntries,
  insertTournamentEntry,
  voteOnTournamentEntry,
  deleteTournamentEntryByUser,
  isUserEnteredInTournament as dbIsUserEntered,
  countUserTournamentEntries as dbCountUserTournamentEntries,
} from '@/src/lib/tournamentDb';

export const SPECIES_MATCH: Record<string, (s: string) => boolean> = {
  'biggest-fish-this-week': () => true,
  'tournament-redfish': (s) => s.toLowerCase().includes('redfish'),
  'tournament-bass': (s) => s.toLowerCase().includes('bass'),
  'tournament-snook': (s) => s.toLowerCase().includes('snook'),
  'tournament-flounder': (s) => s.toLowerCase().includes('flounder'),
  'tournament-striper': (s) =>
    s.toLowerCase().includes('striped') || s.toLowerCase().includes('striper'),
  'tournament-tarpon': (s) => s.toLowerCase().includes('tarpon'),
  'tournament-smallest': (s) => {
    const lower = s.toLowerCase();
    const isBait =
      lower.includes('minnow') ||
      lower.includes('shad') ||
      lower.includes('baitfish');
    const isPanfish =
      lower.includes('bluegill') ||
      lower.includes('crappie') ||
      lower.includes('perch') ||
      lower.includes('sunfish') ||
      lower.includes('darter');
    return !isBait && isPanfish;
  },
};

function sortEntriesByMetric(
  entries: FishEntry[],
  tournamentType: string,
  metricType: string
): FishEntry[] {
  const copy = [...entries];
  if (tournamentType === 'SMALLEST_FISH') {
    return copy.sort((a, b) => (a.lengthIn ?? 999) - (b.lengthIn ?? 999));
  }
  if (metricType === 'WEIGHT_LBS') {
    return copy.sort((a, b) => (b.weightLbs ?? 0) - (a.weightLbs ?? 0));
  }
  return copy.sort((a, b) => (b.lengthIn ?? 0) - (a.lengthIn ?? 0));
}

/**
 * Fetch tournaments with entries from Supabase.
 * scope='local' + userState filters entries to users in that state.
 */
export async function fetchHomeTournaments(
  scope: 'global' | 'local' = 'global',
  userState?: string,
  currentUserId?: string | null
): Promise<Tournament[]> {
  const rows = await getTournaments();
  const tournaments: Tournament[] = [];

  for (const row of rows) {
    const entries = await getTournamentEntries(
      row.id,
      currentUserId ?? null,
      scope,
      scope === 'local' ? userState : undefined
    );
    const sorted = sortEntriesByMetric(
      entries,
      row.type,
      row.metric_type
    );
    tournaments.push({
      id: row.id,
      type: row.type as TournamentType,
      title: row.title,
      metricType: row.metric_type as MetricType,
      endsAt: row.ends_at ?? undefined,
      entrantsCount: sorted.length,
      topEntries: sorted.slice(0, 3),
    });
  }

  return tournaments;
}

/**
 * Fetch global tournaments ending soon (for profile screen).
 */
export async function fetchGlobalTournamentsEndingSoon(
  limit = 5
): Promise<Tournament[]> {
  const all = await fetchHomeTournaments('global', undefined, null);
  const now = Date.now();
  const active = all.filter(
    (t) => t.endsAt && new Date(t.endsAt).getTime() > now
  );
  active.sort((a, b) => {
    const aEnd = a.endsAt ? new Date(a.endsAt).getTime() : Infinity;
    const bEnd = b.endsAt ? new Date(b.endsAt).getTime() : Infinity;
    return aEnd - bEnd;
  });
  return active.slice(0, limit);
}

/**
 * Fetch paginated entries for a tournament.
 */
export async function fetchTournamentEntries(
  tournamentId: string,
  page = 0,
  pageSize = 20,
  scope: 'global' | 'local' = 'global',
  userState?: string,
  currentUserId?: string | null
): Promise<{ entries: FishEntry[]; nextPage?: number }> {
  const raw = await getTournamentEntries(
    tournamentId,
    currentUserId ?? null,
    scope,
    scope === 'local' ? userState : undefined
  );
  const rows = await getTournaments();
  const t = rows.find((r) => r.id === tournamentId);
  const sorted = sortEntriesByMetric(
    raw,
    t?.type ?? 'BIGGEST_FISH',
    t?.metric_type ?? 'LENGTH_IN'
  );
  const start = page * pageSize;
  const entries = sorted.slice(start, start + pageSize);
  const hasMore = start + entries.length < sorted.length;

  return {
    entries,
    nextPage: hasMore ? page + 1 : undefined,
  };
}

/**
 * Vote on an entry. Requires currentUserId for persistence.
 */
export async function voteOnEntry(
  entryId: string,
  vote: UserVote,
  currentUserId: string
): Promise<{ upVotes: number; downVotes: number; userVote: UserVote; removed: boolean }> {
  return voteOnTournamentEntry(entryId, currentUserId, vote);
}

export interface TournamentEligibility {
  tournamentId: string;
  tournamentTitle: string;
  metricType: MetricType;
  estimatedRank: number;
  totalEntrants: number;
  endsAt?: string;
  isTop3: boolean;
  isTop10: boolean;
}

/**
 * Compute tournament eligibility for a logged catch.
 */
export async function getTournamentEligibilityForCatch(
  species: string,
  weightLbs?: number,
  lengthIn?: number,
  scope: 'global' | 'local' = 'global',
  userState?: string
): Promise<TournamentEligibility[]> {
  const all = await fetchHomeTournaments(scope, userState, null);
  const results: TournamentEligibility[] = [];

  for (const t of all) {
    const match = SPECIES_MATCH[t.id];
    if (!match || !match(species)) continue;

    const ended = t.endsAt && new Date(t.endsAt).getTime() < Date.now();
    if (ended) continue;

    const entries = t.topEntries; // top 3 only - for rank estimate we need full list
    const full = await getTournamentEntries(
      t.id,
      null,
      scope,
      scope === 'local' ? userState : undefined
    );
    const metricType = t.metricType;
    const myValue =
      metricType === 'LENGTH_IN'
        ? lengthIn ?? 0
        : metricType === 'WEIGHT_LBS'
          ? weightLbs ?? 0
          : 0;

    if (
      metricType !== 'VOTES_UP' &&
      (myValue === 0 ||
        (metricType === 'LENGTH_IN' && !lengthIn) ||
        (metricType === 'WEIGHT_LBS' && !weightLbs))
    ) {
      continue;
    }

    const sorted = sortEntriesByMetric(full, t.type, metricType);
    let rank = 1;
    if (t.id === 'tournament-smallest') {
      for (const e of sorted) {
        const v = e.lengthIn ?? 999;
        if (v < myValue) rank++;
      }
    } else {
      for (const e of sorted) {
        const v =
          metricType === 'LENGTH_IN' ? (e.lengthIn ?? 0) : (e.weightLbs ?? 0);
        if (v > myValue) rank++;
      }
    }

    results.push({
      tournamentId: t.id,
      tournamentTitle: t.title,
      metricType,
      estimatedRank: rank,
      totalEntrants: t.entrantsCount,
      endsAt: t.endsAt,
      isTop3: rank <= 3,
      isTop10: rank <= 10,
    });
  }

  return results.slice(0, 3);
}

/**
 * Enter a tournament with the user's best eligible catch.
 */
export async function enterTournament(
  tournamentId: string,
  userId: string,
  username: string,
  fish: UserFish,
  avatarUrl?: string,
  options?: { logbookCatchId?: string; userState?: string }
): Promise<FishEntry> {
  const id = `entry-${Date.now()}-${userId}`;
  return insertTournamentEntry(
    id,
    tournamentId,
    userId,
    username,
    {
      imageUrl: fish.imageUrl,
      species: fish.species,
      weightLbs: fish.weightLbs,
      lengthIn: fish.lengthIn,
    },
    {
      catchId: options?.logbookCatchId ?? (fish.id?.startsWith('entry-') ? undefined : fish.id),
      avatarUrl,
      userState: options?.userState,
    }
  );
}

/**
 * Remove a user's entry from a tournament.
 */
export async function withdrawFromTournament(
  tournamentId: string,
  userId: string
): Promise<void> {
  return deleteTournamentEntryByUser(tournamentId, userId);
}

/**
 * Check if a user has an entry in a tournament.
 */
export async function isUserEnteredInTournament(
  tournamentId: string,
  userId: string
): Promise<boolean> {
  return dbIsUserEntered(tournamentId, userId);
}

/**
 * Count how many tournaments the user is entered in (for free-tier limit).
 * Free users can enter at most one tournament at a time.
 */
export async function countUserTournamentEntries(userId: string): Promise<number> {
  return dbCountUserTournamentEntries(userId);
}
