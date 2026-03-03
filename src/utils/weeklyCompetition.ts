/**
 * Weekly competition - "Biggest Fish This Week"
 * Resets every Sunday at midnight (local time).
 */

/**
 * Get next Sunday 00:00:00 in local time as ISO string
 */
export function getNextSundayISO(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilSunday);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}
