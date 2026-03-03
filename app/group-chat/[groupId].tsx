/**
 * Group Chat screen — messages between multiple members.
 * Shows sender name + avatar for each message. Supports real-time via Supabase.
 * Group logo can be changed by tapping the header avatar.
 */
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
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import {
  supabase,
  getGroupMessages,
  sendGroupMessage,
  getUserGroupChats,
  uploadFileFromUri,
  updateGroupChatImage,
  type GroupMessage,
  type GroupChatSummary,
} from '@/src/lib/supabase';

const AVATAR_SIZE = 32;

function Avatar({ uri, name, size = AVATAR_SIZE }: { uri?: string; name: string; size?: number }) {
  const initials = name.slice(0, 2).toUpperCase();
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function GroupAvatar({
  group,
  size = 40,
  onPress,
}: {
  group: GroupChatSummary | null;
  size?: number;
  onPress?: () => void;
}) {
  const inner = group?.imageUrl ? (
    <Image source={{ uri: group.imageUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[styles.groupAvatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="people" size={size * 0.46} color="#fff" />
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{inner}</TouchableOpacity>;
  return inner;
}

export default function GroupChatScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuthContext();
  const myId = user?.id;

  const [group, setGroup] = useState<GroupChatSummary | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Build a quick profile lookup from group members
  const profileMap = useCallback(() => {
    const map = new Map<string, { username: string; avatarUrl: string }>();
    for (const m of group?.members ?? []) map.set(m.userId, { username: m.username, avatarUrl: m.avatarUrl });
    return map;
  }, [group]);

  const loadGroup = useCallback(async () => {
    if (!myId || !groupId) return;
    try {
      const groups = await getUserGroupChats(myId);
      const found = groups.find((g) => g.id === groupId) ?? null;
      setGroup(found);
    } catch {}
  }, [myId, groupId]);

  const loadMessages = useCallback(async () => {
    if (!groupId) return;
    try {
      const msgs = await getGroupMessages(groupId);
      setMessages(msgs);
    } catch {}
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    loadGroup();
    loadMessages();
  }, [loadGroup, loadMessages]);

  // Realtime subscription for new group messages
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const msg = payload.new as { id: string; group_id: string; sender_id: string; body: string; created_at: string };
          const pm = profileMap();
          const sender = pm.get(msg.sender_id);
          setMessages((prev) => [
            ...prev,
            {
              id: msg.id,
              groupId: msg.group_id,
              senderId: msg.sender_id,
              senderUsername: sender?.username ?? 'Unknown',
              senderAvatarUrl: sender?.avatarUrl ?? '',
              body: msg.body,
              createdAt: msg.created_at,
            },
          ]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, profileMap]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !myId || !groupId || sending) return;
    setSending(true);
    setInputText('');

    const pm = profileMap();
    const me = pm.get(myId);
    const optimistic: GroupMessage = {
      id: `opt-${Date.now()}`,
      groupId,
      senderId: myId,
      senderUsername: me?.username ?? user?.username ?? 'You',
      senderAvatarUrl: me?.avatarUrl ?? user?.avatarUrl ?? '',
      body: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      await sendGroupMessage(groupId, myId, text);
      // Realtime will deliver the real message; we remove the optimistic one on next load
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInputText(text);
      Alert.alert('Send failed', e?.message ?? 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const handleChangeImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri || !groupId) return;
    setUploadingImage(true);
    try {
      await uploadFileFromUri(
        'media',
        `group-chats/${groupId}/logo.jpg`,
        result.assets[0].uri,
        { upsert: true, contentType: 'image/jpeg' }
      );
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(`group-chats/${groupId}/logo.jpg`);
      await updateGroupChatImage(groupId, publicUrl);
      setGroup((prev) => prev ? { ...prev, imageUrl: publicUrl } : prev);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not update group image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const renderMessage = ({ item, index }: { item: GroupMessage; index: number }) => {
    const isMe = item.senderId === myId;
    const prevItem = messages[index - 1];
    const showHeader = !prevItem || prevItem.senderId !== item.senderId;

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && showHeader && (
          <Avatar uri={item.senderAvatarUrl || undefined} name={item.senderUsername} />
        )}
        {!isMe && !showHeader && <View style={{ width: AVATAR_SIZE }} />}

        <View style={[styles.msgContent, isMe && styles.msgContentMe]}>
          {!isMe && showHeader && (
            <Text style={styles.senderName}>{item.senderUsername}</Text>
          )}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.body}</Text>
            <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const memberCount = group?.members.length ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />

      {/* Header */}
      <View style={styles.header}>
        <SnaggedWordmark />

        <TouchableOpacity style={styles.headerCenter} onPress={() => setShowMembers(true)} activeOpacity={0.8}>
          {uploadingImage ? (
            <ActivityIndicator size="small" color={colors.accentBlue} style={{ width: 40 }} />
          ) : (
            <GroupAvatar group={group} size={40} onPress={handleChangeImage} />
          )}
          <View style={styles.headerMeta}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {group?.name ?? 'Group Chat'}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {memberCount > 0
                ? group!.members.map((m) => m.username).join(', ')
                : '…'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.membersBtn} onPress={() => setShowMembers(true)} hitSlop={8}>
          <Ionicons name="people-outline" size={22} color={colors.accentBlue} />
        </TouchableOpacity>
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
            <Text style={styles.emptySubtext}>Be the first to say something!</Text>
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
            placeholder="Message group…"
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
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Members modal */}
      <Modal visible={showMembers} transparent animationType="slide" onRequestClose={() => setShowMembers(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMembers(false)}>
          <Pressable style={styles.membersSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Members ({memberCount})</Text>
              <TouchableOpacity onPress={() => setShowMembers(false)} hitSlop={8}>
                <Feather name="x" size={22} color={colors.lightText} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {(group?.members ?? []).map((m) => (
                <View key={m.userId} style={styles.memberRow}>
                  <Avatar uri={m.avatarUrl || undefined} name={m.username} size={40} />
                  <Text style={styles.memberName}>{m.username}</Text>
                  {m.userId === group?.createdBy && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeTxt}>Admin</Text>
                    </View>
                  )}
                </View>
              ))}
              <View style={{ height: 24 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.lightBorder,
    backgroundColor: colors.lightBackground,
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
    marginRight: 12,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerMeta: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.lightText },
  headerSub: { fontSize: 11, color: colors.lightSubtext, marginTop: 1 },
  membersBtn: { padding: 8 },

  groupAvatarFallback: {
    backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center',
  },
  avatarFallback: {
    backgroundColor: colors.accentBlue + '30', justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: { fontWeight: '800', color: colors.accentBlue },

  list: { paddingVertical: 12, paddingHorizontal: 12, gap: 2 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgContent: { flex: 1, maxWidth: '78%', alignItems: 'flex-start' },
  msgContentMe: { alignItems: 'flex-end' },
  senderName: { fontSize: 11, fontWeight: '700', color: colors.lightSubtext, marginBottom: 2, marginLeft: 2 },
  bubble: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18,
    backgroundColor: colors.lightCard, borderWidth: 1, borderColor: colors.lightBorder, gap: 4,
  },
  bubbleMe: {
    backgroundColor: colors.accentBlue, borderColor: colors.accentBlue, borderBottomRightRadius: 4,
  },
  bubbleThem: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: colors.lightText, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: colors.lightSubtext, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.65)' },

  emptyText: { fontSize: 16, fontWeight: '600', color: colors.lightSubtext, marginTop: 8 },
  emptySubtext: { fontSize: 14, color: colors.lightSubtext },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    borderTopWidth: 1, borderTopColor: colors.lightBorder, backgroundColor: colors.lightBackground,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    backgroundColor: colors.lightCard, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: colors.lightText,
    borderWidth: 1, borderColor: colors.lightBorder,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accentBlue, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.lightBorder },

  // Members modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  membersSheet: {
    backgroundColor: colors.lightCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lightBorder,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.lightText },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lightBorder,
  },
  memberName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.lightText },
  adminBadge: {
    backgroundColor: colors.accentBlue + '20', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.accentBlue + '40',
  },
  adminBadgeTxt: { fontSize: 11, fontWeight: '700', color: colors.accentBlue },
});
