import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import {
  getDirectConversations,
  getUserGroupChats,
  type DmConversation,
  type GroupChatSummary,
} from '@/src/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';

const AVATAR_SIZE = 48;

const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  android: { elevation: 2 },
});

function timeLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function Avatar({ uri, name, size = AVATAR_SIZE }: { uri?: string; name: string; size?: number }) {
  const initials = name.slice(0, 2).toUpperCase();
  if (uri) {
    return <Image source={{ uri }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
  );
}

function GroupAvatar({ group, size = AVATAR_SIZE }: { group: GroupChatSummary; size?: number }) {
  if (group.imageUrl) {
    return <Image source={{ uri: group.imageUrl }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  // Show up to 2 member initials stacked in the circle
  const initials = group.name.slice(0, 2).toUpperCase();
  return (
    <View style={[styles.groupAvatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="people" size={size * 0.46} color="#fff" />
      <Text style={[styles.groupAvatarInitials, { fontSize: size * 0.22 }]}>{initials}</Text>
    </View>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const bottomPadding = useBottomSafePadding();

  const [dms, setDms] = useState<DmConversation[]>([]);
  const [groups, setGroups] = useState<GroupChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.id) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [dmData, groupData] = await Promise.all([
        getDirectConversations(user.id),
        getUserGroupChats(user.id),
      ]);
      setDms(dmData);
      setGroups(groupData);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalUnread = dms.reduce((n, d) => n + d.unreadCount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSnaggedWrap}>
          <SnaggedWordmark />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.createGroupBtn}
          onPress={() => router.push('/group-chat/create')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="people-circle-outline" size={22} color={colors.accentBlue} />
          <Text style={styles.createGroupTxt}>New Group</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accentBlue} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accentBlue} />
          }
        >
          {/* Group Chats */}
          {groups.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Group Chats</Text>
              {groups.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.row}
                  activeOpacity={0.75}
                  onPress={() => router.push(`/group-chat/${g.id}`)}
                >
                  <GroupAvatar group={g} />
                  <View style={styles.rowContent}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowName} numberOfLines={1}>{g.name}</Text>
                      {g.lastMessageAt && (
                        <Text style={styles.rowTime}>{timeLabel(g.lastMessageAt)}</Text>
                      )}
                    </View>
                    <Text style={styles.rowMemberNames} numberOfLines={1}>
                      {g.members.map((m) => m.username).join(', ')}
                    </Text>
                    {g.lastMessage && (
                      <Text style={styles.rowPreview} numberOfLines={1}>{g.lastMessage}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Direct Messages */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Direct Messages</Text>
            {dms.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.accentBlue} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start a conversation from a friend's profile or the Friends tab.
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => router.push('/(tabs)/friends')}
                >
                  <Ionicons name="people-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnTxt}>Go to Friends</Text>
                </TouchableOpacity>
              </View>
            ) : (
              dms.map((dm) => (
                <TouchableOpacity
                  key={dm.otherUserId}
                  style={[styles.row, dm.unreadCount > 0 && styles.rowUnread]}
                  activeOpacity={0.75}
                  onPress={() =>
                    router.push(`/chat/${dm.otherUserId}?displayName=${encodeURIComponent(dm.otherUsername)}`)
                  }
                >
                  <Avatar uri={dm.otherAvatarUrl || undefined} name={dm.otherUsername} />
                  <View style={styles.rowContent}>
                    <View style={styles.rowTop}>
                      <Text style={[styles.rowName, dm.unreadCount > 0 && styles.rowNameUnread]} numberOfLines={1}>
                        {dm.otherUsername}
                      </Text>
                      <Text style={styles.rowTime}>{timeLabel(dm.lastMessageAt)}</Text>
                    </View>
                    <Text style={[styles.rowPreview, dm.unreadCount > 0 && styles.rowPreviewUnread]} numberOfLines={1}>
                      {dm.lastMessage}
                    </Text>
                  </View>
                  {dm.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{dm.unreadCount > 9 ? '9+' : dm.unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerSnaggedWrap: {
    padding: 4,
    marginRight: 8,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.lightText },
  headerBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  createGroupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accentBlue + '18',
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1, borderColor: colors.accentBlue + '40',
  },
  createGroupTxt: { fontSize: 13, fontWeight: '700', color: colors.accentBlue },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: colors.lightSubtext,
    letterSpacing: 0.3, marginBottom: 10, marginTop: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.lightCard,
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.lightBorder,
    ...cardShadow,
  },
  rowUnread: {
    backgroundColor: colors.accentBlue + '08',
    borderColor: colors.accentBlue + '30',
  },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarFallback: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.accentBlue + '30',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: { fontSize: 16, fontWeight: '800', color: colors.accentBlue },
  groupAvatarFallback: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#7C3AED',
    justifyContent: 'center', alignItems: 'center', gap: 0,
  },
  groupAvatarInitials: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginTop: -2 },
  rowContent: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.lightText, flexShrink: 1 },
  rowNameUnread: { fontWeight: '800' },
  rowTime: { fontSize: 11, color: colors.lightSubtext, marginLeft: 8 },
  rowMemberNames: { fontSize: 12, color: colors.lightSubtext, marginBottom: 2 },
  rowPreview: { fontSize: 13, color: colors.lightSubtext },
  rowPreviewUnread: { color: colors.lightText, fontWeight: '600' },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.accentBlue, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.lightText, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: colors.lightSubtext, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.brightBlue, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12,
  },
  primaryBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
