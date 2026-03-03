/**
 * Local story-view tracking using AsyncStorage.
 * Stores a JSON array of viewed story IDs, pruned to last 200 entries.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'Snagged:viewed_story_ids';
const MAX_STORED = 200;

export async function getViewedStoryIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr: string[] = JSON.parse(raw);
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function markStoryViewed(storyId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    if (arr.includes(storyId)) return;
    const next = [...arr, storyId].slice(-MAX_STORED);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Silent — viewed state is best-effort
  }
}

/** Group stories by calendar day (local timezone). Returns most-recent-day first. */
export function groupStoriesByDay<T extends { created_at: string; id: string }>(
  stories: T[]
): { dayKey: string; stories: T[] }[] {
  const map = new Map<string, T[]>();
  for (const s of stories) {
    const day = new Date(s.created_at).toLocaleDateString('en-CA'); // YYYY-MM-DD
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(s);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // newest day first
    .map(([dayKey, dayStories]) => ({ dayKey, stories: dayStories }));
}
