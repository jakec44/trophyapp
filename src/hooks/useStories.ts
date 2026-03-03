/**
 * Hook for fetching and managing user stories (Supabase)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getUserStories,
  getMyStories,
  uploadStory,
  deleteStory as deleteStoryFromDb,
  type StoryRow,
} from '@/src/lib/supabase';
import { getViewedStoryIds, markStoryViewed } from '@/src/lib/storyViews';

export function useUserStories(userId: string | null) {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setStories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getUserStories(userId);
    setStories(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stories, loading, refresh };
}

export function useMyStories() {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  // useRef so addStory never captures a stale "uploading" value in its closure
  const uploadingRef = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyStories();
      setStories(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addStory = useCallback(async (localUri: string, caption?: string | null) => {
    if (uploadingRef.current) return null; // prevent double-tap
    uploadingRef.current = true;
    try {
      const story = await uploadStory(localUri, caption ?? undefined);
      if (story) {
        setStories((prev) => [story, ...prev]);
        await refresh();
        return story;
      }
      return null;
    } finally {
      uploadingRef.current = false;
    }
  }, [refresh]);

  const removeStory = useCallback(async (storyId: string) => {
    await deleteStoryFromDb(storyId);
    setStories((prev) => prev.filter((s) => s.id !== storyId));
  }, []);

  const removeStoriesForDay = useCallback(async (storyIds: string[]) => {
    await Promise.all(storyIds.map((id) => deleteStoryFromDb(id)));
    setStories((prev) => prev.filter((s) => !storyIds.includes(s.id)));
  }, []);

  return { stories, loading, refresh, addStory, removeStory, removeStoriesForDay };
}

/** Tracks which story IDs the current user has viewed (AsyncStorage). */
export function useViewedStories() {
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    getViewedStoryIds().then(setViewedIds);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markViewed = useCallback(async (storyId: string) => {
    await markStoryViewed(storyId);
    setViewedIds((prev) => {
      if (prev.has(storyId)) return prev;
      const next = new Set(prev);
      next.add(storyId);
      return next;
    });
  }, []);

  return { viewedIds, markViewed, refresh };
}
