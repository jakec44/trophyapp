import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/utils/colors';
import { CARD_RADIUS_LG, cardShadowLight } from '@/src/constants/styles';
import { useGamificationContext } from '@/src/context/GamificationContext';
import { useAuthContext } from '@/src/context/AuthContext';
import {
  getUserProfile,
  updateUserProfile,
  getUserGlobalRank,
} from '@/src/lib/supabase';
import { mediaPath } from '@/src/lib/mediaPaths';
import { uploadImageAsJpegToStorage } from '@/src/lib/supabase';
import { LevelRoadmapModal } from '@/src/components/gamification/LevelRoadmapModal';
import { MAX_LEVEL, LEVEL_UNLOCKS, LEVEL_ROADMAP } from '@/src/types/gamification';
import { PLACE_PALETTE } from '@/src/types/tournamentResults';
import { ProfileHeader, type EarnedBadgeItem } from '@/src/components/profile/ProfileHeader';
import { BadgePickerModal } from '@/src/components/profile/BadgePickerModal';
import { useDisplayBadges } from '@/src/hooks/useDisplayBadges';
import { ProfileStoriesSection } from '@/src/components/profile/ProfileStoriesSection';
import { ProfileBadges } from '@/src/components/profile/ProfileBadges';
import { StoryViewerModal } from '@/src/components/profile/StoryViewerModal';
import { StoryComposer } from '@/src/components/profile/StoryComposer';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import { useMyStories, useViewedStories } from '@/src/hooks/useStories';
import { useTournamentResults } from '@/src/hooks/useTournamentResults';
import { useFriendsContext } from '@/src/context/FriendsContext';
import { useFeedContext } from '@/src/context/FeedContext';
import { ProfilePostsGrid } from '@/src/components/profile/ProfilePostsGrid';
import { useUserFeedPosts } from '@/src/hooks/useUserFeedPosts';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const GOLD = colors.gold;
const ACCENT_BLUE = colors.accentBlue;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuthContext();
  const gamification = useGamificationContext();
  const bottomPadding = useBottomSafePadding();
  const [levelRoadmapVisible, setLevelRoadmapVisible] = useState(false);
  const [bannerUri, setBannerUri] = useState<string | null>(null);

  const handleBannerChange = async (uri: string) => {
    setBannerUri(uri);
    if (!user?.id) return;
    try {
      const path = mediaPath.banner(user.id);
      console.log('[MEDIA] banner upload start', { bucket: 'media', path });
      await uploadImageAsJpegToStorage('media', path, uri);
      await updateUserProfile(user.id, { banner_url: path });
      console.log('[MEDIA] banner upload complete', { bucket: 'media', path });
      await refreshProfile();
    } catch (e) {
      console.error('[MEDIA] banner upload failed:', e);
    }
  };

  const { stories: myStories, refresh: refreshMyStories, addStory, removeStory, removeStoriesForDay } = useMyStories();
  const { viewedIds, markViewed, refresh: refreshViewedIds } = useViewedStories();
  const activeStory = myStories[0] ?? null;
  const allStoriesViewed = myStories.length > 0 && myStories.every((s) => viewedIds.has(s.id));

  const { allResults: tournamentResults, refresh: refreshTournamentResults } = useTournamentResults(user?.id ?? null);
  const { friends } = useFriendsContext();
  const { displayedIds: displayedBadgeIds, setDisplayedIds: setDisplayedBadgeIds } = useDisplayBadges(user?.id);
  const [showBadgePicker, setShowBadgePicker] = useState(false);

  const earnedBadges = useMemo((): EarnedBadgeItem[] => {
    const list: EarnedBadgeItem[] = [];
    const level = gamification.levelInfo?.level ?? 1;
    for (let lv = 2; lv <= level; lv++) {
      const unlocks = LEVEL_UNLOCKS[lv] ?? [];
      const roadmap = LEVEL_ROADMAP[lv - 1];
      const icon = roadmap?.icon ?? '🎖️';
      for (const u of unlocks) {
        if (u.type !== 'BADGE') continue;
        const id = `level-${lv}-${u.label.replace(/\s+/g, '-').toLowerCase()}`;
        list.push({ id, label: u.label, icon });
      }
    }
    tournamentResults.forEach((r) => {
      const palette = PLACE_PALETTE[r.place];
      list.push({
        id: `tournament-${r.id}`,
        label: `${r.tournament_name} · ${palette.label}`,
        icon: palette.medal,
      });
    });
    return list;
  }, [gamification.levelInfo?.level, tournamentResults]);

  const [globalRank, setGlobalRank] = useState<number | null>(null);

  const fetchGlobalRank = useCallback(async () => {
    if (!user?.id) return;
    const rank = await getUserGlobalRank(user.id);
    setGlobalRank(rank);
  }, [user?.id]);

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileData, setProfileData] = useState<{
    totalCatches: number;
    friendsCount: number;
  } | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setProfileLoading(true);
    await getUserProfile(user.id);
    setProfileData({
      totalCatches: gamification.totalCatches ?? 0,
      friendsCount: 0,
    });
    setProfileLoading(false);
  }, [user?.id, gamification.totalCatches]);

  const { handlePostHype, handleAddComment } = useFeedContext();
  const { posts: myPosts, refresh: refreshMyPosts } = useUserFeedPosts(user?.id, {
    display_name: user?.displayName,
    username: user?.username,
    avatar_url: user?.avatarUrl,
  });

  useFocusEffect(
    useCallback(() => {
      refreshMyStories();
      refreshViewedIds();
      refreshTournamentResults();
      fetchGlobalRank();
      refreshMyPosts();
      if (user?.id && gamification.loaded) loadProfile();
    }, [refreshMyStories, refreshViewedIds, refreshTournamentResults, fetchGlobalRank, refreshMyPosts, loadProfile, user?.id, gamification.loaded])
  );

  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);

  // Run on mount and whenever gamification finishes loading so level is always fresh
  useEffect(() => {
    if (!user?.id || !gamification.loaded) return;
    loadProfile();
  }, [user?.id, gamification.loaded, loadProfile]);

  const displayName = user?.displayName || user?.username || 'Angler';
  const location = user?.location || user?.city || user?.state;
  const totalCatches = profileData?.totalCatches ?? gamification.totalCatches ?? 0;
  const friendsCount = profileData?.friendsCount ?? 0;

  const [storyComposerUri, setStoryComposerUri] = useState<string | null>(null);

  const handleAddStory = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setStoryComposerUri(result.assets[0].uri);
    }
  };

  const handleStoryComposerPost = async (uri: string, caption: string | null) => {
    try {
      const story = await addStory(uri, caption);
      if (story) {
        refreshMyStories();
        setStoryComposerUri(null);
        setShowStoryViewer(true);
        setStoryViewerIndex(0);
      }
    } catch (e) {
      console.error('Story save failed:', e);
      Alert.alert('Could not save story', 'Please try again.');
    }
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out my fishing profile on Snagged! ${displayName} - ${totalCatches} catches logged.`,
        title: 'Share Profile',
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e?.message === 'User did not share' || e?.message?.toLowerCase?.().includes('cancel')) return;
      Alert.alert('Share failed', 'Could not share profile.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      {/* Top nav */}
      <View style={styles.topBar}>
        <SnaggedWordmark />
        <View style={styles.navRight}>
          <TouchableOpacity
            style={styles.coinsChip}
            onPress={() => router.push('/coin-shop')}
            activeOpacity={0.8}
          >
            <Text style={styles.coinsChipEmoji}>💰</Text>
            <Text style={styles.coinsChipAmount}>{(gamification.coins ?? 0).toLocaleString()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push('/(tabs)/friends')}
          >
            <Ionicons name="people-outline" size={22} color={colors.lightSubtext} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Feather name="settings" size={22} color={colors.lightSubtext} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {(profileLoading || !gamification.loaded) ? (
          <View style={styles.skeleton}>
            <ActivityIndicator size="large" color={GOLD} />
            <Text style={styles.skeletonText}>Loading profile...</Text>
          </View>
        ) : (
          <>
        <ProfileHeader
          bannerUri={bannerUri ?? user?.bannerUrl ?? null}
          onBannerChange={handleBannerChange}
          editable={true}
          avatarUri={user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
          username={displayName}
          proVerified={user?.subscriptionPlan === 'pro'}
          globalRank={globalRank ?? undefined}
          level={gamification.levelInfo.level}
          xpInLevel={gamification.levelInfo.xpInLevel}
          xpForNext={gamification.levelInfo.xpForNext}
          location={location}
          catches={totalCatches}
          species={gamification.caughtSpecies?.size ?? 0}
          wins={0}
          friends={friends.length}
          onFriendsPress={() => router.push('/(tabs)/friends')}
          onStatPress={(stat) => {
            if (stat === 'catches' || stat === 'species' || stat === 'wins') {
              router.push('/(tabs)/logbook');
            }
          }}
          activeStory={activeStory ? { media_url: activeStory.media_url, id: activeStory.id } : null}
          storyAllViewed={allStoriesViewed}
          stories={myStories.map((s) => ({ media_url: s.media_url, id: s.id, media_path: s.media_path, caption: s.caption }))}
          onPickStoryImage={(uri) => setStoryComposerUri(uri)}
          onOpenStoryViewer={(index = 0) => {
            setStoryViewerIndex(index);
            setShowStoryViewer(true);
          }}
          earnedBadges={earnedBadges}
          displayedBadgeIds={displayedBadgeIds}
          onEditBadges={() => setShowBadgePicker(true)}
        />

        {user?.bio ? (
          <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text>
        ) : null}

        {/* Stories — own profile only */}
        <ProfileStoriesSection
          stories={myStories}
          isOwnProfile={true}
          viewedIds={viewedIds}
          onAddStory={handleAddStory}
          onGroupPress={(groupStories, startIdx) => {
            const globalIdx = myStories.findIndex((s) => s.id === groupStories[startIdx]?.id);
            setStoryViewerIndex(globalIdx >= 0 ? globalIdx : 0);
            setShowStoryViewer(true);
          }}
          onDeleteGroup={async (storyIds) => {
            await removeStoriesForDay(storyIds);
            setShowStoryViewer(false);
          }}
        />

        {/* Badges — directly under stories */}
        <ProfileBadges
          results={tournamentResults}
          username={displayName}
          avatarUrl={user?.avatarUrl ?? null}
          onViewLeaderboard={(tournamentId) => {
            router.push({ pathname: '/(tabs)/tournaments', params: { tournamentId } });
          }}
        />

        {/* 3. Posts — feed posts and shared logs by this user */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Posts</Text>
          {myPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No posts yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Share a catch to the feed or create a post from the home screen
              </Text>
              <TouchableOpacity
                style={styles.logbookButton}
                onPress={() => router.push('/(tabs)')}
              >
                <Text style={styles.logbookButtonText}>Go to Feed</Text>
                <Feather name="arrow-right" size={18} color={ACCENT_BLUE} />
              </TouchableOpacity>
            </View>
          ) : (
            <ProfilePostsGrid
              posts={myPosts}
              onHype={handlePostHype}
              onAddComment={handleAddComment}
            />
          )}
        </View>

        <LevelRoadmapModal
          visible={levelRoadmapVisible}
          onClose={() => setLevelRoadmapVisible(false)}
          currentLevel={Math.min(gamification.levelInfo.level, MAX_LEVEL)}
        />

        <BadgePickerModal
          visible={showBadgePicker}
          earnedBadges={earnedBadges}
          displayedIds={displayedBadgeIds}
          onSave={(ids) => {
            setDisplayedBadgeIds(ids);
            setShowBadgePicker(false);
          }}
          onClose={() => setShowBadgePicker(false)}
        />

        <StoryComposer
          visible={!!storyComposerUri}
          imageUri={storyComposerUri ?? ''}
          onPost={handleStoryComposerPost}
          onCancel={() => setStoryComposerUri(null)}
        />

        <StoryViewerModal
          visible={showStoryViewer && myStories.length > 0}
          stories={myStories.map((s) => ({
            id: s.id,
            media_path: s.media_path,
            media_url: s.media_url,
            caption: s.caption,
          }))}
          currentIndex={storyViewerIndex}
          onPrev={() => {
            if (storyViewerIndex > 0) setStoryViewerIndex((i) => i - 1);
            else setShowStoryViewer(false);
          }}
          onNext={() => {
            if (storyViewerIndex < myStories.length - 1) setStoryViewerIndex((i) => i + 1);
            else setShowStoryViewer(false);
          }}
          onClose={() => setShowStoryViewer(false)}
          onStoryViewed={markViewed}
          isOwnProfile={true}
          onDeleteStory={async (storyId) => {
            await removeStory(storyId);
            // Clamp the viewer index if we deleted the last item
            setStoryViewerIndex((i) => Math.max(0, Math.min(i, myStories.length - 2)));
            if (myStories.length <= 1) setShowStoryViewer(false);
          }}
        />

        <TouchableOpacity
          style={styles.sectionCard}
          onPress={() => router.push('/(tabs)/passport')}
        >
          <Ionicons name="book-outline" size={24} color={GOLD} />
          <View style={styles.badgesContent}>
            <Text style={styles.badgesTitle}>Fishing Passport</Text>
            <Text style={styles.badgesSubtext}>
              {gamification.caughtSpecies.size} species collected
            </Text>
          </View>
          <Feather name="chevron-right" size={22} color={colors.lightSubtext} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/(tabs)/profile-edit')}
        >
          <Feather name="edit-2" size={16} color={colors.lightText} />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        {/* View Logbook */}
        <TouchableOpacity
          style={styles.logbookButton}
          onPress={() => router.push('/(tabs)/logbook')}
        >
          <Text style={styles.logbookButtonText}>View Logbook</Text>
          <Feather name="arrow-right" size={18} color={ACCENT_BLUE} />
        </TouchableOpacity>

        {/* Share Profile */}
        <TouchableOpacity style={styles.shareButton} onPress={handleShareProfile}>
          <Feather name="share-2" size={18} color={ACCENT_BLUE} />
          <Text style={styles.shareButtonText}>Share Profile</Text>
        </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navRight: {
    flexDirection: 'row',
    gap: 10,
  },
  coinsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,184,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.35)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 4,
  },
  coinsChipEmoji: {
    fontSize: 14,
  },
  coinsChipAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFB800',
  },
  content: {
    paddingHorizontal: 12,
  },
  bio: {
    fontSize: 14,
    color: colors.lightText,
    marginTop: 12,
    marginBottom: 12,
    lineHeight: 20,
  },
  xpSection: {
    marginBottom: 10,
  },
  xpCard: {
    backgroundColor: colors.lightCard,
    borderRadius: CARD_RADIUS_LG,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    ...cardShadowLight,
  },
  badgesSection: {
    marginBottom: 10,
  },
  badgesSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.lightSubtext,
    marginBottom: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightCard,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: CARD_RADIUS_LG,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    gap: 6,
  },
  badgeEmoji: {
    fontSize: 20,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.lightText,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    marginBottom: 8,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.lightText,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: ACCENT_BLUE,
    borderRadius: CARD_RADIUS_LG,
    paddingVertical: 12,
    alignItems: 'center',
    ...cardShadowLight,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    color: '#FFFFFF',
  },
  statValueBlue: {
    color: '#FFFFFF',
  },
  statValueOrange: {
    color: '#FFFFFF',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trophyIcon: {
    marginLeft: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightCard,
    padding: 12,
    borderRadius: CARD_RADIUS_LG,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    gap: 10,
    ...cardShadowLight,
  },
  sectionCardText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightText,
  },
  badgesContent: {
    flex: 1,
  },
  badgesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.lightText,
    marginBottom: 2,
  },
  badgesSubtext: {
    fontSize: 13,
    color: colors.lightSubtext,
  },
  logbookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  logbookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: ACCENT_BLUE,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    backgroundColor: colors.lightCard,
    borderRadius: CARD_RADIUS_LG,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    ...cardShadowLight,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: ACCENT_BLUE,
  },
  skeleton: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  skeletonText: {
    fontSize: 14,
    color: colors.lightSubtext,
  },
  emptyState: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.lightCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.lightSubtext,
    fontStyle: 'italic',
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 2,
    marginBottom: 8,
  },
  recentSection: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 8,
  },
});
