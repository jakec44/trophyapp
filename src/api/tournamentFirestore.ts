/**
 * Firestore-backed tournament entries and votes.
 * Real-time via onSnapshot; source of truth is always the database.
 */

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  type Unsubscribe,
  type DocumentData,
} from '@firebase/firestore';
import { getFirestoreDb, isFirestoreEnabled } from '@/src/lib/firebase';
import type {
  Tournament,
  FishEntry,
  UserFish,
  UserVote,
  MetricType,
  TournamentType,
} from '@/src/types/tournaments';

const COLLECTION_ENTRIES = 'tournament_entries';
const COLLECTION_VOTES = 'entry_votes';
const COLLECTION_TOURNAMENTS = 'tournaments';

/** Disqualify when total >= 10 and downvotes >= 50% */
const MIN_VOTES_FOR_DISQUALIFY = 10;
const DOWNVOTE_RATIO_THRESHOLD = 0.5;

function entryFromDoc(id: string, data: DocumentData, userVote?: UserVote): FishEntry {
  return {
    id,
    tournamentId: data.tournamentId,
    userId: data.userId ?? '',
    username: data.username ?? '',
    imageUrl: data.imageUrl ?? '',
    avatarUrl: data.avatarUrl,
    species: data.species,
    weightLbs: data.weightLbs,
    lengthIn: data.lengthIn,
    upVotes: data.upVotes ?? 0,
    downVotes: data.downVotes ?? 0,
    userVote: userVote ?? null,
    createdAt: data.createdAt ?? new Date().toISOString(),
    logbookCatchId: data.logbookCatchId ?? null,
  };
}

function sortEntries(
  entries: FishEntry[],
  tournamentId: string,
  metricType: MetricType
): FishEntry[] {
  const smallestFirst = tournamentId === 'tournament-smallest';
  return [...entries].sort((a, b) => {
    if (metricType === 'WEIGHT_LBS') {
      const va = a.weightLbs ?? 0;
      const vb = b.weightLbs ?? 0;
      return smallestFirst ? va - vb : vb - va;
    }
    const va = a.lengthIn ?? 0;
    const vb = b.lengthIn ?? 0;
    return smallestFirst ? va - vb : vb - va;
  });
}

/**
 * Subscribe to all entries for a tournament (real-time).
 * Merges current user's vote from entry_votes. Optional scope/local filter by userState on entry.
 */
export function subscribeTournamentEntries(
  tournamentId: string,
  currentUserId: string | null,
  metricType: MetricType,
  scope: 'global' | 'local',
  userState: string | undefined,
  onEntries: (entries: FishEntry[]) => void
): Unsubscribe | null {
  const db = getFirestoreDb();
  if (!db) return null;

  const entriesRef = collection(db, COLLECTION_ENTRIES);
  const q = query(
    entriesRef,
    where('tournamentId', '==', tournamentId),
    orderBy('createdAt', 'desc')
  );

  let votesUnsubscribe: Unsubscribe | null = null;
  let latestEntries: FishEntry[] = [];
  let lastVoteByEntry: Record<string, UserVote> = {};

  const applyVotesAndEmit = (voteByEntry: Record<string, UserVote>) => {
    lastVoteByEntry = voteByEntry;
    const merged = latestEntries.map((e) => ({
      ...e,
      userVote: voteByEntry[e.id] ?? null,
    }));
    onEntries(sortEntries(merged, tournamentId, metricType));
  };

  const unsubEntries = onSnapshot(
    q,
    (entriesSnap) => {
      let entries: FishEntry[] = entriesSnap.docs.map((d) =>
        entryFromDoc(d.id, d.data())
      );
      if (scope === 'local' && userState) {
        entries = entries.filter(
          (e) => (e as DocumentData & { userState?: string }).userState === userState
        );
      }
      latestEntries = entries;

      if (currentUserId) {
        if (!votesUnsubscribe) {
          const votesRef = collection(db, COLLECTION_VOTES);
          const voteQ = query(
            votesRef,
            where('userId', '==', currentUserId)
          );
          votesUnsubscribe = onSnapshot(voteQ, (voteSnap) => {
            const voteByEntry: Record<string, UserVote> = {};
            voteSnap.docs.forEach((d) => {
              const dta = d.data();
              const v = dta.vote;
              if ((v === 'UP' || v === 'DOWN') && dta.entryId) voteByEntry[dta.entryId] = v;
            });
            applyVotesAndEmit(voteByEntry);
          });
        } else {
          applyVotesAndEmit(lastVoteByEntry);
        }
      } else {
        onEntries(sortEntries(entries, tournamentId, metricType));
      }
    },
    (err) => console.warn('[tournamentFirestore] entries snapshot error', err)
  );

  return () => {
    unsubEntries();
    votesUnsubscribe?.();
  };
}

/**
 * Subscribe to the current user's entry for one tournament (real-time).
 */
export function subscribeMyTournamentEntry(
  tournamentId: string,
  userId: string | null,
  onEntry: (entry: FishEntry | null) => void
): Unsubscribe | null {
  const db = getFirestoreDb();
  if (!db || !userId) {
    onEntry(null);
    return null;
  }

  const entriesRef = collection(db, COLLECTION_ENTRIES);
  const q = query(
    entriesRef,
    where('tournamentId', '==', tournamentId),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const d = snap.docs[0];
      if (!d) {
        onEntry(null);
        return;
      }
      onEntry(entryFromDoc(d.id, d.data()));
    },
    (err) => {
      console.warn('[tournamentFirestore] my entry snapshot error', err);
      onEntry(null);
    }
  );
}

/**
 * Cast vote: toggle (tap again to un-vote), switch (flip up/down).
 * Self-vote prevented. Disqualification at 50%+ down with 10+ total.
 */
export async function castVote(
  entryId: string,
  userId: string,
  vote: UserVote
): Promise<{ upVotes: number; downVotes: number; userVote: UserVote; removed: boolean }> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore not configured');

  const entryRef = doc(db, COLLECTION_ENTRIES, entryId);
  const entrySnap = await getDoc(entryRef);
  if (!entrySnap.exists()) throw new Error('Entry not found');
  const entryData = entrySnap.data();
  const entryUserId = entryData.userId;
  if (entryUserId === userId) throw new Error('Cannot vote on your own entry');

  const voteDocId = `${entryId}_${userId}`;
  const voteRef = doc(db, COLLECTION_VOTES, voteDocId);
  const voteSnap = await getDoc(voteRef);
  const prevVote: UserVote = voteSnap.exists() ? (voteSnap.data().vote === 'DOWN' ? 'DOWN' : 'UP') : null;

  let upVotes = entryData.upVotes ?? 0;
  let downVotes = entryData.downVotes ?? 0;
  if (prevVote === 'UP') upVotes--;
  if (prevVote === 'DOWN') downVotes--;
  if (vote === 'UP') upVotes++;
  if (vote === 'DOWN') downVotes++;

  const total = upVotes + downVotes;
  const overThreshold =
    total >= MIN_VOTES_FOR_DISQUALIFY &&
    total > 0 &&
    downVotes / total >= DOWNVOTE_RATIO_THRESHOLD;

  const batch = writeBatch(db);
  if (overThreshold) {
    batch.delete(entryRef);
    const votesQ = query(
      collection(db, COLLECTION_VOTES),
      where('entryId', '==', entryId)
    );
    const voteDocs = await getDocs(votesQ);
    voteDocs.docs.forEach((d) => batch.delete(d.ref));
  } else {
    batch.update(entryRef, { upVotes, downVotes });
    if (vote) {
      batch.set(voteRef, { entryId, userId, vote });
    } else {
      batch.delete(voteRef);
    }
  }
  await batch.commit();

  if (overThreshold) {
    return { upVotes, downVotes, userVote: vote, removed: true };
  }
  return { upVotes, downVotes, userVote: vote, removed: false };
}

/**
 * Enter tournament. Replaces any existing entry for this user in this tournament.
 */
export async function enterTournamentFirestore(
  tournamentId: string,
  userId: string,
  username: string,
  fish: UserFish,
  avatarUrl?: string,
  options?: { logbookCatchId?: string; userState?: string }
): Promise<FishEntry> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore not configured');

  const entriesRef = collection(db, COLLECTION_ENTRIES);
  const existingQ = query(
    entriesRef,
    where('tournamentId', '==', tournamentId),
    where('userId', '==', userId)
  );
  const existingSnap = await getDocs(existingQ);
  const batch = writeBatch(db);
  existingSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  const id = `entry-${Date.now()}-${userId}`;
  const entryRef = doc(db, COLLECTION_ENTRIES, id);
  const data: DocumentData = {
    tournamentId,
    userId,
    username,
    imageUrl: fish.imageUrl,
    avatarUrl: avatarUrl ?? null,
    species: fish.species ?? null,
    weightLbs: fish.weightLbs ?? null,
    lengthIn: fish.lengthIn ?? null,
    upVotes: 0,
    downVotes: 0,
    createdAt: new Date().toISOString(),
    logbookCatchId: options?.logbookCatchId ?? null,
  };
  if (options?.userState) data.userState = options.userState;
  await setDoc(entryRef, data);

  return entryFromDoc(id, data);
}

/**
 * Delete user's entry, cleanup all votes for that entry, and clear logbook catch tournament ref.
 */
export async function deleteTournamentEntry(
  entryId: string,
  userId: string,
  clearLogbookCatch?: (catchId: string) => Promise<void>
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore not configured');

  const entryRef = doc(db, COLLECTION_ENTRIES, entryId);
  const entrySnap = await getDoc(entryRef);
  if (!entrySnap.exists()) throw new Error('Entry not found');
  const data = entrySnap.data();
  if (data.userId !== userId) throw new Error('Only the entry owner can delete it');

  const batch = writeBatch(db);
  batch.delete(entryRef);
  const votesQ = query(
    collection(db, COLLECTION_VOTES),
    where('entryId', '==', entryId)
  );
  const voteDocs = await getDocs(votesQ);
  voteDocs.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  const logbookCatchId = data.logbookCatchId;
  if (logbookCatchId && clearLogbookCatch) {
    await clearLogbookCatch(logbookCatchId);
  }
}

/**
 * Fetch tournaments from Firestore (read-only). Returns list with endsAt from DB.
 */
export async function fetchTournamentsFromFirestore(): Promise<Tournament[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const ref = collection(db, COLLECTION_TOURNAMENTS);
  const snap = await getDocs(ref);
  const list: Tournament[] = [];
  const now = Date.now();
  snap.docs.forEach((d) => {
    const x = d.data();
    const endsAt = x.endsAt ?? undefined;
    if (endsAt && new Date(endsAt).getTime() < now) return;
    list.push({
      id: d.id,
      type: (x.type as TournamentType) ?? 'BIGGEST_FISH',
      title: x.title ?? d.id,
      metricType: (x.metricType as MetricType) ?? 'LENGTH_IN',
      endsAt,
      entrantsCount: 0,
      topEntries: [],
    });
  });
  return list;
}

/**
 * Fetch a single tournament doc by id (for endsAt and metricType).
 */
export async function getTournamentFromFirestore(
  tournamentId: string
): Promise<{ endsAt?: string; metricType: MetricType; title: string } | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  const ref = doc(db, COLLECTION_TOURNAMENTS, tournamentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const x = snap.data();
  return {
    endsAt: x.endsAt,
    metricType: (x.metricType as MetricType) ?? 'LENGTH_IN',
    title: x.title ?? tournamentId,
  };
}

export { isFirestoreEnabled };
