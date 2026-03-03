/**
 * Convert raw Supabase/API errors to user-friendly messages.
 * Log raw errors to console; show friendly messages to user.
 */

export function toFriendlyMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message || '';
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
    if (msg.length > 80) {
      return 'Something went wrong. Please try again.';
    }
    return msg;
  }
  return 'Something went wrong. Please try again.';
}
