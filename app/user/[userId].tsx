import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import { getLevelFromXp } from '@/src/types/gamification';
import { XPProgressBar } from '@/src/components/gamification/XPProgressBar';
import { useAuthContext } from '@/src/context/AuthContext';
import { useFriendsContext } from '@/src/context/FriendsContext';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import { isValidImageUri } from '@/src/lib/imageUri';
import {
  getUserProfile,
  getUserCatches,
  getProfileDisplayName,
  sendFriendRequest,
  getAnglerRank,
  supabase,
  isValidUuid,
} from '@/src/lib/supabase';
import { useUserFeedPosts } from '@/src/hooks/useUserFeedPosts';
import { useFeedContext } from '@/src/context/FeedContext';
import { ProfilePostsGrid } from '@/src/components/profile/ProfilePostsGrid';
import { useProfileDisplayItems } from '@/src/hooks/useProfileDisplayItems';
import { AnimatedTrophyBadge } from '@/src/components/profile/AnimatedTrophyBadge';
import { TrophyDetailModal, TrophyViewOnlyModal } from '@/src/components/profile/TrophyDetailModal';
import { BadgeDetailModal } from '@/src/components/profile/BadgeDetailModal';
import { getBadgeDisplayInfo, getUnlockCatchesForBadge } from '@/src/lib/speciesMastery';
import type { ProfileDisplayItem } from '@/src/lib/supabase';
import { getInferredPlaceFromBadge } from '@/src/lib/supabase';
import { getLevelBadgeIcon } from '@/src/types/gamification';
import { hasCustomSpeciesBadgeImage } from '@/src/constants/speciesBadgeImages';
import { SpeciesBadgeImage } from '@/src/components/profile/SpeciesBadgeImage';
import { RarityBadge } from '@/src/components/profile/RarityBadge';
import { PLACE_PALETTE } from '@/src/types/tournamentResults';

const GOLD = colors.gold;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGBOOK_COLUMNS = 3;
const LOGBOOK_GAP = 8;
const LOGBOOK_ITEM_WIDTH = (SCREEN_WIDTH - 32 - (LOGBOOK_COLUMNS - 1) * LOGBOOK_GAP) / LOGBOOK_COLUMNS;

const GRADIENT_COLORS: [string, string][] = [
  ['#0D47A1', '#1976D2'],
  ['#1B5E20', '#388E3C'],
  ['#4A148C', '#7B1FA2'],
  ['#E65100', '#F57C00'],
  ['#00695C', '#00897B'],
  ['#BF360C', '#E64A19'],
];

function getGradientForSpecies(species: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < species.length; i++) hash += species.charCodeAt(i);
  return GRADIENT_COLORS[Math.abs(hash) % GRADIENT_COLORS.length];
}

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

type ProfileData = {
  id: string;
  name?: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  state: string | null;
  total_xp?: number | null;
  angler_rating?: number | null;
  prestige?: number | null;
  /** Logbook visibility: true = everyone, false = only friends */
  public?: boolean | null;
};

type CatchRow = {
  id: string;
  species: string;
  weight_lb: number;
  length_in?: number | null;
  photo_url?: string | null;
};

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuthContext();
  const { friends, refresh: refreshFriends } = useFriendsContext();
  const bottomPadding = useBottomSafePadding();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [catches, setCatches] = useState<CatchRow[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [requestLoading, setRequestLoading] = useState(false);
  const { handlePostHype, handleAddComment } = useFeedContext();
  const { posts: userPosts } = useUserFeedPosts(userId, profile);
  const { items: displayItems, trophies: profileTrophies } = useProfileDisplayItems(userId ?? null);
  const [selectedTrophyForModal, setSelectedTrophyForModal] = useState<import('@/src/lib/supabase').TrophyWithDetails | null>(null);
  const [selectedTrophyViewOnly, setSelectedTrophyViewOnly] = useState<import('@/src/components/profile/TrophyDetailModal').TrophyViewOnlyPayload | null>(null);
  const [selectedBadgeForModal, setSelectedBadgeForModal] = useState<{
    name: string;
    unlockHint: string;
    rarity: import('@/src/types/badgeRarity').BadgeRarity;
    badgeKey: string;
    unlockCatches: import('@/src/lib/speciesMastery').UnlockCatch[];
  } | null>(null);
  const [arRankGlobal, setArRankGlobal] = useState<number | null>(null);
  const [arRankLocal, setArRankLocal] = useState<number | null>(null);

  const isOwnProfile = user?.id === userId;
  const isFriend = friends.some((f) => f.userId === userId);

  // Load profile (skip API for non-UUID ids like mock "user-jc" to avoid 22P02)
  useEffect(() => {
    if (!userId) return;
    if (!isValidUuid(userId)) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    getUserProfile(userId)
      .then((p) => {
        setProfile(p as ProfileData | null);
        if (p?.id) {
          Promise.all([
            getAnglerRank(p.id, 'global', null),
            (p as ProfileData).state
              ? getAnglerRank(p.id, 'local', (p as ProfileData).state!)
              : Promise.resolve({ rank: null }),
          ]).then(([globalRes, localRes]) => {
            setArRankGlobal(globalRes.rank ?? null);
            setArRankLocal(localRes.rank ?? null);
          });
        }
      })
      .finally(() => setProfileLoading(false));
  }, [userId]);

  // Load catches (only for valid UUIDs)
  useEffect(() => {
    if (!userId || !isValidUuid(userId)) return;
    getUserCatches(userId, 18, 0).then(({ data }) => {
      setCatches((data ?? []) as CatchRow[]);
    }).catch(() => setCatches([]));
  }, [userId]);

  // Load friendship status
  const loadFriendStatus = useCallback(async () => {
    if (!user?.id || !userId || !isValidUuid(userId) || isOwnProfile) return;

    // Already in context as accepted
    if (isFriend) {
      setFriendStatus('accepted');
      return;
    }

    const minId = user.id < userId ? user.id : userId;
    const maxId = user.id < userId ? userId : user.id;

    const { data } = await supabase
      .from('friendships')
      .select('id, status, requested_by')
      .eq('user_id_1', minId)
      .eq('user_id_2', maxId)
      .maybeSingle();

    if (!data) {
      setFriendStatus('none');
    } else if (data.status === 'accepted') {
      setFriendStatus('accepted');
    } else if (data.status === 'pending') {
      setFriendStatus(data.requested_by === user.id ? 'pending_sent' : 'pending_received');
    }
  }, [user?.id, userId, isOwnProfile, isFriend]);

  useEffect(() => {
    loadFriendStatus();
  }, [loadFriendStatus]);

  const handleSendRequest = async () => {
    if (!user?.id) { router.replace('/(tabs)/profile'); return; }
    if (!userId) return;
    setRequestLoading(true);
    try {
      await sendFriendRequest(user.id, userId);
      setFriendStatus('pending_sent');
      await refreshFriends();
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? 'Could not send friend request.';
      Alert.alert('Error', msg);
    } finally {
      setRequestLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!user?.id || !userId) return;
    setRequestLoading(true);
    try {
      const minId = user.id < userId ? user.id : userId;
      const maxId = user.id < userId ? userId : user.id;
      const { data } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id_1', minId)
        .eq('user_id_2', maxId)
        .eq('status', 'pending')
        .maybeSingle();
      if (data?.id) {
        await supabase.from('friendships').update({ status: 'accepted' }).eq('id', data.id);
        setFriendStatus('accepted');
        await refreshFriends();
      }
    } catch {
      Alert.alert('Error', 'Could not accept request.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleMessage = () => {
    if (!user?.id) { router.replace('/(tabs)/profile'); return; }
    if (!userId || !profile) return;
    const name = encodeURIComponent(getProfileDisplayName(profile));
    const av = profile.avatar_url ? encodeURIComponent(profile.avatar_url) : '';
    router.push(`/chat/${userId}?displayName=${name}${av ? `&avatarUrl=${av}` : ''}`);
  };

  const handleDisplayItemPress = async (item: ProfileDisplayItem) => {
    if (item.type === 'badge' && item.badgeKey && userId) {
      const info = getBadgeDisplayInfo(item.badgeKey);
      const unlockCatches = await getUnlockCatchesForBadge(userId, item.badgeKey, true);
      setSelectedBadgeForModal({
        name: item.label ?? info.name,
        unlockHint: info.unlockHint || `Unlocked: ${item.label}`,
        rarity: (item.rarity ?? info.rarity) as import('@/src/types/badgeRarity').BadgeRarity,
        badgeKey: item.badgeKey,
        unlockCatches,
      });
    } else if (item.type === 'trophy') {
      const trophy = profileTrophies.find((t) => t.id === item.trophyId);
      if (trophy) {
        setSelectedTrophyForModal(trophy);
      } else {
        setSelectedTrophyViewOnly({
          tournamentName: item.tournamentName,
          place: item.place,
          imageUrl: item.imageUrl,
        });
      }
    }
  };

  const renderHeader = () => (
    <View style={styles.headerBar}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="arrow-back" size={24} color={colors.lightText} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <SnaggedWordmark />
      </View>
      <View style={styles.backBtnPlaceholder} />
    </View>
  );

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accentBlue} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
        <View style={styles.center}>
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = getProfileDisplayName(profile);
  const avatarUri = isValidImageUri(profile.avatar_url)
    ? profile.avatar_url
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
  const locationStr = profile.location ?? profile.state ?? '';
  const levelInfo = getLevelFromXp(profile.total_xp ?? 0);

  const friendBtnLabel =
    friendStatus === 'accepted' ? 'Friends ✓'
    : friendStatus === 'pending_sent' ? 'Requested'
    : friendStatus === 'pending_received' ? 'Accept Request'
    : 'Add Friend';

  const friendBtnDisabled = friendStatus === 'accepted' || friendStatus === 'pending_sent' || requestLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      {renderHeader()}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {isValidImageUri(avatarUri) ? (
            <Image source={{ uri: avatarUri! }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={40} color={colors.lightSubtext} />
            </View>
          )}
        </View>

        {/* Name */}
        <View style={styles.nameRow}>
          <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
        </View>
        {profile.username && (
          <Text style={styles.usernameTag}>@{profile.username}</Text>
        )}

        {/* Location */}
        {locationStr ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.lightSubtext} />
            <Text style={styles.locationText}>{locationStr}</Text>
          </View>
        ) : null}

        {/* Bio */}
        {profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}

        {/* XP bar */}
        <View style={styles.levelSection}>
          <XPProgressBar
            levelInfo={levelInfo}
            thick
            prestige={profile.prestige != null && profile.prestige > 0 ? profile.prestige : undefined}
            prestigeFiery
          />
        </View>

        {/* Trophies (public) — icon + value, Global & Local rank */}
        {(profile.angler_rating != null || arRankGlobal != null || arRankLocal != null) && (
          <View style={styles.arRow}>
            <View style={styles.arValueRow}>
              <Ionicons name="trophy" size={18} color={colors.gold} />
              <Text style={styles.arValue}>
                {profile.angler_rating != null ? profile.angler_rating : '—'}
                {arRankGlobal != null ? ` · #${arRankGlobal} Global` : ''}
                {arRankLocal != null ? ` · #${arRankLocal} Local` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Badges — under level, same display and tap behavior as own profile */}
        {displayItems.length > 0 && (
          <View style={styles.badgesSection}>
            <Text style={styles.badgesLabel}>Trophies & badges</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={[styles.badgesRow, { paddingRight: 24 }]}
            >
              {displayItems.map((item) => {
                const place = item.type === 'trophy' ? item.place : getInferredPlaceFromBadge(item.badgeKey, item.label);
                const palette = place != null ? PLACE_PALETTE[place] : null;
                const isGold = place === 1;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.badgePill,
                      palette && { borderColor: palette.border, borderWidth: 1.5 },
                      isGold && styles.badgePillGold,
                      hasCustomSpeciesBadgeImage(item.badgeKey) && styles.badgePillNoCircle,
                      hasCustomSpeciesBadgeImage(item.badgeKey) && styles.badgePillSpecies,
                    ]}
                    onPress={() => handleDisplayItemPress(item)}
                    activeOpacity={0.7}
                  >
                    {item.type === 'badge' ? (
                      (() => {
                        const p = getInferredPlaceFromBadge(item.badgeKey, item.label);
                        if (p != null) return <AnimatedTrophyBadge place={p} size={54} />;
                        if (hasCustomSpeciesBadgeImage(item.badgeKey))
                          return <SpeciesBadgeImage badgeKey={item.badgeKey} size={58} scale={1.4} />;
                        const icon = item.badgeKey.startsWith('level-') ? getLevelBadgeIcon(item.badgeKey) : item.icon;
                        if (item.rarity)
                          return <RarityBadge rarity={item.rarity} icon={icon} size={item.badgeKey.startsWith('level-') ? 36 : item.badgeKey.startsWith('achievement-') ? 42 : 54} animated />;
                        return <Text style={styles.badgePillIcon}>{icon}</Text>;
                      })()
                    ) : (
                      <AnimatedTrophyBadge place={item.place as 1 | 2 | 3 | 4 | 5} size={54} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Action buttons */}
        {!isOwnProfile && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.friendBtn,
                friendStatus === 'accepted' && styles.friendBtnActive,
                friendStatus === 'pending_sent' && styles.friendBtnPending,
                friendStatus === 'pending_received' && styles.friendBtnReceived,
              ]}
              onPress={friendStatus === 'pending_received' ? handleAcceptRequest : handleSendRequest}
              disabled={friendBtnDisabled}
              activeOpacity={0.8}
            >
              {requestLoading ? (
                <ActivityIndicator size="small" color={friendStatus === 'none' ? colors.accentBlue : '#FFF'} />
              ) : (
                <Text style={[
                  styles.friendBtnText,
                  (friendStatus === 'accepted' || friendStatus === 'pending_received') && styles.friendBtnTextLight,
                ]}>
                  {friendBtnLabel}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.messageBtn}
              onPress={handleMessage}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={18} color={colors.accentBlue} />
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>

          </View>
        )}

        {/* Posts — shown first */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Posts
            {userPosts.length > 0 && <Text style={styles.sectionCount}> · {userPosts.length}</Text>}
          </Text>
          {userPosts.length === 0 ? (
            <Text style={styles.emptyText}>No posts yet</Text>
          ) : (
            <ProfilePostsGrid
              posts={userPosts}
              onHype={(postId, hyped) => {
                if (!user?.id) { router.replace('/(tabs)/profile'); return; }
                handlePostHype(postId, hyped);
              }}
              onAddComment={(postId, text, replyMeta) => {
                if (!user?.id) { router.replace('/(tabs)/profile'); return; }
                handleAddComment(postId, text, replyMeta);
              }}
            />
          )}
        </View>

        {/* Logbook — shown second */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Logbook
            {catches.length > 0 && <Text style={styles.sectionCount}> · {catches.length}</Text>}
          </Text>
          {catches.length === 0 ? (
            !isOwnProfile && profile.public === false && friendStatus !== 'accepted' ? (
              <Text style={styles.emptyText}>Logbook is private. Add as friend to view.</Text>
            ) : (
              <Text style={styles.emptyText}>No catches yet</Text>
            )
          ) : (
            <View style={styles.logbookGrid}>
              {catches.map((c) => {
                  const photoUri = c.photo_url ?? null;
                const [colorA, colorB] = getGradientForSpecies(c.species ?? 'Fish');
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.logbookCard}
                    activeOpacity={0.9}
                    onPress={() => router.push(`/catch/${c.id}`)}
                  >
                    {isValidImageUri(photoUri) ? (
                      <Image
                        source={{ uri: photoUri! }}
                        style={styles.logbookImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <LinearGradient colors={[colorA, colorB]} style={styles.logbookPlaceholder}>
                        <Text style={styles.logbookEmoji}>🐟</Text>
                      </LinearGradient>
                    )}
                    <Text style={styles.logbookSpecies} numberOfLines={1}>{c.species}</Text>
                    {c.weight_lb > 0 && (
                      <Text style={styles.logbookMeta}>
                        {c.weight_lb} lbs{c.length_in ? ` · ${c.length_in}"` : ''}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <BadgeDetailModal
          visible={!!selectedBadgeForModal}
          onClose={() => setSelectedBadgeForModal(null)}
          name={selectedBadgeForModal?.name ?? ''}
          rarity={selectedBadgeForModal?.rarity ?? 'COMMON'}
          unlockHint={selectedBadgeForModal?.unlockHint ?? ''}
          unlocked={true}
          unlockCatches={selectedBadgeForModal?.unlockCatches ?? []}
          badgeKey={selectedBadgeForModal?.badgeKey}
        />
        <TrophyDetailModal
          visible={!!selectedTrophyForModal}
          trophy={selectedTrophyForModal}
          onClose={() => setSelectedTrophyForModal(null)}
        />
        <TrophyViewOnlyModal
          visible={!!selectedTrophyViewOnly}
          payload={selectedTrophyViewOnly}
          onClose={() => setSelectedTrophyViewOnly(null)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  backBtnPlaceholder: { width: 32, height: 32 },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  avatarWrap: { alignItems: 'center', marginBottom: 14 },
  avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.lightBorder },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  displayName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  usernameTag: { textAlign: 'center', fontSize: 14, color: colors.lightSubtext, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 10 },
  locationText: { fontSize: 13, color: colors.lightSubtext },
  bio: { fontSize: 14, color: colors.lightText, lineHeight: 20, textAlign: 'center', marginBottom: 18, paddingHorizontal: 16 },
  levelSection: { marginBottom: 12 },
  arRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  arValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 1,
  },
  arValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.gold,
  },
  badgesSection: { marginBottom: 24 },
  badgesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.lightSubtext,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  badgesRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  badgePill: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.lightCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  badgePillSpecies: {
    width: 76,
    height: 76,
    overflow: 'visible' as const,
  },
  badgePillNoCircle: {
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  badgePillGold: {
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  badgePillIcon: { fontSize: 26 },
  actionButtons: { flexDirection: 'row', gap: 8, marginBottom: 28, justifyContent: 'center', flexWrap: 'wrap' },
  friendBtn: {
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10,
    backgroundColor: colors.lightCard, borderWidth: 1.5, borderColor: colors.accentBlue,
  },
  friendBtnActive: { backgroundColor: colors.accentBlue, borderColor: colors.accentBlue },
  friendBtnPending: { backgroundColor: colors.lightCard, borderColor: colors.lightBorder },
  friendBtnReceived: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  friendBtnText: { fontSize: 14, fontWeight: '700', color: colors.accentBlue },
  friendBtnTextLight: { color: '#FFF' },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: colors.lightCard, borderWidth: 1.5, borderColor: colors.accentBlue,
  },
  messageBtnText: { fontSize: 14, fontWeight: '700', color: colors.accentBlue },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.lightText, marginBottom: 14 },
  sectionCount: { fontWeight: '400', color: colors.lightSubtext, fontSize: 16 },
  logbookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: LOGBOOK_GAP },
  logbookCard: {
    width: LOGBOOK_ITEM_WIDTH, backgroundColor: colors.lightCard,
    borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.lightBorder,
  },
  logbookImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.lightBorder },
  logbookPlaceholder: { width: '100%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  logbookEmoji: { fontSize: 34 },
  logbookSpecies: { fontSize: 11, fontWeight: '600', color: colors.lightText, marginTop: 6, paddingHorizontal: 6 },
  logbookMeta: { fontSize: 10, color: colors.lightSubtext, marginTop: 2, paddingHorizontal: 6, paddingBottom: 6 },
  emptyText: { fontSize: 14, color: colors.lightSubtext },
  errorText: { fontSize: 16, color: colors.lightSubtext },
});
