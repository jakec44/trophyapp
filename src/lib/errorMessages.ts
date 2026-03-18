/**
 * Convert raw Supabase/API errors to user-friendly messages.
 * Log raw errors to console; show friendly messages to user.
 */

export function getProLimitType(error: unknown): 'log' | 'tournament' | null {
  const msg = (error instanceof Error ? error.message : String(error ?? '')) || '';
  if (msg.includes('FREE_LOG_LIMIT')) return 'log';
  if (msg.includes('FREE_TOURNAMENT_LIMIT')) return 'tournament';
  return null;
}

export function toFriendlyMessage(error: unknown): string {
  const limit = getProLimitType(error);
  if (limit === 'log') return 'Pro unlocks unlimited logs.';
  if (limit === 'tournament') return 'Pro unlocks unlimited tournament entries.';

  if (error instanceof Error) {
    const msg = error.message || '';
    if (msg.includes('Tournament cycle has ended') || msg.includes('wait for next cycle')) {
      return 'This tournament cycle has ended. A new cycle will start soon—try again then.';
    }
    if (msg.includes('Must be signed in') || msg.includes('sign in')) {
      return 'Please sign in to enter a tournament.';
    }
    if (msg.includes('Tournament not found')) {
      return 'This tournament is no longer available.';
    }
    if (msg.toLowerCase().includes('unique') || msg.includes('duplicate') || msg.includes('already exists') || msg.includes('username')) {
      return 'This username is already taken. Try another.';
    }
    if (msg.includes('PGRST') || msg.includes('postgres') || msg.includes('JWT')) {
      return 'Something went wrong. Please try again.';
    }
    if (msg.toLowerCase().includes('session') || msg.includes('expired') || msg.includes('invalid token')) {
      return 'Session expired. Please sign in again.';
    }
    if (msg.toLowerCase().includes('network') || msg.includes('fetch')) {
      return 'Network error. Check your connection.';
    }
    if (msg.toLowerCase().includes('timed out') || msg.toLowerCase().includes('took too long') || msg.toLowerCase().includes('upload timed out')) {
      return 'Request timed out. Check your connection and try again.';
    }
    if (msg.length > 80) {
      return 'Something went wrong. Please try again.';
    }
    return msg;
  }
  return 'Something went wrong. Please try again.';
}
