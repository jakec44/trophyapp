import { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserLink } from '@/src/components/profile/UserLink';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';
import type { FeedComment } from '@/utils/feedMockData';

export interface CommentReplyMeta {
  parentCommentId?: string;
  replyToUserId?: string;
  replyToUsername?: string;
}

interface CommentSheetProps {
  visible: boolean;
  onClose: () => void;
  comments: FeedComment[];
  onSubmit: (text: string, replyTo?: string, replyMeta?: CommentReplyMeta) => void;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return `${Math.floor(diff / 604800000)}w`;
}

function CommentRow({
  comment,
  onLike,
  onReply,
  onTapRow,
}: {
  comment: FeedComment;
  onLike: (id: string) => void;
  onReply: (username: string) => void;
  onTapRow: (comment: FeedComment) => void;
}) {
  const [liked, setLiked] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    onLike(comment.id);
  };

  return (
    <View style={rowStyles.container}>
      <UserLink
        userId={comment.userId}
        username={comment.username}
        avatarUrl={isValidImageUri(comment.avatar) ? comment.avatar : undefined}
        variant="avatar-only"
        avatarSize={36}
      >
        {isValidImageUri(comment.avatar) ? (
          <Image source={{ uri: comment.avatar }} style={rowStyles.avatar} />
        ) : (
          <View style={[rowStyles.avatar, { backgroundColor: colors.lightBorder, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ fontSize: 12, color: colors.lightSubtext }}>{(comment.username || '?').slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
      </UserLink>
      <Pressable style={rowStyles.main} onPress={() => onTapRow(comment)}>
        <View style={rowStyles.textRow}>
          <UserLink
            userId={comment.userId}
            username={comment.username}
            variant="text-only"
            textStyle={rowStyles.username}
          />
          {(comment.replyTo || comment.replyToUsername) && (
            <Text style={rowStyles.replyTo}>
              {' '}@{comment.replyTo ?? comment.replyToUsername}{' '}
            </Text>
          )}
          <Text style={rowStyles.text}>{comment.text}</Text>
        </View>
        <View style={rowStyles.meta}>
          <Text style={rowStyles.time}>{formatTimeAgo(comment.createdAt)}</Text>
          <TouchableOpacity onPress={handleLike} hitSlop={8}>
            <Text style={rowStyles.like}>
              {liked ? 'Liked' : 'Like'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReply(comment.username)} hitSlop={8}>
            <Text style={rowStyles.reply}>Reply</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
      <TouchableOpacity onPress={handleLike} style={rowStyles.heartBtn}>
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={16}
          color={liked ? '#E74C3C' : colors.lightSubtext}
        />
        {comment.likes > 0 && (
          <Text style={rowStyles.heartCount}>{comment.likes}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  textRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  text: {
    fontSize: 14,
    color: colors.lightText,
    lineHeight: 20,
  },
  username: {
    fontWeight: '700',
    color: colors.lightText,
  },
  replyTo: {
    color: colors.accentBlue,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  time: {
    fontSize: 12,
    color: colors.lightSubtext,
  },
  like: {
    fontSize: 12,
    color: colors.lightSubtext,
    fontWeight: '600',
  },
  reply: {
    fontSize: 12,
    color: colors.lightSubtext,
    fontWeight: '600',
  },
  heartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heartCount: {
    fontSize: 12,
    color: colors.lightSubtext,
  },
});

export function CommentSheet({
  visible,
  onClose,
  comments,
  onSubmit,
}: CommentSheetProps) {
  const inputRef = useRef<TextInput>(null);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<{
    commentId: string;
    userId: string;
    username: string;
  } | null>(null);

  const handleSubmit = () => {
    if (!input.trim()) return;
    const replyMeta = replyTo
      ? {
          parentCommentId: replyTo.commentId,
          replyToUserId: replyTo.userId,
          replyToUsername: replyTo.username,
        }
      : undefined;
    onSubmit(input.trim(), replyTo?.username, replyMeta);
    setInput('');
    setReplyTo(null);
  };

  const handleReply = (username: string) => {
    const c = comments.find((x) => x.username === username);
    if (c) {
      setReplyTo({ commentId: c.id, userId: c.userId, username: c.username });
      setInput(`@${c.username} `);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setReplyTo(null);
      setInput(`@${username} `);
    }
  };

  const handleTapRow = (comment: FeedComment) => {
    setReplyTo({
      commentId: comment.id,
      userId: comment.userId,
      username: comment.username,
    });
    setInput(`@${comment.username} `);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleCancelReply = () => {
    const wasReplyTo = replyTo;
    const draft = input;
    setReplyTo(null);
    if (wasReplyTo) {
      const mention = `@${wasReplyTo.username} `;
      if (draft.trim() === mention.trim() || draft === mention) {
        setInput('');
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Comments</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.lightText} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {comments.length === 0 ? (
              <Text style={styles.empty}>No comments yet. Be the first!</Text>
            ) : (
              comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  onLike={() => {}}
                  onReply={handleReply}
                  onTapRow={handleTapRow}
                />
              ))
            )}
          </ScrollView>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            {replyTo && (
              <View style={styles.replyBar}>
                <Text style={styles.replyBarText}>
                  Replying to @{replyTo.username}
                </Text>
                <TouchableOpacity onPress={handleCancelReply} hitSlop={8}>
                  <Ionicons name="close" size={18} color={colors.lightSubtext} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={replyTo ? `Reply to @${replyTo.username}...` : 'Add a comment...'}
                placeholderTextColor={colors.lightSubtext}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={500}
                returnKeyType="default"
              />
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!input.trim()}
                style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              >
                <Text
                  style={[
                    styles.sendText,
                    !input.trim() && styles.sendTextDisabled,
                  ]}
                >
                  Post
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.lightCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.lightBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.lightText,
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  empty: {
    fontSize: 15,
    color: colors.lightSubtext,
    textAlign: 'center',
    paddingVertical: 32,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
  },
  replyBarText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
  },
  input: {
    flex: 1,
    backgroundColor: colors.lightBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    maxHeight: 100,
    fontSize: 15,
    color: colors.lightText,
  },
  sendBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  sendTextDisabled: {
    color: colors.lightSubtext,
  },
});
