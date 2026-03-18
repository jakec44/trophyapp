import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import { useOnboardingOverlay } from '@/src/context/OnboardingOverlayContext';
import { useHomeTournaments } from '@/src/hooks/useHomeTournaments';
import { StoriesRow } from '@/src/components/home/StoriesRow';
import { FeedPostCard } from '@/src/components/home/FeedPostCard';
import { DailyQuestsCard } from '@/src/components/home/DailyQuestsCard';
import { useDailyQuests } from '@/src/hooks/useDailyQuests';
import { CreatePostModal } from '@/src/components/home/CreatePostModal';
import { useFriendStories } from '@/src/hooks/useFriendStories';
import type { FeedComment } from '@/utils/feedMockData';
import { useFeedContext } from '@/src/context/FeedContext';
import { mockUserProfile } from '@/utils/mockData';
import { useGamificationContext } from '@/src/context/GamificationContext';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { PASSPORT_SPECIES } from '@/utils/gamificationData';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_HAS_SEEN = 'hasSeenOnboarding';
const ONBOARDING_HOME_DISMISSED = 'hasDismissedHomeOverlay';

function StatsBar() {
  const { levelInfo, caughtSpecies } = useGamificationContext();
  const totalCaught = caughtSpecies.size;
  const totalSpecies = PASSPORT_SPECIES.length;

  return (
    <View style={statsStyles.row}>
      <View style={statsStyles.stat}>
        <Text style={statsStyles.value}>{levelInfo.title}</Text>
        <Text style={statsStyles.label}>Level</Text>
      </View>
      <View style={statsStyles.divider} />
      <View style={statsStyles.stat}>
        <Text style={statsStyles.value}>
          {totalCaught}/{totalSpecies}
        </Text>
        <Text style={statsStyles.label}>Passport</Text>
      </View>
    </View>
  );
}

const   statsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.lightCard,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.lightText,
  },
  label: {
    fontSize: 11,
    color: colors.lightSubtext,
    marginTop: 2,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.lightBorder,
  },
});

function PulsingLogButton({ onPress }: { onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.02,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.98,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scaleAnim]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={{ width: '100%' }}>
      <Animated.View
        style={[
          logButtonStyles.button,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Feather name="camera" size={26} color="#FFFFFF" />
        <Text style={logButtonStyles.text}>Log a Catch</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const   logButtonStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.brightBlue,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#0066FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  text: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

export default function HomeScreen() {
  const router = useRouter();
  const { postId: highlightPostId } = useLocalSearchParams<{ postId?: string }>();
  const { user } = useAuthContext();
  const bottomPadding = useBottomSafePadding();
  const [createPostVisible, setCreatePostVisible] = useState(false);
  const [showOnboardingOverlay, setShowOnboardingOverlay] = useState<boolean | null>(null);
  const arrowAnim = useRef(new Animated.Value(0)).current;
  const { setHideTabBar } = useOnboardingOverlay();

  useEffect(() => {
    setHideTabBar(showOnboardingOverlay === true);
    return () => setHideTabBar(false);
  }, [showOnboardingOverlay, setHideTabBar]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [seen, dismissed] = await Promise.all([
            AsyncStorage.getItem(ONBOARDING_HAS_SEEN),
            AsyncStorage.getItem(ONBOARDING_HOME_DISMISSED),
          ]);
          if (!cancelled) {
            setShowOnboardingOverlay(seen !== '1' && dismissed !== '1');
          }
        } catch {
          if (!cancelled) setShowOnboardingOverlay(false);
        }
      })();
      return () => { cancelled = true; };
    }, [])
  );

  useEffect(() => {
    if (!showOnboardingOverlay) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showOnboardingOverlay, arrowAnim]);

  const handleOnboardingLogPress = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_HOME_DISMISSED, '1');
      setShowOnboardingOverlay(false);
      router.push('/camera');
    } catch {
      setShowOnboardingOverlay(false);
      router.push('/camera');
    }
  }, [router]);

  const {
    refreshing,
    voteLoading,
    handleRefresh,
    handleVote,
  } = useHomeTournaments('global', user?.id);

  const { feedPosts, refreshFeed, handlePostHype, handleAddComment, handleShare, loadComments, handleDeletePost } = useFeedContext();
  const { stories: friendStories, refresh: refreshStories, markAsSeen: markStorySeen } = useFriendStories();
  const { claimableCount, countdown: questCountdown, refresh: refreshDailyQuests } = useDailyQuests();

  const [isScreenFocused, setIsScreenFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      refreshStories();
      refreshFeed();
      refreshDailyQuests();
      return () => setIsScreenFocused(false);
    }, [refreshStories, refreshFeed, refreshDailyQuests])
  );

  const launchCamera = () => {
    if (!user?.id) { router.replace('/(tabs)/profile'); return; }
    router.push('/camera');
  };
  const launchPhotoLibrary = () => {
    if (!user?.id) { router.replace('/(tabs)/profile'); return; }
    router.push('/photo-picker');
  };
  const handleVoteGated = (entryId: string, vote: 'UP' | 'DOWN' | null) => {
    if (!user?.id) { router.replace('/(tabs)/profile'); return; }
    handleVote(entryId, vote);
  };

  const [showStatsBar, setShowStatsBar] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const feedSectionYRef = useRef(0);
  const cardLayoutsRef = useRef<Record<string, { y: number; height: number }>>({});
  const [cardLayouts, setCardLayouts] = useState<Record<string, { y: number; height: number }>>({});
  const pendingScrollPostIdRef = useRef<string | null>(null);
  const scrolledToHighlightRef = useRef<string | null>(null);

  // When opened from chat shared post: scroll feed to that post
  useEffect(() => {
    if (!highlightPostId) {
      scrolledToHighlightRef.current = null;
      return;
    }
    if (!scrollViewRef.current || scrolledToHighlightRef.current === highlightPostId) return;
    const layout = cardLayoutsRef.current[highlightPostId];
    if (!layout?.height) return;
    scrolledToHighlightRef.current = highlightPostId;
    const targetY = Math.max(0, feedSectionYRef.current + layout.y - 24);
    scrollViewRef.current.scrollTo({ y: targetY, animated: true });
  }, [highlightPostId, cardLayouts]);

  const scrollToShowCommentInput = useCallback((postId: string) => {
    pendingScrollPostIdRef.current = postId;
  }, []);

  const flushScrollToComment = useCallback((postId: string, cardY: number, cardHeight: number) => {
    if (pendingScrollPostIdRef.current !== postId || !scrollViewRef.current) return;
    const { height: windowHeight } = Dimensions.get('window');
    const targetY = Math.max(0, feedSectionYRef.current + cardY + cardHeight - windowHeight + 220);
    scrollViewRef.current.scrollTo({ y: targetY, animated: true });
    pendingScrollPostIdRef.current = null;
  }, []);

  const [scrollState, setScrollState] = useState({ y: 0, viewportHeight: Dimensions.get('window').height });

  const focusedVideoPostId = useMemo(() => {
    const scrollY = scrollState.y;
    const vh = scrollState.viewportHeight;
    const feedY = feedSectionYRef.current;
    const layouts = cardLayouts;
    let bestId: string | null = null;
    let bestFraction = 0.5;
    for (const post of feedPosts) {
      const layout = layouts[post.id];
      if (!layout || layout.height <= 0) continue;
      const cardTop = feedY + layout.y;
      const cardBottom = cardTop + layout.height;
      const visTop = Math.max(cardTop, scrollY);
      const visBottom = Math.min(cardBottom, scrollY + vh);
      const visHeight = Math.max(0, visBottom - visTop);
      const fraction = visHeight / layout.height;
      if (fraction >= 0.5 && fraction > bestFraction) {
        bestFraction = fraction;
        bestId = post.id;
      }
    }
    return bestId;
  }, [scrollState.y, scrollState.viewportHeight, feedPosts, cardLayouts]);

  const onScroll = useCallback(
    ({ nativeEvent }: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
      setScrollState({ y: contentOffset.y, viewportHeight: layoutMeasurement.height });
      const scrollBottom = contentOffset.y + layoutMeasurement.height;
      const nearBottom = scrollBottom >= contentSize.height - 80;
      setShowStatsBar((prev) => (nearBottom ? false : true));
    },
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SnaggedWordmark />
          <TouchableOpacity
            style={styles.postBtn}
            onPress={() => { if (!user?.id) router.replace('/(tabs)/profile'); else setCreatePostVisible(true); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.postBtnPlus}>+</Text>
            <Text style={styles.postBtnLabel}>Post</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push('/(tabs)/friends')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="people-outline" size={24} color={colors.lightText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => { if (!user?.id) router.replace('/(tabs)/profile'); else router.push('/(tabs)/messages'); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chatbubble-outline" size={22} color={colors.lightText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push('/search')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="search-outline" size={24} color={colors.lightText} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={100}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              handleRefresh();
              await refreshFeed();
            }}
            tintColor={colors.accentBlue}
          />
        }
      >
        {/* Daily Quests — replaces Ending Soon */}
        <DailyQuestsCard claimableCount={claimableCount} countdown={questCountdown} />

        {/* Stories row — Friends only */}
        {friendStories.length > 0 && (
          <View style={styles.crewSection}>
            <Text style={styles.sectionLabelBlue}>Stories</Text>
            <StoriesRow stories={friendStories} onStoryViewed={markStorySeen} />
          </View>
        )}

        {/* Feed */}
        <View
          style={styles.feedSection}
          onLayout={(e) => { feedSectionYRef.current = e.nativeEvent.layout.y; }}
        >
          {feedPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Start your first log</Text>
              <Text style={styles.emptySubtext}>
                Log a catch to see it here and earn XP
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={launchCamera}
                activeOpacity={0.85}
              >
                <Feather name="camera" size={20} color="#FFFFFF" />
                <Text style={styles.emptyCtaText}>Log a catch (+XP)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            feedPosts.map((post) => (
              <View
                key={post.id}
                onLayout={(e) => {
                  const { y, height } = e.nativeEvent.layout;
                  cardLayoutsRef.current[post.id] = { y, height };
                  setCardLayouts((prev) => ({ ...prev, [post.id]: { y, height } }));
                  flushScrollToComment(post.id, y, height);
                }}
              >
                <FeedPostCard
                  post={post}
                  isScreenFocused={isScreenFocused}
                  shouldPlayVideo={post.id === focusedVideoPostId}
                  onHype={(postId, hyped) => {
                    if (!user?.id) { router.replace('/(tabs)/profile'); return; }
                    handlePostHype(postId, hyped);
                  }}
                  onAddComment={(postId, text, replyMeta) => {
                    if (!user?.id) { router.replace('/(tabs)/profile'); return; }
                    handleAddComment(postId, text, replyMeta);
                  }}
                  onShare={(postId) => {
                    if (!user?.id) { router.replace('/(tabs)/profile'); return; }
                    handleShare(postId);
                  }}
                  loadComments={loadComments}
                  onScrollToShowComments={scrollToShowCommentInput}
                  canDelete={user?.id === post.userId || user?.isModerator === true}
                  onDelete={handleDeletePost}
                />
              </View>
            ))
          )}
        </View>

        {/* 4. Stats bar — hidden when scrolled to bottom */}
        {showStatsBar && <StatsBar />}

        {/* 5. Log a Catch button */}
        <PulsingLogButton onPress={launchCamera} />
        <TouchableOpacity
          style={styles.uploadSecondary}
          onPress={launchPhotoLibrary}
          activeOpacity={0.8}
        >
          <Feather name="image" size={20} color={colors.accentBlue} />
          <Text style={styles.uploadSecondaryText}>or upload from library</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* First-time onboarding overlay: dark overlay, avatar, text, arrow; only proceed by tapping Log */}
      {showOnboardingOverlay === true && (
        <View style={[StyleSheet.absoluteFill, styles.onboardingOverlay]} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => {}} />
          <View style={styles.onboardingContent} pointerEvents="none">
            <View style={styles.onboardingAvatarBubble}>
              <Text style={styles.onboardingAvatarEmoji}>🎣</Text>
            </View>
            <Text style={styles.onboardingText}>Let's get you started. Log your first fish.</Text>
            <Animated.View
              style={[
                styles.onboardingArrowWrap,
                {
                  opacity: arrowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
                  transform: [
                    { translateY: arrowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) },
                  ],
                },
              ]}
            >
              <Ionicons name="chevron-down" size={32} color="#fff" />
            </Animated.View>
          </View>
          <View style={styles.onboardingLogButtonWrap} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.onboardingLogButton}
              onPress={handleOnboardingLogPress}
              activeOpacity={0.9}
            >
              <Feather name="camera" size={26} color="#FFFFFF" />
              <Text style={styles.onboardingLogButtonText}>Log a Catch</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <CreatePostModal
        visible={createPostVisible}
        onClose={() => setCreatePostVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  postBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#00e5c8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  postBtnPlus: {
    fontSize: 28,
    fontWeight: '300',
    color: '#ffffff',
    lineHeight: 30,
  },
  postBtnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIcon: {
    padding: 8,
  },
  headerIconWrap: {
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loadingWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  crewSection: {
    marginBottom: 0,
  },
  feedSection: {
    paddingHorizontal: 0,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.lightSubtext,
    paddingHorizontal: 16,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  sectionLabelBlue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.brightBlue,
    paddingHorizontal: 16,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: 'center',
    backgroundColor: colors.lightCard,
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginBottom: 20,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brightBlue,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    minHeight: 44,
    minWidth: 44,
  },
  emptyCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  uploadSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  uploadSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  bottomSpacer: {
    height: 24,
  },
  onboardingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  onboardingBlocker: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  onboardingContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 140,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  onboardingAvatarBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,229,200,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  onboardingAvatarEmoji: {
    fontSize: 32,
  },
  onboardingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  onboardingArrowWrap: {
    marginBottom: 8,
  },
  onboardingLogButtonWrap: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  onboardingLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.brightBlue,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0066FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  onboardingLogButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
