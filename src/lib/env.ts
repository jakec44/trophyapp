/**
 * Environment guard for dev-only UI and logs.
 * isDev is false when: production build (__DEV__ false) or EXPO_PUBLIC_APP_ENV=production
 */
export const isDev =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_APP_ENV !== 'production';

/** Log only in dev. Use for debug/info; keep console.error for real errors. */
export function devLog(...args: unknown[]): void {
  if (isDev) console.log(...args);
}
