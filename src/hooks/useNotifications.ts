/**
 * Notifications: only two types are sent to users:
 * 1. friend_posted — when someone they follow (a friend) posts a catch
 * 2. tournament_ended — when a tournament they entered has ended
 *
 * Other notification types (leaderboard changes, tournament reminders, "could place", etc.)
 * are disabled and not sent.
 */

export type AppNotificationType = 'friend_posted' | 'tournament_ended';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  /** For tournament_ended: tournament id to open */
  tournamentId?: string;
  /** For friend_posted: post author user id */
  userId?: string;
  read: boolean;
  createdAt: string;
}
