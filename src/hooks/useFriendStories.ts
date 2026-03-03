import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthContext } from '@/src/context/AuthContext';
import {
  getFriendStories,
  getMyStories,
  type FriendStory,
} from '@/src/lib/supabase';
import type { StoryItem } from '@/utils/feedMockData';

const SEEN_STORIES_KEY = 'Snagged_seen_stories';

async function getSeenStoryIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_STORIES_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

async function markStorySeen(userId: string): Promise<void> {
  try {
    const seen = await getSeenStoryIds();
    seen.add(userId);
    await AsyncStorage.setItem(SEEN_STORIES_KEY, JSON.stringify([...seen]));
  } catch {
    // ignore
  }
}


export function useFriendStories(): {
  stories: StoryItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  markAsSeen: (userId: string) => void;
} {
  const { user } = useAuthContext();
  const [raw, setRaw] = useState<FriendStory[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setRaw([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [friendStories, myStories, seen] = await Promise.all([
        getFriendStories(user.id),
        getMyStories(),
        getSeenStoryIds(),
      ]);
      setSeenIds(seen);

      // Build items: own story first, then friends only
      const items: FriendStory[] = [];
      const myStory = myStories[0];
      if (myStory?.media_url) {
        items.push({
          userId: user.id,
          username: user.displayName || user.username || 'You',
          avatar: user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
          catchPhotoUrl: myStory.media_url,
          species: '',
          weight: 0,
          postedAt: myStory.created_at ?? myStory.expires_at ?? new Date().toISOString(),
          catchId: myStory.id,
        });
      }
      items.push(...friendStories);

      setRaw(items);
    } catch {
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.displayName, user?.username, user?.avatarUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markAsSeen = useCallback((userId: string) => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      next.add(userId);
      markStorySeen(userId);
      return next;
    });
  }, []);

  const stories: StoryItem[] = raw.map((s) => ({
    userId: s.userId,
    username: s.username,
    avatar: s.avatar,
    catchPhotoUrl: s.catchPhotoUrl,
    species: s.species,
    weight: s.weight,
    postedAt: s.postedAt,
    watched: seenIds.has(s.userId),
    isNearby: s.isNearby ?? false,
  }));

  return { stories, loading, refresh, markAsSeen };
}
