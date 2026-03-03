/**
 * Maps species names (from catches) to passport species IDs.
 */

import { PASSPORT_SPECIES } from '@/utils/gamificationData';

/** Match species name to passport id (fuzzy). Prioritizes exact matches. */
export function findPassportSpeciesId(speciesName: string): string | null {
  const lower = (speciesName || '').toLowerCase().trim();
  if (!lower || lower === 'unknown') return null;

  // Exact ID match (e.g. catch stored "bonnethead-shark")
  const byId = PASSPORT_SPECIES.find((s) => s.id === lower);
  if (byId) return byId.id;

  // Exact name match
  const byName = PASSPORT_SPECIES.find((s) => s.name.toLowerCase() === lower);
  if (byName) return byName.id;

  // Fuzzy: full string containment
  for (const s of PASSPORT_SPECIES) {
    const nameLower = s.name.toLowerCase();
    if (nameLower.includes(lower) || lower.includes(nameLower)) return s.id;
  }

  // Fuzzy: ALL words in the passport species name must appear in the catch name.
  // Sort longest-first so more specific multi-word species win before short ones.
  // Using `every` prevents single-word false positives (e.g. "Gizzard Shad" → "Threadfin Shad",
  // or any catch with "white" → "White Perch").
  const sortedBySpecificity = [...PASSPORT_SPECIES].sort(
    (a, b) => b.name.length - a.name.length
  );
  for (const s of sortedBySpecificity) {
    const nameWords = s.name.toLowerCase().replace(/[()]/g, '').split(/\s+/).filter(Boolean);
    if (nameWords.length > 0 && nameWords.every((w) => lower.includes(w))) return s.id;
  }
  return null;
}
