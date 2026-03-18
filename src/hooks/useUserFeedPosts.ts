import { useState, useCallback, useEffect } from 'react';
import {
  getFeedPostsByUserId,
  getProfileDisplayName,
  getPublicUrl,
  isValidUuid,
  MEDIA_BUCKET,
  type FeedPostRow,
} from '@/src/lib/supabase';
import { getLevelFromXp } from '@/src/types/gamification';
import type { FeedPost } from '@/utils/feedMockData';

function rowToFeedPost(
  row: FeedPostRow,
  username: string,
  avatar: string,
  profile?: { total_xp?: number | null; angler_rating?: number | null }
): FeedPost {
  const photoUrl = row.photo_path
    ? getPublicUrl(MEDIA_BUCKET, row.photo_path)
    : (row.photo_url ?? '');
  const authorLevel = profile?.total_xp != null ? getLevelFromXp(profile.total_xp).level : undefined;
  const authorAnglerRating = profile?.angler_rating ?? undefined;
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
    shareCount: row.share_count ?? 0,
    isHyped: false,
    comments: [],
    authorLevel,
    authorAnglerRating,
  };
}

export function useUserFeedPosts(
  userId: string | null | undefined,
  profile?: { name?: string | null; display_name?: string | null; username?: string | null; avatar_url?: string | null; total_xp?: number | null; angler_rating?: number | null }
) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId || !isValidUuid(userId)) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await getFeedPostsByUserId(userId);
      const displayName = getProfileDisplayName(profile);
      const avatar = profile?.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
      setPosts(rows.map((r) => rowToFeedPost(r, displayName, avatar, profile)));
    } catch (e) {
      console.error('[useUserFeedPosts]', e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [userId, profile?.name, profile?.display_name, profile?.username, profile?.avatar_url, profile?.total_xp, profile?.angler_rating]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { posts, loading, refresh };
}
