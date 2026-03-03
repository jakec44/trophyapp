import { getPublicUrl } from './supabase';

/**
 * Derive a public URL from a storage object key in the `media` bucket.
 */
export function publicUrl(path: string): string {
  return getPublicUrl('media', path);
}

/**
 * Resolve a value that may be a full URL (legacy) or an object key (new) to a renderable URL.
 * Always uses the single `media` bucket. Returns null for missing/empty values.
 */
export function resolveMediaUrl(
  _bucketIgnored: string,
  pathOrUrl: string | null | undefined
): string | null {
  if (!pathOrUrl || !pathOrUrl.trim()) return null;
  const s = pathOrUrl.trim();
  if (s.startsWith('http')) return s;
  return getPublicUrl('media', s);
}
