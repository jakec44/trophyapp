import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
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
  getAnglerRank,
} from '@/src/lib/supabase';
import { mediaPath } from '@/src/lib/mediaPaths';
import { uploadImageAsJpegToStorage } from '@/src/lib/supabase';
import { LevelRoadmapModal } from '@/src/components/gamification/LevelRoadmapModal';
import { MAX_LEVEL, MAX_PRESTIGE, LEVEL_UNLOCKS, LEVEL_ROADMAP } from '@/src/types/gamification';
import { PLACE_PALETTE } from '@/src/types/tournamentResults';
import { ProfileHeader, type EarnedBadgeItem } from '@/src/components/profile/ProfileHeader';
import { useDisplayBadges } from '@/src/hooks/useDisplayBadges';
import { useProfileDisplayItems } from '@/src/hooks/useProfileDisplayItems';
import { ProfileStoriesSection } from '@/src/components/profile/ProfileStoriesSection';
import { DisplayBadgesSheet, type DisplaySelectionItem } from '@/src/components/profile/DisplayBadgesSheet';
import { TrophyDetailModal, TrophyViewOnlyModal } from '@/src/components/profile/TrophyDetailModal';
import { BadgeDetailModal } from '@/src/components/profile/BadgeDetailModal';
import { getBadgeDisplayInfo, getUnlockCatchesForBadge } from '@/src/lib/speciesMastery';
import { StoryViewerModal } from '@/src/components/profile/StoryViewerModal';
import { StoryComposer } from '@/src/components/profile/StoryComposer';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import { useMyStories, useViewedStories } from '@/src/hooks/useStories';
import { useTournamentResults } from '@/src/hooks/useTournamentResults';
import { useSpeciesBadges } from '@/src/hooks/useSpeciesBadges';
import { useFriendsContext } from '@/src/context/FriendsContext';
import { useFeedContext } from '@/src/context/FeedContext';
import { ProfilePostsGrid } from '@/src/components/profile/ProfilePostsGrid';
import { useUserFeedPosts } from '@/src/hooks/useUserFeedPosts';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { devLog, isDev } from '@/src/lib/env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { consumePendingFlyReward } from '@/src/lib/flyRewardStore';
import { AuthGateModal } from '@/src/components/auth/AuthGateModal';

const ONBOARDING_FIRST_CATCH_PENDING = 'onboarding_first_catch_pending';

const GOLD = colors.gold;
const ACCENT_BLUE = colors.accentBlue;

const XP_ICON = '⭐';
const FLY_COUNT = isDev ? 5 : 10;

function useFlyRewardAnimation() {
  const [flyReward, setFlyReward] = useState<{ xp: number } | null>(null);
  const xpAnims = useRef(
    Array.from({ length: FLY_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useFocusEffect(
    useCallback(() => {
      const reward = consumePendingFlyReward();
      if (!reward || reward.xp <= 0) return;
      setFlyReward(reward);
      const SW = 360;
      const XP_TARGET = { x: -SW * 0.25, y: 50 };
      const run = (anim: { x: Animated.Value; y: Animated.Value; opacity: Animated.Value }, tx: number, ty: number, delay: number) => {
        anim.x.setValue(0);
        anim.y.setValue(0);
        anim.opacity.setValue(1);
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim.x, { toValue: tx, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
            Animated.timing(anim.y, { toValue: ty, duration: 700, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
          ]),
          Animated.timing(anim.opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();
      };
      const jitter = () => (Math.random() - 0.5) * 20;
      for (let i = 0; i < FLY_COUNT; i++) {
        run(xpAnims[i], XP_TARGET.x + jitter(), XP_TARGET.y + jitter(), i * 40);
      }
      const t = setTimeout(() => setFlyReward(null), 1600);
      return () => clearTimeout(t);
    }, [])
  );

  return { flyReward, xpAnims };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuthContext();
  const gamification = useGamificationContext();
  const bottomPadding = useBottomSafePadding();
  const [levelRoadmapVisible, setLevelRoadmapVisible] = useState(false);
  const [bannerUri, setBannerUri] = useState<string | null>(null);

  const { flyReward, xpAnims } = useFlyRewardAnimation();

  const handleBannerChange = async (uri: string) => {
    setBannerUri(uri);
    if (!user?.id) return;
    try {
      const path = mediaPath.banner(user.id);
      devLog('[MEDIA] banner upload start', { bucket: 'media', path });
      await uploadImageAsJpegToStorage('media', path, uri);
      await updateUserProfile(user.id, { banner_url: path });
      devLog('[MEDIA] banner upload complete', { bucket: 'media', path });
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
  const { badges: speciesBadges, refresh: refreshSpeciesBadges } = useSpeciesBadges(user?.id ?? null);
  const { friends } = useFriendsContext();
  const { displayedIds: displayedBadgeIds, setDisplayedIds: setDisplayedBadgeIds } = useDisplayBadges(user?.id);
  const { items: profileDisplayItems, trophies: userTrophies, save: saveProfileDisplayItems, refresh: refreshDisplayItems } = useProfileDisplayItems(user?.id ?? null);
  const [showBadgePicker, setShowBadgePicker] = useState(false);
  const [selectedTrophyForModal, setSelectedTrophyForModal] = useState<import('@/src/lib/supabase').TrophyWithDetails | null>(null);
  const [selectedTrophyViewOnly, setSelectedTrophyViewOnly] = useState<import('@/src/components/profile/TrophyDetailModal').TrophyViewOnlyPayload | null>(null);
  const [selectedBadgeForModal, setSelectedBadgeForModal] = useState<{
    name: string;
    unlockHint: string;
    rarity: import('@/src/types/badgeRarity').BadgeRarity;
    badgeKey: string;
    unlockCatches: import('@/src/lib/speciesMastery').UnlockCatch[];
  } | null>(null);

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
        id: `tournament-${r.place}-${r.id}`,
        label: `${r.tournament_name} · ${palette.label}`,
        icon: '🏆',
      });
    });
    list.push(...speciesBadges);
    return list;
  }, [gamification.levelInfo?.level, tournamentResults, speciesBadges]);

  const displayItemsWithLabels = useMemo(() => {
    return profileDisplayItems.map((item) => {
      if (item.type === 'badge') {
        const earned = earnedBadges.find((b) => b.id === item.badgeKey || b.id === `badge-${item.badgeKey}`);
        return { ...item, label: earned?.label ?? item.label, icon: earned?.icon ?? item.icon };
      }
      return item;
    });
  }, [profileDisplayItems, earnedBadges]);

  const displaySheetInitialSelection = useMemo((): DisplaySelectionItem[] => {
    return profileDisplayItems.map((item) => {
      if (item.type === 'badge') return { type: 'badge', badge_key: item.badgeKey };
      if (item.type === 'trophy' && item.trophyId.startsWith('tournament-')) return { type: 'badge', badge_key: item.trophyId };
      return { type: 'trophy', trophy_id: item.trophyId };
    });
  }, [profileDisplayItems]);

  const [arRank, setArRank] = useState<number | null | undefined>(undefined);
  const [localRank, setLocalRank] = useState<number | null | undefined>(undefined);
  const [anglerRating, setAnglerRating] = useState<number>(0);
  const [prestige, setPrestige] = useState<number>(0);

  const fetchARRank = useCallback(async () => {
    if (!user?.id) return;
    const profile = await getUserProfile(user.id);
    const p = profile as { angler_rating?: number; prestige?: number };
    setAnglerRating(p?.angler_rating ?? 0);
    setPrestige(Math.min(MAX_PRESTIGE, Math.max(0, p?.prestige ?? 0)));
    const [globalResult, localResult] = await Promise.all([
      getAnglerRank(user.id, 'global', null),
      user?.state ? getAnglerRank(user.id, 'local', user.state) : Promise.resolve({ rank: null }),
    ]);
    setArRank(globalResult.rank);
    setLocalRank(localResult?.rank ?? null);
  }, [user?.id, user?.state]);

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
      refreshSpeciesBadges();
      fetchARRank();
      refreshMyPosts();
      if (user?.id && gamification.loaded) loadProfile();
      if (!user?.id) {
        AsyncStorage.getItem(ONBOARDING_FIRST_CATCH_PENDING).then((v) => {
          const isFirstCatch = v === '1';
          setSaveCatchPrompt(isFirstCatch);
          if (isFirstCatch) setShowAuthGate(true);
        });
      } else {
        setSaveCatchPrompt(false);
      }
    }, [refreshMyStories, refreshViewedIds, refreshTournamentResults, fetchARRank, refreshMyPosts, loadProfile, user?.id, gamification.loaded])
  );

  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [saveCatchPrompt, setSaveCatchPrompt] = useState(false);

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

  const { width: SW } = Dimensions.get('window');
  const flyCenterX = SW / 2 - 8;
  const flyCenterY = 180;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      {/* Flying reward particles — XP icons */}
      {flyReward ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {xpAnims.map((anim, i) => (
            <Animated.Text
              key={`x-${i}`}
              style={[
                styles.flyIcon,
                {
                  left: flyCenterX,
                  top: flyCenterY,
                  opacity: anim.opacity,
                  transform: [{ translateX: anim.x }, { translateY: anim.y }],
                },
              ]}
            >
              {XP_ICON}
            </Animated.Text>
          ))}
        </View>
      ) : null}
      {/* Top nav */}
      <View style={styles.topBar}>
        <SnaggedWordmark />
        <View style={styles.navRight}>
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
        {!user ? (
          <View style={styles.signedOutProfile}>
            <Text style={styles.signedOutTitle}>
              {saveCatchPrompt ? 'Sign in to save your catch' : 'Your profile'}
            </Text>
            <Text style={styles.signedOutMessage}>
              {saveCatchPrompt
                ? 'Your catch is ready. Sign in to save it to your profile and start your logbook.'
                : 'Sign in to view your stats, edit your profile, and share catches.'}
            </Text>
            <TouchableOpacity
              style={styles.signedOutButton}
              onPress={() => setShowAuthGate(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.signedOutButtonText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        ) : (profileLoading || !gamification.loaded) ? (
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
          anglerRating={anglerRating}
          arRank={arRank ?? undefined}
          localRank={localRank ?? undefined}
          level={gamification.levelInfo.level}
          levelTitle={gamification.levelInfo.title}
          xpInLevel={gamification.levelInfo.xpInLevel}
          xpForNext={gamification.levelInfo.xpForNext}
          prestige={prestige}
          onLevelPress={() => {
            router.push({
              pathname: '/level-roadmap',
              params: {
                level: String(gamification.levelInfo.level),
                prestige: String(prestige),
                xpInLevel: String(gamification.levelInfo.xpInLevel ?? 0),
                xpForNext: String(gamification.levelInfo.xpForNext ?? 0),
              },
            });
          }}
          location={location}
          bio={user?.bio ?? undefined}
          catches={totalCatches}
          species={gamification.caughtSpecies?.size ?? 0}
          wins={tournamentResults.length}
          friends={friends.length}
          onFriendsPress={() => router.push('/(tabs)/friends')}
          onStatPress={(stat) => {
            if (stat === 'catches') router.push('/(tabs)/logbook');
            else if (stat === 'species') router.push('/(tabs)/passport');
            else if (stat === 'wins') router.push('/wins');
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
          displayItems={displayItemsWithLabels}
          onDisplayItemPress={async (item) => {
            if (item.type === 'badge' && item.badgeKey && user?.id) {
              const info = getBadgeDisplayInfo(item.badgeKey);
              const unlockCatches = await getUnlockCatchesForBadge(user.id, item.badgeKey, true);
              setSelectedBadgeForModal({
                name: item.label ?? info.name,
                unlockHint: info.unlockHint || `Unlocked: ${item.label}`,
                rarity: item.rarity ?? info.rarity,
                badgeKey: item.badgeKey,
                unlockCatches,
              });
            } else if (item.type === 'trophy') {
              const trophy = userTrophies.find((t) => t.id === item.trophyId);
              if (trophy) setSelectedTrophyForModal(trophy);
              else setSelectedTrophyViewOnly({ tournamentName: item.tournamentName, place: item.place, imageUrl: item.imageUrl });
            }
          }}
          onEditBadges={() => {
            refreshDisplayItems();
            setShowBadgePicker(true);
          }}
          onBadgePress={async (badge) => {
            if (!user?.id) return;
            const info = getBadgeDisplayInfo(badge.id);
            const unlockCatches = await getUnlockCatchesForBadge(user.id, badge.id, true);
            setSelectedBadgeForModal({
              name: badge.label ?? info.name,
              unlockHint: info.unlockHint || `Unlocked: ${badge.label}`,
              rarity: info.rarity,
              badgeKey: badge.id,
              unlockCatches,
            });
          }}
          onEditBio={() => router.push('/(tabs)/profile-edit')}
          onEditAvatar={() => router.push('/(tabs)/profile-edit')}
        />

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

        <DisplayBadgesSheet
          visible={showBadgePicker}
          trophies={userTrophies}
          earnedBadges={earnedBadges}
          userId={user?.id ?? null}
          initialSelection={displaySheetInitialSelection}
          onSave={async (selected) => {
            await saveProfileDisplayItems(selected);
            refreshDisplayItems();
            setShowBadgePicker(false);
          }}
          onClose={() => setShowBadgePicker(false)}
        />
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
          style={styles.sectionCard}
          onPress={() => router.push('/(tabs)/badges')}
        >
          <Ionicons name="trophy" size={24} color={GOLD} />
          <View style={styles.badgesContent}>
            <Text style={styles.badgesTitle}>Badge Collection</Text>
            <Text style={styles.badgesSubtext}>
              Species mastery badges
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

      <AuthGateModal
        visible={showAuthGate}
        action={saveCatchPrompt ? 'onboarding_first_catch' : 'view_profile'}
        onClose={() => setShowAuthGate(false)}
      />
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
  flyRewardBadge: {
    position: 'absolute',
    right: -4,
    top: -8,
    backgroundColor: '#FFB800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  flyRewardText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0d1624',
  },
  flyIcon: {
    position: 'absolute',
    fontSize: 14,
    width: 16,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 12,
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
  signedOutProfile: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  signedOutTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 12,
  },
  signedOutMessage: {
    fontSize: 16,
    color: colors.lightSubtext,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  signedOutButton: {
    backgroundColor: colors.brightBlue,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  signedOutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
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
