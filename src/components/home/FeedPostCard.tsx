import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Audio, Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { FeedPost, FeedComment } from '@/utils/feedMockData';
import { UserLink } from '@/src/components/profile/UserLink';
import { isValidImageUri } from '@/src/lib/imageUri';
import { triggerLike, triggerHype } from '@/src/lib/feedback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COMMENTS_MAX_HEIGHT = 220;
// Use 4:3 container — contain mode shows any aspect ratio without cropping
const PHOTO_HEIGHT = Math.round(SCREEN_WIDTH * (4 / 3));
const GOLD = colors.gold;
const TEAL = colors.teal;

// ── Caption with teal hashtags (compact) ──────────────────────────────────────
function Caption({ text }: { text: string }) {
  const parts = text.split(/(#\w+)/g);
  return (
    <Text style={captionStyles.text} numberOfLines={4}>
      {parts.map((part, i) =>
        part.startsWith('#')
          ? <Text key={i} style={captionStyles.tag}>{part}</Text>
          : part
      )}
    </Text>
  );
}
const captionStyles = StyleSheet.create({
  text: { fontSize: 15, color: colors.lightText, lineHeight: 21 },
  tag:  { color: TEAL, fontWeight: '700' },
});

function isVideoUrl(url: string | number): boolean {
  if (typeof url !== 'string') return false;
  try {
    const path = url.split('?')[0].toLowerCase();
    return /\.(mp4|webm|mov)(\?|$)/i.test(path) || path.includes('/video/');
  } catch {
    return false;
  }
}

// Vertical (portrait) = fill box with cover; horizontal = contain as-is
function getResizeMode(aspectRatio: number | null): 'cover' | 'contain' {
  if (aspectRatio == null) return 'contain';
  return aspectRatio < 1 ? 'cover' : 'contain'; // width/height < 1 => portrait
}

// ── Multi-image carousel ──────────────────────────────────────────────────────
const DOUBLE_TAP_DELAY_MS = 350;

function MediaCarousel({
  urls,
  photoUrl,
  isScreenFocused = true,
  shouldPlayVideo = false,
  onDoubleTap,
}: {
  urls: string[];
  photoUrl: string | number;
  isScreenFocused?: boolean;
  shouldPlayVideo?: boolean;
  onDoubleTap?: () => void;
}) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const videoRefs = useRef<Record<number, { playAsync: () => Promise<unknown>; pauseAsync: () => Promise<unknown> } | null>>({});
  const [pausedSlides, setPausedSlides] = useState<Set<number>>(new Set());
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({});
  const allUrls: (string | number)[] = urls.length > 0 ? urls : [photoUrl];

  const lastTapRef = useRef(0);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMediaPress = useCallback(
    (singleTapAction?: () => void) => {
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY_MS) {
        lastTapRef.current = 0;
        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
          singleTapTimeoutRef.current = null;
        }
        onDoubleTap?.();
      } else {
        lastTapRef.current = now;
        if (singleTapAction) {
          if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
          singleTapTimeoutRef.current = setTimeout(() => {
            singleTapTimeoutRef.current = null;
            singleTapAction();
          }, DOUBLE_TAP_DELAY_MS);
        }
      }
    },
    [onDoubleTap]
  );

  // Allow video playback with volume on iOS (even in silent mode)
  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
  }, []);

  // Pause all videos when user leaves screen (e.g. taps Search)
  useEffect(() => {
    if (!isScreenFocused) {
      allUrls.forEach((url, idx) => {
        if (typeof url === 'string' && isVideoUrl(url)) videoRefs.current[idx]?.pauseAsync?.();
      });
    }
  }, [isScreenFocused]);

  const isVideo = (url: string | number) => typeof url === 'string' && isVideoUrl(url);
  const setAspect = useCallback((index: number, width: number, height: number) => {
    if (height > 0) setAspectRatios((prev) => ({ ...prev, [index]: width / height }));
  }, []);

  const onScrollEnd = (idx: number) => {
    setPage(idx);
    allUrls.forEach((url, i) => {
      if (i !== idx && isVideo(url)) videoRefs.current[i]?.pauseAsync?.();
    });
  };

  const onVideoPress = async (i: number) => {
    const ref = videoRefs.current[i];
    if (!ref) return;
    const isPaused = pausedSlides.has(i);
    if (isPaused) {
      setPausedSlides((s) => { const n = new Set(s); n.delete(i); return n; });
      await ref.playAsync?.();
    } else {
      setPausedSlides((s) => new Set(s).add(i));
      await ref.pauseAsync?.();
    }
  };

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          onScrollEnd(idx);
        }}
      >
        {allUrls.map((url, i) => (
          <View key={i} style={carouselStyles.slide}>
            {typeof url === 'number' ? (
              <Pressable style={carouselStyles.img} onPress={() => handleMediaPress()}>
                <Image
                  source={url}
                  style={carouselStyles.img}
                  resizeMode={getResizeMode(aspectRatios[i] ?? null)}
                  onLoad={(e) => {
                    const { width, height } = e.nativeEvent.source;
                    if (width != null && height != null) setAspect(i, width, height);
                  }}
                />
              </Pressable>
            ) : isVideo(url) ? (
              <Pressable style={carouselStyles.img} onPress={() => handleMediaPress(() => onVideoPress(i))}>
                <Video
                  ref={(r) => { if (r) videoRefs.current[i] = r; }}
                  source={{ uri: url as string }}
                  style={carouselStyles.img}
                  resizeMode={getResizeMode(aspectRatios[i] ?? null) === 'cover' ? ResizeMode.COVER : ResizeMode.CONTAIN}
                  useNativeControls={false}
                  volume={1.0}
                  shouldPlay={isScreenFocused && shouldPlayVideo && page === i && !pausedSlides.has(i)}
                  isLooping
                  onReadyForDisplay={(e) => {
                    const ev = e as { naturalSize?: { width?: number; height?: number } };
                    const naturalSize = ev.naturalSize;
                    if (naturalSize?.width != null && naturalSize?.height != null) setAspect(i, naturalSize.width, naturalSize.height);
                  }}
                />
              </Pressable>
            ) : isValidImageUri(url as string) ? (
              <Pressable style={carouselStyles.img} onPress={() => handleMediaPress()}>
                <Image
                  source={{ uri: url as string }}
                  style={carouselStyles.img}
                  resizeMode={getResizeMode(aspectRatios[i] ?? null)}
                  onLoad={(e) => {
                    const { width, height } = e.nativeEvent.source;
                    if (width != null && height != null) setAspect(i, width, height);
                  }}
                />
              </Pressable>
            ) : (
              <View style={[carouselStyles.img, { justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="fish-outline" size={48} color={colors.lightSubtext} />
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      {/* Dot indicators — more apparent when multiple items */}
      {allUrls.length > 1 && (
        <View style={carouselStyles.dotsWrap}>
          <View style={carouselStyles.dots}>
            {allUrls.map((_, i) => (
              <View key={i} style={[carouselStyles.dot, i === page && carouselStyles.dotActive]} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
const carouselStyles = StyleSheet.create({
  slide: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, backgroundColor: '#000' },
  img:   { width: '100%', height: '100%' },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  videoPlaceholderText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    fontWeight: '600',
  },
  dotsWrap: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 22,
    borderRadius: 4,
  },
});

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '??';
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return `${Math.floor(diff / 604800000)}w ago`;
}

function CommentRow({
  c,
  onTapRow,
}: {
  c: FeedComment;
  onTapRow: (comment: FeedComment) => void;
}) {
  const [err, setErr] = useState(false);
  return (
    <View style={commentStyles.row}>
      <UserLink
        userId={c.userId}
        username={c.username}
        avatarUrl={err || !isValidImageUri(c.avatar) ? undefined : c.avatar}
        variant="avatar-only"
        avatarSize={28}
      >
        {err || !isValidImageUri(c.avatar) ? (
          <View style={commentStyles.avatarFallback}>
            <Text style={commentStyles.avatarFallbackText}>
              {c.username.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: c.avatar! }}
            style={commentStyles.avatar}
            onError={() => setErr(true)}
          />
        )}
      </UserLink>
      <Pressable style={commentStyles.body} onPress={() => onTapRow(c)}>
        <View style={commentStyles.usernameRow}>
          <UserLink
            userId={c.userId}
            username={c.username}
            proVerified={c.proVerified}
            variant="text-only"
            textStyle={commentStyles.username}
          />
          {c.replyToUsername && (
            <Text style={commentStyles.replyTo}> replying to @{c.replyToUsername}</Text>
          )}
        </View>
        <Text style={commentStyles.text}>{c.text}</Text>
      </Pressable>
    </View>
  );
}

interface AddCommentReplyMeta {
  parentCommentId?: string;
  replyToUserId?: string;
  replyToUsername?: string;
}

interface FeedPostCardProps {
  post: FeedPost;
  /** When false, videos in this card pause (e.g. user navigated to Search). Omit or true when screen is focused. */
  isScreenFocused?: boolean;
  /** When true, this post is the one allowed to play video (e.g. >50% visible and only one at a time). */
  shouldPlayVideo?: boolean;
  onHype: (postId: string, hyped: boolean) => void;
  onAddComment: (postId: string, text: string, replyMeta?: AddCommentReplyMeta) => void;
  onShare?: (postId: string) => void;
  loadComments?: (postId: string) => Promise<void>;
  /** When true, show delete button (author or moderator). */
  canDelete?: boolean;
  onDelete?: (postId: string) => void;
  /** Called when comments expand so the parent can scroll to show the comment input. */
  onScrollToShowComments?: (postId: string) => void;
}

export function FeedPostCard({ post, isScreenFocused = true, shouldPlayVideo = false, onHype, onAddComment, onShare, loadComments, canDelete, onDelete, onScrollToShowComments }: FeedPostCardProps) {
  const [hyped, setHyped] = useState(post.isHyped);
  const [hypeCount, setHypeCount] = useState(post.hypeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [shareCount, setShareCount] = useState(post.shareCount ?? 0);
  const [expanded, setExpanded] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{
    commentId: string;
    userId: string;
    username: string;
  } | null>(null);
  const inputRef = useRef<TextInput>(null);
  const router = useRouter();
  const cardRef = useRef<View>(null);
  const mediaRef = useRef<View>(null);
  const likeBtnRef = useRef<View>(null);
  const [flyingHeart, setFlyingHeart] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const flyAnim = useRef({ x: new Animated.Value(0), y: new Animated.Value(0), scale: new Animated.Value(0), opacity: new Animated.Value(1) }).current;

  useEffect(() => {
    setHyped(post.isHyped);
    setHypeCount(post.hypeCount ?? 0);
    setCommentCount(post.commentCount ?? 0);
    setShareCount(post.shareCount ?? 0);
  }, [post.isHyped, post.hypeCount, post.commentCount, post.shareCount]);

  const comments = post.comments ?? [];
  const toggleComments = useCallback(
    (e: any) => {
      e?.stopPropagation?.();
      setExpanded((prev) => {
        const next = !prev;
        if (next && loadComments && (post.comments ?? []).length === 0) loadComments(post.id);
        return next;
      });
    },
    [loadComments, post.id, post.comments?.length]
  );

  useEffect(() => {
    if (expanded && onScrollToShowComments) onScrollToShowComments(post.id);
  }, [expanded, onScrollToShowComments, post.id]);

  const handleTapCommentRow = useCallback((comment: FeedComment) => {
    setReplyTo({
      commentId: comment.id,
      userId: comment.userId,
      username: comment.username,
    });
    setCommentDraft(`@${comment.username} `);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleCancelReply = useCallback(() => {
    const wasReplyTo = replyTo;
    const draft = commentDraft;
    setReplyTo(null);
    if (wasReplyTo) {
      const mention = `@${wasReplyTo.username} `;
      if (draft.trim() === mention.trim() || draft === mention) {
        setCommentDraft('');
      }
    }
  }, [replyTo, commentDraft]);

  const handlePostComment = useCallback(
    (e: any) => {
      e?.stopPropagation?.();
      let text = commentDraft.trim();
      if (!text) return;
      const replyMeta = replyTo
        ? {
            parentCommentId: replyTo.commentId,
            replyToUserId: replyTo.userId,
            replyToUsername: replyTo.username,
          }
        : undefined;
      onAddComment(post.id, text, replyMeta);
      setCommentDraft('');
      setReplyTo(null);
      setCommentCount((prev) => prev + 1);
    },
    [commentDraft, post.id, onAddComment, replyTo]
  );

  const runFlyingHeart = useCallback(() => {
    const card = cardRef.current;
    const media = mediaRef.current;
    const btn = likeBtnRef.current;
    if (!card || !media || !btn) return;
    card.measureInWindow((cx, cy) => {
      media.measureInWindow((mx, my, mw, mh) => {
        const startX = mx - cx + mw / 2;
        const startY = my - cy + mh / 2;
        btn.measureInWindow((bx, by, bw, bh) => {
          const endX = bx - cx + bw / 2;
          const endY = by - cy + bh / 2;
          setFlyingHeart({ startX, startY, endX, endY });
        });
      });
    });
  }, []);

  useEffect(() => {
    if (!flyingHeart) return;
    const { startX, startY, endX, endY } = flyingHeart;
    flyAnim.x.setValue(0);
    flyAnim.y.setValue(0);
    flyAnim.scale.setValue(0);
    flyAnim.opacity.setValue(1);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(flyAnim.scale, { toValue: 1.3, useNativeDriver: true, speed: 12, bounciness: 8 }),
        Animated.timing(flyAnim.opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
      ]),
      Animated.timing(flyAnim.scale, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(flyAnim.x, { toValue: endX - startX, duration: 400, useNativeDriver: true }),
        Animated.timing(flyAnim.y, { toValue: endY - startY, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(flyAnim.opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setFlyingHeart(null);
    });
  }, [flyingHeart]);

  const handleHype = (e: any) => {
    e?.stopPropagation?.();
    triggerHype();
    const newHyped = !hyped;
    setHyped(newHyped);
    setHypeCount((prev) => (newHyped ? prev + 1 : prev - 1));
    onHype(post.id, newHyped);
    if (newHyped) runFlyingHeart();
  };

  const handleDoubleTapLike = useCallback(() => {
    if (hyped) return;
    triggerLike();
    setHyped(true);
    setHypeCount((prev) => prev + 1);
    onHype(post.id, true);
    runFlyingHeart();
  }, [hyped, onHype, post.id, runFlyingHeart]);

  const handleShare = (e: any) => {
    e?.stopPropagation?.();
    if (onShare) {
      onShare(post.id);
      setShareCount((prev) => prev + 1);
    }
    const sharePhotoUrl =
      typeof post.photoUrl === 'string' ? post.photoUrl : (post.mediaUrls?.[0] && typeof post.mediaUrls[0] === 'string' ? post.mediaUrls[0] : '');
    const shareIsVideo = typeof sharePhotoUrl === 'string' && sharePhotoUrl.length > 0 && isVideoUrl(sharePhotoUrl);
    router.push({
      pathname: '/(tabs)/friends',
      params: {
        sharePostId: post.id,
        shareSpecies: post.species,
        shareWeight: String(post.weight),
        shareCaption: (post.caption ?? '').slice(0, 200),
        sharePhotoUrl: sharePhotoUrl || '',
        shareIsVideo: shareIsVideo ? '1' : '0',
      },
    });
  };

  const handleDelete = useCallback(
    (e: any) => {
      e?.stopPropagation?.();
      if (canDelete && onDelete) {
        Alert.alert('Delete post', 'Remove this post from the feed?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => onDelete(post.id) },
        ]);
      }
    },
    [canDelete, onDelete, post.id]
  );

  return (
    <View ref={cardRef} style={styles.card} collapsable={false}>
      {/* Header: avatar + username + badges + time — whole header tappable to profile */}
      <Pressable
        style={styles.header}
        onPress={() => router.push(`/user/${post.userId}`)}
      >
        <View style={styles.headerLeft}>
          <View style={styles.headerUserCol}>
            <UserLink
              userId={post.userId}
              username={post.username}
              avatarUrl={isValidImageUri(post.avatar) ? post.avatar : undefined}
              displayItems={post.authorDisplayItems ?? []}
              proVerified={post.proVerified}
              variant="row"
              avatarSize={40}
              badgeSize="large"
              onPressOverride={() => router.push(`/user/${post.userId}`)}
              style={styles.headerUserLink}
            />
            {(post.authorLevel != null || post.authorAnglerRating != null) && (
              <View style={styles.headerLevelArRow}>
                {post.authorLevel != null && <Text style={styles.headerLevelAr}>Lv {post.authorLevel}</Text>}
                {post.authorLevel != null && post.authorAnglerRating != null && <Text style={styles.headerLevelAr}> · </Text>}
                {post.authorAnglerRating != null && (
                  <View style={styles.headerTrophyWrap}>
                    <Ionicons name="trophy" size={12} color={GOLD} />
                    <Text style={styles.headerLevelAr}>{post.authorAnglerRating}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.time}>{formatTimeAgo(post.postedAt)}</Text>
          {canDelete && onDelete && (
            <TouchableOpacity
              onPress={handleDelete}
              hitSlop={8}
              style={styles.deletePostBtn}
            >
              <Ionicons name="trash-outline" size={20} color={colors.lightSubtext} />
            </TouchableOpacity>
          )}
        </View>
      </Pressable>

      {/* Location tag when applicable */}
      {post.locationLabel ? (
        <View style={styles.locationTag}>
          <Text style={styles.locationTagText}>
            📍 {post.locationLabel}
          </Text>
        </View>
      ) : null}

      {/* Photo / multi-image carousel — double-tap to like */}
      <View ref={mediaRef} collapsable={false}>
        <MediaCarousel
          urls={post.mediaUrls ?? []}
          photoUrl={post.photoUrl}
          isScreenFocused={isScreenFocused}
          shouldPlayVideo={shouldPlayVideo}
          onDoubleTap={handleDoubleTapLike}
        />
      </View>

      {/* Caption with hashtag support */}
      {!!post.caption && (
        <View style={styles.captionWrap}>
          <Caption text={post.caption} />
        </View>
      )}

      {/* Tournament entry label — only when entered in an active tournament */}
      {post.tournamentName && (post.currentRank ?? post.tournamentRank) != null && (
        <TouchableOpacity
          style={styles.tournamentLabel}
          activeOpacity={0.8}
          onPress={() => {
            router.push({
              pathname: '/(tabs)/tournaments',
              params: post.tournamentId ? { tournamentId: post.tournamentId } : {},
            });
          }}
        >
          <Text style={styles.tournamentLabelLeft} numberOfLines={1}>
            🏆 Entered in {post.tournamentName}
          </Text>
          <Text style={[
            styles.tournamentLabelRank,
            (post.currentRank ?? post.tournamentRank) === 1
              ? { color: colors.gold }
              : (post.currentRank ?? post.tournamentRank) === 2
              ? { color: colors.silver }
              : (post.currentRank ?? post.tournamentRank) === 3
              ? { color: colors.bronze }
              : { color: colors.teal },
          ]}>
            · #{post.currentRank ?? post.tournamentRank}
          </Text>
        </TouchableOpacity>
      )}

      {/* Species bold */}
      <View style={styles.speciesRow}>
        <Text style={styles.species}>{post.species}</Text>
      </View>

      {/* Location (e.g. Lake Okeechobee, FL) */}
      <Text style={styles.location}>{post.location}</Text>

      {/* Actions: Likes (heart), Comment, Share — each stops propagation so only one fires */}
      <View style={styles.actions} pointerEvents="box-none">
        <TouchableOpacity
          ref={likeBtnRef}
          style={styles.actionBtn}
          onPress={(e) => {
            e?.stopPropagation?.();
            handleHype(e);
          }}
          activeOpacity={0.6}
        >
          <Ionicons
            name={hyped ? 'heart' : 'heart-outline'}
            size={22}
            color={hyped ? colors.gold : colors.lightText}
          />
          <Text style={[styles.actionCount, hyped && styles.actionCountActive]}>
            {hypeCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={(e) => {
            e?.stopPropagation?.();
            toggleComments(e);
          }}
          activeOpacity={0.6}
        >
          <Ionicons
            name={expanded ? 'chatbubble' : 'chatbubble-outline'}
            size={20}
            color={expanded ? colors.accentBlue : colors.lightText}
          />
          <Text style={[styles.actionCount, expanded && styles.actionCountActive]}>
            {commentCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={(e) => {
            e?.stopPropagation?.();
            handleShare(e);
          }}
          activeOpacity={0.6}
        >
          <Ionicons name="paper-plane-outline" size={20} color={colors.lightText} />
          {shareCount > 0 && (
            <Text style={styles.actionCount}>{shareCount}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Flying yellow heart: pops on post, shoots down to Likes */}
      {flyingHeart && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flyingHeartWrap,
            {
              left: flyingHeart.startX,
              top: flyingHeart.startY,
              transform: [
                { translateX: flyAnim.x },
                { translateY: flyAnim.y },
                { scale: flyAnim.scale },
              ],
              opacity: flyAnim.opacity,
            },
          ]}
        >
          <Ionicons name="heart" size={28} color={colors.gold} />
        </Animated.View>
      )}

      {/* Accordion: inline comment section */}
      {expanded && (
        <View style={styles.commentSection}>
          <ScrollView
            style={styles.commentList}
            contentContainerStyle={styles.commentListContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled
          >
            {comments.length === 0 ? (
              <Text style={styles.commentEmpty}>No comments yet. Be the first!</Text>
            ) : (
              comments.map((c) => (
                <CommentRow key={c.id} c={c} onTapRow={handleTapCommentRow} />
              ))
            )}
          </ScrollView>
          {replyTo && (
            <View style={styles.replyBar}>
              <Text style={styles.replyBarText}>
                Replying to @{replyTo.username}
              </Text>
              <TouchableOpacity
                onPress={handleCancelReply}
                hitSlop={8}
                style={styles.replyBarClose}
              >
                <Ionicons name="close" size={18} color={colors.lightSubtext} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              ref={inputRef}
              style={styles.commentInput}
              placeholder={replyTo ? `Reply to @${replyTo.username}...` : 'Add a comment...'}
              placeholderTextColor={colors.lightSubtext}
              value={commentDraft}
              onChangeText={setCommentDraft}
              multiline={false}
              maxLength={500}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.postBtn, !commentDraft.trim() && styles.postBtnDisabled]}
              onPress={handlePostComment}
              disabled={!commentDraft.trim()}
            >
              <Text style={styles.postBtnText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    backgroundColor: colors.lightCard,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  headerUserCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
    minWidth: 0,
  },
  headerLevelArRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
    marginTop: 2,
  },
  headerTrophyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerLevelAr: {
    fontSize: 11,
    fontWeight: '700',
    color: GOLD,
  },
  headerUserLink: {
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.lightText,
    flex: 1,
  },
  avatarInitials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  headerMeta: {
    flex: 1,
    marginLeft: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  time: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  deletePostBtn: {
    padding: 4,
  },
  locationTag: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  locationTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  captionWrap: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 0,
  },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  species: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.lightText,
  },
  location: {
    fontSize: 12,
    color: colors.lightSubtext,
    paddingHorizontal: 16,
    marginTop: 0,
  },
  tournamentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,229,200,0.06)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,229,200,0.12)',
  },
  tournamentLabelLeft: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 6,
  },
  tournamentLabelRank: {
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    paddingTop: 2,
    gap: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    minWidth: 40,
    minHeight: 36,
    justifyContent: 'center',
  },
  hypeEmoji: {
    fontSize: 18,
  },
  flyingHeartWrap: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  actionCountActive: {
    color: colors.accentBlue,
  },
  commentSection: {
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
    backgroundColor: colors.lightBackground,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  commentList: {
    maxHeight: COMMENTS_MAX_HEIGHT,
  },
  commentListContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  commentEmpty: {
    fontSize: 14,
    color: colors.lightSubtext,
    paddingVertical: 12,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  replyBarText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  replyBarClose: {
    padding: 4,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.lightText,
  },
  postBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.accentBlue,
  },
  postBtnDisabled: {
    opacity: 0.5,
  },
  postBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

const commentStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  body: {
    flex: 1,
    marginLeft: 10,
  },
  usernameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  username: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.lightText,
  },
  replyTo: {
    fontSize: 12,
    color: colors.lightSubtext,
    fontWeight: '500',
  },
  text: {
    fontSize: 14,
    color: colors.lightText,
    marginTop: 2,
  },
});
