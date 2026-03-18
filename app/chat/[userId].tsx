import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import { supabase, parseSharedPostBody } from '@/src/lib/supabase';
import { triggerSend } from '@/src/lib/feedback';
import * as VideoThumbnails from 'expo-video-thumbnails';

const { width: CHAT_SCREEN_WIDTH } = Dimensions.get('window');
const LIST_PADDING_H = 16;
const SHARED_POST_PREVIEW_WIDTH = CHAT_SCREEN_WIDTH - LIST_PADDING_H * 2;
const SHARED_POST_PREVIEW_ASPECT = 4 / 3;
const SHARED_POST_PREVIEW_HEIGHT = Math.round(SHARED_POST_PREVIEW_WIDTH / SHARED_POST_PREVIEW_ASPECT);

function isVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const path = url.split('?')[0].toLowerCase();
    return /\.(mp4|webm|mov)(\?|$)/i.test(path) || path.includes('/video/');
  } catch {
    return false;
  }
}

function SharedPostPreviewImage({
  photoUrl,
  isVideo,
  isMe,
}: {
  photoUrl: string;
  isVideo?: boolean;
  isMe: boolean;
}) {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);
  const shouldLoadVideoThumb = isVideo || isVideoUrl(photoUrl);

  useEffect(() => {
    if (!shouldLoadVideoThumb || !photoUrl) return;
    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(photoUrl, { time: 0 })
      .then(({ uri }) => {
        if (!cancelled) setThumbnailUri(uri);
      })
      .catch(() => {
        if (!cancelled) setThumbError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [shouldLoadVideoThumb, photoUrl]);

  const displayUri = shouldLoadVideoThumb ? (thumbnailUri || (thumbError ? null : undefined)) : photoUrl;
  const showPlaceholder = !displayUri;

  return (
    <View style={styles.sharedPostMediaWrap}>
      {displayUri ? (
        <Image source={{ uri: displayUri }} style={styles.sharedPostImage} resizeMode="cover" />
      ) : (
        <View style={[styles.sharedPostImage, styles.sharedPostImagePlaceholder]}>
          {shouldLoadVideoThumb ? (
            <Ionicons name="videocam-outline" size={32} color={colors.lightBorder} />
          ) : (
            <Ionicons name="fish" size={32} color={colors.lightBorder} />
          )}
        </View>
      )}
      {shouldLoadVideoThumb && displayUri ? (
        <View style={styles.sharedPostPlayIcon} pointerEvents="none">
          <Ionicons name="play-circle" size={44} color="rgba(255,255,255,0.9)" />
        </View>
      ) : null}
    </View>
  );
}

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

/**
 * Generates a deterministic UUID by XOR-ing the hex of two user UUIDs.
 * This ensures conversation_id is always a valid UUID format matching the DB column type.
 */
function conversationId(a: string, b: string): string {
  const [lo, hi] = [a, b].sort();
  const clean = (s: string) => s.replace(/-/g, '');
  const loHex = clean(lo);
  const hiHex = clean(hi);
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += (parseInt(loHex[i], 16) ^ parseInt(hiHex[i], 16)).toString(16);
  }
  return `${result.slice(0, 8)}-${result.slice(8, 12)}-${result.slice(12, 16)}-${result.slice(16, 20)}-${result.slice(20)}`;
}

export default function ChatScreen() {
  const router = useRouter();
  const { userId: otherUserId, displayName, avatarUrl } = useLocalSearchParams<{ userId: string; displayName?: string; avatarUrl?: string }>();
  const { user } = useAuthContext();
  const myId = user?.id;

  useEffect(() => {
    if (!user?.id) router.replace('/(tabs)/profile');
  }, [user?.id, router]);

  const name = displayName ?? 'Friend';
  const convId = myId && otherUserId ? conversationId(myId, otherUserId) : null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    if (!myId || !otherUserId) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${myId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${myId})`
      )
      .order('created_at', { ascending: true })
      .limit(100);

    if (!error && data) {
      setMessages(data as Message[]);
      // Mark received messages as read
      const unread = data.filter((m) => m.recipient_id === myId && !m.read_at).map((m) => m.id);
      if (unread.length > 0) {
        await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread);
      }
    }
    setLoading(false);
  }, [myId, otherUserId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription — must remove channel on unmount to prevent freeze
  useEffect(() => {
    if (!myId || !otherUserId) return;
    let isMounted = true;

    const channel = supabase
      .channel(`chat-${convId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${myId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const msg = payload.new as Message;
          if (msg.sender_id === otherUserId) {
            setMessages((prev) => [...prev, msg]);
            supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [myId, otherUserId, convId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !myId || !otherUserId || sending) return;
    triggerSend();
    setSending(true);
    setInputText('');

    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      sender_id: myId,
      recipient_id: otherUserId,
      body: text,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: myId,
        recipient_id: otherUserId,
        body: text,
      })
      .select()
      .single();

    if (error) {
      // Revert optimistic message and show the user what went wrong
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInputText(text);
      console.error('[Chat] send error:', error.message, error.code);
      Alert.alert(
        'Message failed',
        error.message ?? 'Could not send message. Make sure you are connected and try again.',
        [{ text: 'OK' }]
      );
    } else if (data) {
      // Replace optimistic with real
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? (data as Message) : m)));
    }
    setSending(false);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === myId;
    const sharedPost = parseSharedPostBody(item.body);

    if (sharedPost) {
      return (
        <View style={[styles.msgRow, styles.msgRowSharedPost]}>
          <TouchableOpacity
            style={[styles.sharedPostBubble, isMe ? styles.sharedPostBubbleMe : styles.sharedPostBubbleThem]}
            onPress={() => router.push(`/(tabs)/?postId=${encodeURIComponent(sharedPost.postId)}`)}
            activeOpacity={0.85}
          >
            {sharedPost.photoUrl ? (
              <SharedPostPreviewImage
                photoUrl={sharedPost.photoUrl}
                isVideo={sharedPost.isVideo}
                isMe={isMe}
              />
            ) : (
              <View style={[styles.sharedPostMediaWrap, styles.sharedPostImagePlaceholder]}>
                <View style={[styles.sharedPostImage, styles.sharedPostImagePlaceholder]}>
                  <Ionicons name="fish" size={32} color={colors.lightBorder} />
                </View>
              </View>
            )}
            <View style={styles.sharedPostContent}>
              <Text style={[styles.sharedPostSpecies, isMe && styles.sharedPostTextMe]} numberOfLines={1}>
                {sharedPost.species}
              </Text>
              {sharedPost.weight ? (
                <Text style={[styles.sharedPostMeta, isMe && styles.sharedPostTextMe]} numberOfLines={1}>
                  {sharedPost.weight} lbs
                </Text>
              ) : null}
              {sharedPost.caption ? (
                <Text style={[styles.sharedPostCaption, isMe && styles.sharedPostTextMe]} numberOfLines={2}>
                  {sharedPost.caption}
                </Text>
              ) : null}
              <Text style={[styles.sharedPostTap, isMe && styles.sharedPostTapMe]}>Tap to view post</Text>
            </View>
            <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe, styles.sharedPostTime]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.body}</Text>
          <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      {/* Header */}
      <View style={styles.header}>
        <SnaggedWordmark />
        <View style={styles.headerCenter}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accentBlue} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.lightBorder} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Say hello to {name}!</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={colors.lightSubtext}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
    backgroundColor: colors.lightBackground,
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
    marginRight: 12,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 4 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentBlue + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: colors.accentBlue },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.lightText },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.lightSubtext, marginTop: 8 },
  emptySubtext: { fontSize: 14, color: colors.lightSubtext },
  list: { paddingVertical: 12, paddingHorizontal: 16, gap: 6 },
  msgRow: { flexDirection: 'row', marginBottom: 4 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowSharedPost: { alignItems: 'stretch', width: '100%' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    gap: 4,
  },
  bubbleMe: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
    borderBottomRightRadius: 4,
  },
  bubbleThem: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: colors.lightText, lineHeight: 20 },
  bubbleTextMe: { color: '#FFF' },
  bubbleTime: { fontSize: 10, color: colors.lightSubtext, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.65)' },
  sharedPostBubble: {
    width: '100%',
    maxWidth: SHARED_POST_PREVIEW_WIDTH,
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 0,
    borderRadius: 14,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    overflow: 'hidden',
  },
  sharedPostBubbleMe: {
    backgroundColor: colors.accentBlue + '22',
    borderColor: colors.accentBlue + '55',
    borderBottomRightRadius: 4,
  },
  sharedPostBubbleThem: { borderBottomLeftRadius: 4 },
  sharedPostMediaWrap: {
    width: '100%',
    aspectRatio: SHARED_POST_PREVIEW_ASPECT,
    backgroundColor: colors.lightBorder + '40',
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    position: 'relative',
  },
  sharedPostImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    backgroundColor: colors.lightBorder + '40',
  },
  sharedPostImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  sharedPostPlayIcon: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sharedPostContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  sharedPostSpecies: { fontSize: 15, fontWeight: '700', color: colors.lightText },
  sharedPostTextMe: { color: '#FFFFFF' },
  sharedPostMeta: { fontSize: 13, color: colors.subtext },
  sharedPostCaption: { fontSize: 12, color: colors.subtext, lineHeight: 16 },
  sharedPostTap: { fontSize: 11, color: colors.accentBlue, marginTop: 4 },
  sharedPostTapMe: { color: 'rgba(255,255,255,0.95)' },
  sharedPostTime: { marginTop: 2, paddingHorizontal: 10, paddingBottom: 6 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
    backgroundColor: colors.lightBackground,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.lightCard,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.lightText,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.lightBorder },
});
