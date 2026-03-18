'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { FeedPost, FeedComment } from '@/utils/feedMockData';
import { useAuthContext } from '@/src/context/AuthContext';
import {
  createFeedPost,
  deleteFeedPost,
  getPublicUrl,
  getAvatarUrlWithCacheBust,
  getProfileDisplayName,
  MEDIA_BUCKET,
  getFeedPostsForHome,
  getFeedPostsSearch,
  getHypedPostIdsForUser,
  hypeFeedPost,
  addFeedComment,
  getFeedComments,
  incrementFeedShare,
  getProfileDisplayItemsBatch,
  getProfileDisplayItems,
  type FeedPostWithProfile,
  type FeedCommentWithProfile,
  type ProfileDisplayItem,
} from '@/src/lib/supabase';
import { getLevelFromXp } from '@/src/types/gamification';

function isPro(p: { subscription_plan?: string | null; pro_expires_at?: string | null } | null): boolean {
  if (!p) return false;
  if (p.subscription_plan !== 'pro') return false;
  if (p.pro_expires_at && new Date(p.pro_expires_at) <= new Date()) return false;
  return true;
}

function commentRowToFeedComment(c: FeedCommentWithProfile, parentUsername?: string | null): FeedComment {
  const p = c.profiles;
  const username = getProfileDisplayName(p);
  const rawAvatar = p?.avatar_url;
  const avatar = rawAvatar
    ? (getAvatarUrlWithCacheBust(rawAvatar) ?? (rawAvatar.startsWith('http') ? rawAvatar : getPublicUrl(MEDIA_BUCKET, rawAvatar)))
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user_id}`;
  return {
    id: c.id,
    userId: c.user_id,
    username,
    avatar,
    text: c.text,
    createdAt: c.created_at,
    likes: c.likes ?? 0,
    parentCommentId: c.parent_comment_id ?? undefined,
    replyToUsername: parentUsername ?? undefined,
    proVerified: false,
  };
}

function rowToFeedPost(
  row: FeedPostWithProfile,
  isHypedByMe = false,
  authorDisplayItems: ProfileDisplayItem[] = []
): FeedPost {
  const p = row.profiles;
  const username = getProfileDisplayName(p);
  const rawAvatar = p?.avatar_url;
  const updatedAt = (p as { updated_at?: string } | null)?.updated_at;
  const avatar = rawAvatar
    ? getAvatarUrlWithCacheBust(rawAvatar, updatedAt) ?? (rawAvatar.startsWith('http') ? rawAvatar : getPublicUrl(MEDIA_BUCKET, rawAvatar))
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.user_id}`;
  const mediaPaths = (row as { media_paths?: string[] | null }).media_paths ?? null;
  const photoUrl = row.photo_path
    ? getPublicUrl(MEDIA_BUCKET, row.photo_path)
    : (row.photo_url ?? '');
  const mediaUrls =
    mediaPaths && mediaPaths.length > 0
      ? mediaPaths.map((p) => getPublicUrl(MEDIA_BUCKET, p))
      : undefined;
  return {
    id: row.id,
    userId: row.user_id,
    username,
    avatar,
    postedAt: row.created_at,
    photoUrl: mediaUrls?.[0] ?? photoUrl,
    mediaUrls,
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
    isHyped: isHypedByMe,
    comments: [],
    proVerified: isPro(p),
    authorLevel: p?.total_xp != null ? getLevelFromXp(p.total_xp).level : undefined,
    authorAnglerRating: p?.angler_rating ?? undefined,
    authorDisplayItems: authorDisplayItems.length ? authorDisplayItems : undefined,
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
  /** First selected item type (single-media uploads) */
  firstMediaType?: 'image' | 'video';
  /** All selected media for multi-image/video posts; uploaded and stored in media_paths. */
  mediaItems?: { uri: string; type: 'image' | 'video' }[];
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
  authorLevel?: number;
  authorAnglerRating?: number;
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
  /** Search feed posts by species or caption (hashtags). Returns posts for search results. */
  searchFeedPosts: (term: string, limit?: number) => Promise<FeedPost[]>;
  handlePostHype: (postId: string, hyped: boolean) => void;
  handleAddComment: (postId: string, text: string, replyMeta?: AddCommentReplyMeta) => void;
  loadComments: (postId: string) => Promise<void>;
  handleShare: (postId: string) => void;
  handleDeletePost: (postId: string) => Promise<void>;
};

const FeedContext = createContext<FeedContextType | null>(null);

export function FeedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);

  const refreshFeed = useCallback(async () => {
    try {
      const [rows, hypedSet] = await Promise.all([
        getFeedPostsForHome(50),
        user?.id ? getHypedPostIdsForUser(user.id) : Promise.resolve(new Set<string>()),
      ]);
      const authorIds = [...new Set(rows.map((r) => r.user_id))];
      const displayMap = await getProfileDisplayItemsBatch(authorIds);
      setFeedPosts(
        rows.map((r) => rowToFeedPost(r, hypedSet.has(r.id), displayMap[r.user_id] ?? []))
      );
    } catch (e) {
      console.error('[FeedContext] refreshFeed failed:', e);
      setFeedPosts([]);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  const addFeedPost = useCallback(async (post: AddFeedPostInput) => {
    let id = `feed-${Date.now()}`;
    let photoUrl = post.photoUrl;
    let mediaUrls: string[] | undefined = post.mediaUrls;

    if (user?.id && post.userId === user.id) {
      try {
        const hasMultiple = (post.mediaItems?.length ?? 0) > 1;
        const created = await createFeedPost({
          user_id: post.userId,
          photoPath: hasMultiple ? undefined : (post.photoPath ?? undefined),
          photoUrl: hasMultiple ? undefined : (typeof post.photoUrl === 'string' ? post.photoUrl : undefined),
          mediaType: hasMultiple ? undefined : (post.firstMediaType ?? 'image'),
          mediaItems: post.mediaItems?.length ? post.mediaItems : undefined,
          species: post.species ?? '',
          weight_lb: post.weight ?? 0,
          length_in: post.length ?? undefined,
          caption: post.caption ?? undefined,
          location: post.location ?? undefined,
        });
        id = created.id;
        const paths = (created as { media_paths?: string[] | null }).media_paths;
        if (paths?.length) {
          photoUrl = getPublicUrl(MEDIA_BUCKET, paths[0]);
          mediaUrls = paths.map((p) => getPublicUrl(MEDIA_BUCKET, p));
        } else {
          photoUrl = created.photo_path
            ? getPublicUrl(MEDIA_BUCKET, created.photo_path)
            : (created.photo_url ?? post.photoUrl);
        }
      } catch (e) {
        console.error('[FeedContext] createFeedPost failed:', e);
      }
    }

    let authorDisplayItems: ProfileDisplayItem[] = [];
    if (user?.id && post.userId === user.id) {
      try {
        authorDisplayItems = await getProfileDisplayItems(user.id);
      } catch {
        // ignore
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
      shareCount: post.shareCount ?? 0,
      isHyped: post.isHyped ?? false,
      comments: [],
      xpGained: post.xpGained ?? 100,
      mediaUrls,
      caption: post.caption,
      proVerified: user?.subscriptionPlan === 'pro',
      authorLevel: post.authorLevel,
      authorAnglerRating: post.authorAnglerRating,
      authorDisplayItems: authorDisplayItems.length ? authorDisplayItems : undefined,
    };
    setFeedPosts((prev) => [newPost, ...prev]);
  }, [user?.id]);

  const handlePostHype = useCallback(async (postId: string, hyped: boolean) => {
    if (!user?.id) return;
    try {
      const result = await hypeFeedPost(postId, hyped);
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isHyped: result.isHyped, hypeCount: result.hypeCount }
            : p
        )
      );
    } catch (e) {
      console.error('[FeedContext] hype failed:', e);
    }
  }, [user?.id]);

  const loadComments = useCallback(async (postId: string) => {
    try {
      const commentsWithProfiles = await getFeedComments(postId);
      const byParent = new Map<string, FeedCommentWithProfile[]>();
      for (const c of commentsWithProfiles) {
        const pid = c.parent_comment_id ?? '';
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid)!.push(c);
      }
      const parentUsernames = new Map<string, string>();
      for (const c of commentsWithProfiles) {
        parentUsernames.set(c.id, getProfileDisplayName(c.profiles));
      }
      const root = byParent.get('') ?? [];
      const flatten = (list: FeedCommentWithProfile[]): FeedComment[] =>
        list.flatMap((c) => [
          commentRowToFeedComment(c, c.parent_comment_id ? parentUsernames.get(c.parent_comment_id) : undefined),
          ...flatten(byParent.get(c.id) ?? []),
        ]);
      const comments = flatten(root);
      setFeedPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments } : p))
      );
    } catch (e) {
      console.error('[FeedContext] loadComments failed:', e);
    }
  }, []);

  const handleAddComment = useCallback(
    async (postId: string, text: string, replyMeta?: AddCommentReplyMeta) => {
      if (!user?.id) return;
      try {
        const result = await addFeedComment(
          postId,
          text,
          replyMeta?.parentCommentId ?? null
        );
        setFeedPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, commentCount: result.commentCount } : p
          )
        );
        await loadComments(postId);
      } catch (e) {
        console.error('[FeedContext] addComment failed:', e);
      }
    },
    [loadComments, user?.id]
  );

  const handleShare = useCallback(async (postId: string) => {
    if (!user?.id) return;
    try {
      const result = await incrementFeedShare(postId);
      setFeedPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, shareCount: result.shareCount } : p))
      );
    } catch (e) {
      console.error('[FeedContext] incrementShare failed:', e);
    }
  }, [user?.id]);

  const handleDeletePost = useCallback(async (postId: string) => {
    try {
      await deleteFeedPost(postId);
      setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (e) {
      console.error('[FeedContext] deletePost failed:', e);
    }
  }, []);

  const searchFeedPosts = useCallback(async (term: string, limit = 50): Promise<FeedPost[]> => {
    try {
      const rows = await getFeedPostsSearch(term, limit);
      return rows.map((r) => rowToFeedPost(r, false));
    } catch (e) {
      console.error('[FeedContext] searchFeedPosts failed:', e);
      return [];
    }
  }, []);

  return (
    <FeedContext.Provider
      value={{
        feedPosts,
        refreshFeed,
        addFeedPost,
        searchFeedPosts,
        handlePostHype,
        handleAddComment,
        loadComments,
        handleShare,
        handleDeletePost,
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
