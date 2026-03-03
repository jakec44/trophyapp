'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { FeedPost } from '@/utils/feedMockData';
import { useAuthContext } from '@/src/context/AuthContext';
import {
  createFeedPost,
  getPublicUrl,
  MEDIA_BUCKET,
  getFeedPostsForHome,
  type FeedPostWithProfile,
} from '@/src/lib/supabase';

function rowToFeedPost(row: FeedPostWithProfile): FeedPost {
  const p = row.profiles;
  const username = p?.username ?? p?.display_name ?? 'Angler';
  const rawAvatar = p?.avatar_url;
  const avatar = rawAvatar
    ? (rawAvatar.startsWith('http') ? rawAvatar : getPublicUrl(MEDIA_BUCKET, rawAvatar))
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.user_id}`;
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

export interface AddFeedPostInput {
  userId: string;
  username: string;
  avatar: string;
  postedAt: string;
  photoUrl: string;
  /** Storage path when sharing from catch (avoids re-upload) */
  photoPath?: string | null;
  mediaUrls?: string[];
  caption?: string;
  species: string;
  weight: number;
  length?: number;
  location?: string;
  hypeCount?: number;
  commentCount?: number;
  isHyped?: boolean;
  isLiveCatch?: boolean;
  xpGained?: number;
}

export interface AddCommentReplyMeta {
  parentCommentId?: string;
  replyToUserId?: string;
  replyToUsername?: string;
}

type FeedContextType = {
  feedPosts: FeedPost[];
  refreshFeed: () => Promise<void>;
  addFeedPost: (post: AddFeedPostInput) => Promise<void>;
  handlePostHype: (postId: string, hyped: boolean) => void;
  handleAddComment: (postId: string, text: string, replyMeta?: AddCommentReplyMeta) => void;
};

const FeedContext = createContext<FeedContextType | null>(null);

export function FeedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);

  const refreshFeed = useCallback(async () => {
    try {
      const rows = await getFeedPostsForHome(50);
      setFeedPosts(rows.map(rowToFeedPost));
    } catch (e) {
      console.error('[FeedContext] refreshFeed failed:', e);
      setFeedPosts([]);
    }
  }, []);

  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  const addFeedPost = useCallback(async (post: AddFeedPostInput) => {
    let id = `feed-${Date.now()}`;
    let photoUrl = post.photoUrl;

    if (user?.id && post.userId === user.id) {
      try {
        const created = await createFeedPost({
          user_id: post.userId,
          photoPath: post.photoPath ?? undefined,
          photoUrl: typeof post.photoUrl === 'string' ? post.photoUrl : undefined,
          species: post.species ?? '',
          weight_lb: post.weight ?? 0,
          length_in: post.length ?? undefined,
          caption: post.caption ?? undefined,
          location: post.location ?? undefined,
        });
        id = created.id;
        photoUrl = created.photo_path
          ? getPublicUrl(MEDIA_BUCKET, created.photo_path)
          : (created.photo_url ?? post.photoUrl);
      } catch (e) {
        console.error('[FeedContext] createFeedPost failed:', e);
      }
    }

    const newPost: FeedPost = {
      ...post,
      id,
      photoUrl,
      location: post.location ?? '',
      locationLabel: '',
      feedSource: 'friend',
      hypeCount: post.hypeCount ?? 0,
      commentCount: post.commentCount ?? 0,
      isHyped: post.isHyped ?? false,
      comments: [],
      xpGained: post.xpGained ?? 100,
      mediaUrls: post.mediaUrls,
      caption: post.caption,
    };
    setFeedPosts((prev) => [newPost, ...prev]);
  }, [user?.id]);

  const handlePostHype = useCallback((postId: string, hyped: boolean) => {
    setFeedPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              isHyped: hyped,
              hypeCount: hyped ? p.hypeCount + 1 : p.hypeCount - 1,
            }
          : p
      )
    );
  }, []);

  const handleAddComment = useCallback((postId: string, text: string, replyMeta?: AddCommentReplyMeta) => {
    const newComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: user?.id ?? 'anon',
      username: user?.username ?? user?.displayName ?? 'Angler',
      avatar: user?.avatarUrl ?? '',
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
      parentCommentId: replyMeta?.parentCommentId,
      replyToUserId: replyMeta?.replyToUserId,
      replyToUsername: replyMeta?.replyToUsername,
    };
    setFeedPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [...(p.comments ?? []), newComment],
              commentCount: (p.commentCount ?? 0) + 1,
            }
          : p
      )
    );
  }, [user]);

  return (
    <FeedContext.Provider
      value={{
        feedPosts,
        refreshFeed,
        addFeedPost,
        handlePostHype,
        handleAddComment,
      }}
    >
      {children}
    </FeedContext.Provider>
  );
}

export function useFeedContext() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeedContext must be used within FeedProvider');
  return ctx;
}
