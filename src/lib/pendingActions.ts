/**
 * Pending actions queue for pre-auth activity migration.
 * When a guest logs a catch before signing in, we store it here.
 * On sign-up/sign-in, we migrate these to Supabase and clear the queue.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_ACTIONS_KEY = '@Snagged/pending_actions';
const GUEST_ID_KEY = '@Snagged/guest_id';

export interface PendingCreateCatch {
  type: 'CREATE_CATCH';
  id: string;
  payload: {
    species: string;
    weight_lb: number;
    length_in?: number;
    notes?: string;
    photoUri?: string;
    taken_at: string;
  };
  createdAt: string;
}

export type PendingAction = PendingCreateCatch;

function generateId(): string {
  return `pending_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get or create a stable guest ID for this device (before sign-in).
 */
export async function getOrCreateGuestId(): Promise<string> {
  let id = await AsyncStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
    await AsyncStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

/**
 * Clear guest ID (after successful migration or explicit reset).
 */
export async function clearGuestId(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_ID_KEY);
}

/**
 * Add a pending CREATE_CATCH action (guest logs a catch).
 */
export async function addPendingCreateCatch(payload: PendingCreateCatch['payload']): Promise<PendingCreateCatch> {
  const action: PendingCreateCatch = {
    type: 'CREATE_CATCH',
    id: generateId(),
    payload,
    createdAt: new Date().toISOString(),
  };
  const list = await getPendingActions();
  list.push(action);
  await AsyncStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(list));
  return action;
}

/**
 * Get all pending actions.
 */
export async function getPendingActions(): Promise<PendingAction[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Remove a pending action by id.
 */
export async function removePendingAction(id: string): Promise<void> {
  const list = await getPendingActions();
  const next = list.filter((a) => a.id !== id);
  await AsyncStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(next));
}

/**
 * Clear all pending actions (after successful migration).
 */
export async function clearPendingActions(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_ACTIONS_KEY);
}
