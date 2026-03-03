import { useState } from 'react';
import { isValidImageUri } from '@/src/lib/imageUri';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { colors } from '@/utils/colors';
import { useFriendsContext } from '@/src/context/FriendsContext';
import { UserLink } from '@/src/components/profile/UserLink';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';

const ACCENT_BLUE = colors.accentBlue;
const APP_NAME = 'Snagged';
const INVITE_MESSAGE = `Join me on ${APP_NAME} — the app for anglers! Track catches, compete in tournaments, and share your best fish.`;
const INVITE_LINK_PLACEHOLDER = 'https://snagged.app/invite';
const DEEP_LINK_PREFIX = 'snagged://invite';

function generateInviteLink(token: string): string {
  return `${DEEP_LINK_PREFIX}?token=${encodeURIComponent(token)}`;
}

function FriendRow({
  item,
  onInvite,
}: {
  item: import('@/src/context/FriendsContext').FriendPreview;
  onInvite: (name: string) => void;
}) {
  const router = useRouter();
  const isOnApp = item.isOnApp !== false && item.userId;

  const handleRowPress = () => {
    const uid = item.userId ?? item.id;
    router.push(`/friends/${uid}`);
  };

  const handleSend = (e: any) => {
    e?.stopPropagation?.();
    if (isOnApp) {
      const uid = item.userId ?? item.id;
      const dname = encodeURIComponent(item.displayName);
      router.push(`/chat/${uid}?displayName=${dname}`);
    } else {
      onInvite(item.displayName);
    }
  };

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={handleRowPress}
    >
      {isOnApp ? (
        <UserLink
          userId={item.userId ?? item.id}
          username={item.displayName}
          avatarUrl={item.avatar}
          variant="row"
          avatarSize={44}
        />
      ) : (
        <>
          {isValidImageUri(item.avatar) ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.lightBorder, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: 12, color: colors.lightSubtext }}>{(item.displayName || '?').slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.nameWrap}>
            <Text style={styles.displayName} numberOfLines={1}>
              {item.displayName}
            </Text>
            {item.proVerified && (
              <Ionicons name="checkmark-circle" size={14} color={ACCENT_BLUE} style={styles.verified} />
            )}
          </View>
        </>
      )}
      {isOnApp ? (
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>Send Message</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.inviteBtn} onPress={handleSend}>
          <Text style={styles.inviteBtnText}>Invite</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function FriendsScreen() {
  const router = useRouter();
  const { friends } = useFriendsContext();
  const bottomPadding = useBottomSafePadding();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  const inviteMessage = (name?: string) => {
    const token = `inv-${Date.now()}`;
    const link = generateInviteLink(token);
    const body = `${INVITE_MESSAGE} Add me: ${link}`;
    return name ? `${name}, ${body}` : body;
  };

  const handleInvite = async (name: string) => {
    try {
      const token = `inv-${Date.now()}`;
      // Don't add to requests - that's for incoming requests only
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const url = `sms:?body=${encodeURIComponent(inviteMessage(name))}`;
        await Linking.openURL(url);
      } else {
        await Share.share({
          message: inviteMessage(name),
          title: 'Invite to Snagged',
        });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e?.message === 'User did not share' || e?.message?.toLowerCase?.().includes('cancel')) {
        return;
      }
      Alert.alert('Share failed', 'Could not open share sheet.');
    }
  };

  const handleInviteFriend = async () => {
    try {
      const token = `inv-${Date.now()}`;
      // Don't add to requests - that's for incoming requests only; outgoing invites don't appear as "requests"
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const url = `sms:?body=${encodeURIComponent(inviteMessage())}`;
        await Linking.openURL(url);
      } else {
        await Share.share({
          message: inviteMessage(),
          title: 'Invite to Snagged',
        });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e?.message === 'User did not share' || e?.message?.toLowerCase?.().includes('cancel')) {
        return;
      }
      Alert.alert('Share failed', 'Could not open share sheet.');
    }
  };

  const { requests, acceptRequest, declineRequest, loading, refresh } = useFriendsContext();
  const pendingRequests = requests.filter((r) => r.status === 'pending' || r.status === 'pending_invite');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <SnaggedWordmark />
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>
            {activeTab === 'friends' ? `${friends.length} anglers` : `${pendingRequests.length} requests`}
          </Text>
        </View>
        <TouchableOpacity style={styles.inviteFriendBtn} onPress={handleInviteFriend}>
          <Text style={styles.inviteFriendBtnText}>Invite Friend</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented control: Friends | Requests */}
      <View style={styles.segmentedWrap}>
        <TouchableOpacity
          style={[styles.segmentedTab, activeTab === 'friends' && styles.segmentedTabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.segmentedText, activeTab === 'friends' && styles.segmentedTextActive]}>
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentedTab, activeTab === 'requests' && styles.segmentedTabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.segmentedText, activeTab === 'requests' && styles.segmentedTextActive]}>
            Requests
          </Text>
          {pendingRequests.length > 0 && (
            <View style={[styles.badge, activeTab === 'requests' && styles.badgeActive]}>
              <Text style={[styles.badgeText, activeTab === 'requests' && styles.badgeTextActive]}>
                {pendingRequests.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={ACCENT_BLUE}
          />
        }
      >
        {loading ? (
          <View style={styles.emptyRequests}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : activeTab === 'friends' ? (
          friends.length === 0 ? (
            <View style={styles.emptyRequests}>
              <Text style={styles.emptyText}>No friends yet. Invite anglers to connect!</Text>
            </View>
          ) : (
            friends.map((item) => (
              <FriendRow
                key={item.id}
                item={item}
                onInvite={handleInvite}
              />
            ))
          )
        ) : (
          pendingRequests.map((req) => (
            <RequestRow
              key={req.id}
              request={req}
              onAccept={() => acceptRequest(req.id)}
              onDecline={() => declineRequest(req.id)}
            />
          ))
        )}
        {activeTab === 'requests' && pendingRequests.length === 0 && (
          <View style={styles.emptyRequests}>
            <Text style={styles.emptyText}>No pending requests</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RequestRow({
  request,
  onAccept,
  onDecline,
}: {
  request: import('@/src/context/FriendsContext').FriendRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const name = request.fromDisplayName ?? request.toPhoneNumber ?? 'Unknown';
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <View style={styles.requestRow}>
      <View style={styles.requestAvatar}>
        {isValidImageUri(request.fromAvatarUrl) ? (
          <Image source={{ uri: request.fromAvatarUrl }} style={styles.requestAvatarImg} />
        ) : (
          <Text style={styles.requestAvatarText}>{initials}</Text>
        )}
      </View>
      <View style={styles.requestInfo}>
        <Text style={styles.requestName}>{name}</Text>
        {request.status === 'pending_invite' && (
          <Text style={styles.requestMeta}>Pending invite</Text>
        )}
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
          <Text style={styles.acceptBtnText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
          <Text style={styles.declineBtnText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  header: {
    flex: 1,
    minWidth: 0,
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: colors.lightSubtext,
  },
  inviteFriendBtn: {
    backgroundColor: ACCENT_BLUE,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  inviteFriendBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  segmentedWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: colors.lightCard,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  segmentedTabActive: {
    backgroundColor: colors.accentBlue,
  },
  segmentedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  segmentedTextActive: {
    color: '#FFFFFF',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ACCENT_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
    backgroundColor: colors.lightCard,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentBlue + '40',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  requestAvatarImg: {
    width: 44,
    height: 44,
  },
  requestAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  requestInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.lightText,
  },
  requestMeta: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.accentBlue,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  declineBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.lightBorder,
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  emptyRequests: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.lightSubtext,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
    backgroundColor: colors.lightCard,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightBorder,
  },
  nameWrap: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.lightText,
  },
  verified: {
    marginLeft: 2,
  },
  sendBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.lightBorder,
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.lightText,
  },
  inviteBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: ACCENT_BLUE,
  },
  inviteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
