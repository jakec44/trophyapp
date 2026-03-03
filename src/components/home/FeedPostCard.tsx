import { useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { FeedPost, FeedComment } from '@/utils/feedMockData';
import { UserLink } from '@/src/components/profile/UserLink';
import { isValidImageUri } from '@/src/lib/imageUri';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COMMENTS_MAX_HEIGHT = 220;
// Use 4:3 container — contain mode shows any aspect ratio without cropping
const PHOTO_HEIGHT = Math.round(SCREEN_WIDTH * (4 / 3));
const GOLD = colors.gold;
const TEAL = colors.teal;

// ── Caption with teal hashtags ────────────────────────────────────────────────
function Caption({ text }: { text: string }) {
  const parts = text.split(/(#\w+)/g);
  return (
    <Text style={captionStyles.text}>
      {parts.map((part, i) =>
        part.startsWith('#')
          ? <Text key={i} style={captionStyles.tag}>{part}</Text>
          : part
      )}
    </Text>
  );
}
const captionStyles = StyleSheet.create({
  text: { fontSize: 14, color: colors.lightText, lineHeight: 20 },
  tag:  { color: TEAL, fontWeight: '700' },
});

// ── Multi-image carousel ──────────────────────────────────────────────────────
function MediaCarousel({ urls, photoUrl }: { urls: string[]; photoUrl: string | number }) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const allUrls: (string | number)[] = urls.length > 0 ? urls : [photoUrl];

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setPage(idx);
        }}
      >
        {allUrls.map((url, i) => (
          <View key={i} style={carouselStyles.slide}>
            {typeof url === 'number' || isValidImageUri(url as string) ? (
              <Image
                source={typeof url === 'number' ? url : { uri: url as string }}
                style={carouselStyles.img}
                resizeMode="contain"
              />
            ) : (
              <View style={[carouselStyles.img, { justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="fish-outline" size={48} color={colors.lightSubtext} />
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      {/* Dot indicators — only show when multiple images */}
      {allUrls.length > 1 && (
        <View style={carouselStyles.dots}>
          {allUrls.map((_, i) => (
            <View key={i} style={[carouselStyles.dot, i === page && carouselStyles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}
const carouselStyles = StyleSheet.create({
  slide: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, backgroundColor: '#000' },
  img:   { width: '100%', height: '100%' },
  dots:  {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: { backgroundColor: '#fff', width: 18 },
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
  onHype: (postId: string, hyped: boolean) => void;
  onAddComment: (postId: string, text: string, replyMeta?: AddCommentReplyMeta) => void;
}

export function FeedPostCard({ post, onHype, onAddComment }: FeedPostCardProps) {
  const [hyped, setHyped] = useState(post.isHyped);
  const [hypeCount, setHypeCount] = useState(post.hypeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [expanded, setExpanded] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{
    commentId: string;
    userId: string;
    username: string;
  } | null>(null);
  const inputRef = useRef<TextInput>(null);
  const router = useRouter();

  const comments = post.comments ?? [];
  const toggleComments = useCallback(
    (e: any) => {
      e?.stopPropagation?.();
      setExpanded((prev) => !prev);
    },
    []
  );

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

  const handleHype = (e: any) => {
    e?.stopPropagation?.();
    const newHyped = !hyped;
    setHyped(newHyped);
    setHypeCount((prev) => (newHyped ? prev + 1 : prev - 1));
    onHype(post.id, newHyped);
  };

  const handleShare = (e: any) => {
    e?.stopPropagation?.();
    router.push('/(tabs)/friends');
  };

  return (
    <View style={styles.card}>
      {/* Header: avatar + username + time — whole header tappable to profile */}
      <Pressable
        style={styles.header}
        onPress={() => router.push(`/user/${post.userId}`)}
      >
        <View style={styles.headerLeft}>
          {isValidImageUri(post.avatar) ? (
            <Image source={{ uri: post.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{getInitials(post.username)}</Text>
            </View>
          )}
          <Text style={styles.username} numberOfLines={1}>{post.username}</Text>
        </View>
        <Text style={styles.time}>{formatTimeAgo(post.postedAt)}</Text>
      </Pressable>

      {/* Location tag when applicable */}
      {post.locationLabel ? (
        <View style={styles.locationTag}>
          <Text style={styles.locationTagText}>
            📍 {post.locationLabel}
          </Text>
        </View>
      ) : null}

      {/* Photo / multi-image carousel */}
      <MediaCarousel
        urls={post.mediaUrls ?? []}
        photoUrl={post.photoUrl}
      />

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

      {/* Species bold + weight in gold */}
      <View style={styles.speciesRow}>
        <Text style={styles.species}>{post.species}</Text>
        <Text style={styles.weight}>{post.weight.toFixed(1)} lbs</Text>
      </View>

      {/* Location (e.g. Lake Okeechobee, FL) */}
      <Text style={styles.location}>{post.location}</Text>

      {/* Actions: Hype 👊, Comment, Share */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleHype}
        >
          <Text style={styles.hypeEmoji}>👊</Text>
          <Text style={[styles.actionCount, hyped && styles.actionCountActive]}>
            {hypeCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={toggleComments}>
          <Ionicons
            name={expanded ? 'chatbubble' : 'chatbubble-outline'}
            size={22}
            color={expanded ? colors.accentBlue : colors.lightText}
          />
          <Text style={[styles.actionCount, expanded && styles.actionCountActive]}>
            {commentCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Ionicons name="paper-plane-outline" size={22} color={colors.lightText} />
        </TouchableOpacity>
      </View>

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
    gap: 12,
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
  time: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  locationTag: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  locationTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  captionWrap: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
  },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  species: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.lightText,
  },
  weight: {
    fontSize: 16,
    fontWeight: '700',
    color: GOLD,
  },
  location: {
    fontSize: 13,
    color: colors.lightSubtext,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  tournamentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,229,200,0.06)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,229,200,0.12)',
  },
  tournamentLabelLeft: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 6,
  },
  tournamentLabelRank: {
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 14,
    gap: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  hypeEmoji: {
    fontSize: 20,
  },
  actionCount: {
    fontSize: 14,
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
