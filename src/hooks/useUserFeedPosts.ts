import { useState, useCallback, useEffect } from 'react';
import {
  getFeedPostsByUserId,
  getProfileDisplayName,
  getPublicUrl,
  MEDIA_BUCKET,
  type FeedPostRow,
} from '@/src/lib/supabase';
import type { FeedPost } from '@/utils/feedMockData';

function rowToFeedPost(row: FeedPostRow, username: string, avatar: string): FeedPost {
  const photoUrl = row.photo_path
    ? getPublicUrl(MEDIA_BUCKET, row.photo_path)
    : (row.photo_url ?? '');
  return {
    id: row.id,
    userId: row.user_id,
    username,
    avatar,
    postedAt: row.created_at,
    photoUrl,
    caption: row.caption ?? undefined,
    species: row.species ?? '',
    weight: row.weight_lb ?? 0,
    length: row.length_in ?? undefined,
    location: row.location ?? '',
    locationLabel: '',
    feedSource: 'friend',
    hypeCount: row.hype_count ?? 0,
    commentCount: row.comment_count ?? 0,
    isHyped: false,
    comments: [],
  };
}

export function useUserFeedPosts(
  userId: string | null | undefined,
  profile?: { name?: string | null; display_name?: string | null; username?: string | null; avatar_url?: string | null }
) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await getFeedPostsByUserId(userId);
      const displayName = getProfileDisplayName(profile);
      const avatar = profile?.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
      setPosts(rows.map((r) => rowToFeedPost(r, displayName, avatar)));
    } catch (e) {
      console.error('[useUserFeedPosts]', e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [userId, profile?.name, profile?.display_name, profile?.username, profile?.avatar_url]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { posts, loading, refresh };
}
