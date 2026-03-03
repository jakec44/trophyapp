import { useRef, useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import { useHomeTournaments } from '@/src/hooks/useHomeTournaments';
import { StoriesRow } from '@/src/components/home/StoriesRow';
import { FeedPostCard } from '@/src/components/home/FeedPostCard';
import { TournamentBanner } from '@/src/components/home/TournamentBanner';
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
  const { user } = useAuthContext();
  const bottomPadding = useBottomSafePadding();
  const [createPostVisible, setCreatePostVisible] = useState(false);
  const {
    tournaments,
    refreshing,
    voteLoading,
    couldPlace,
    handleRefresh,
    handleVote,
  } = useHomeTournaments('global', user?.id);

  const { feedPosts, refreshFeed, handlePostHype, handleAddComment } = useFeedContext();
  const { stories: friendStories, refresh: refreshStories, markAsSeen: markStorySeen } = useFriendStories();

  useFocusEffect(
    useCallback(() => {
      refreshStories();
      refreshFeed();
    }, [refreshStories, refreshFeed])
  );

  // Soonest-ending active tournament for the live banner
  const soonestTournament = tournaments
    .filter((t) => t.endsAt && new Date(t.endsAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.endsAt!).getTime() - new Date(b.endsAt!).getTime())[0] ?? null;

  const launchCamera = () => router.push('/camera');
  const launchPhotoLibrary = () => router.push('/photo-picker');
  const handleVoteGated = (entryId: string, vote: 'UP' | 'DOWN' | null) =>
    handleVote(entryId, vote);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SnaggedWordmark />
          <TouchableOpacity
            style={styles.postBtn}
            onPress={() => setCreatePostVisible(true)}
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
            onPress={() => router.push('/(tabs)/messages')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.headerIconWrap}>
              <Ionicons name="chatbubble-outline" size={22} color={colors.lightText} />
              {couldPlace && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>1</Text>
                </View>
              )}
            </View>
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
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
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
        {/* Tournament banner — pinned to top of feed */}
        {soonestTournament && <TournamentBanner tournament={soonestTournament} />}

        {/* Stories row — Friends only */}
        {friendStories.length > 0 && (
          <View style={styles.crewSection}>
            <Text style={styles.sectionLabelBlue}>Stories</Text>
            <StoriesRow stories={friendStories} onStoryViewed={markStorySeen} />
          </View>
        )}

        {/* 4. Social catch feed — Recent entries */}
        <View style={styles.feedSection}>
          <Text style={styles.sectionLabel}>Recent Entries</Text>
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
              <FeedPostCard
                key={post.id}
                post={post}
                onHype={handlePostHype}
                onAddComment={handleAddComment}
              />
            ))
          )}
        </View>

        {/* 4. Stats bar */}
        <StatsBar />

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
    paddingVertical: 8,
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
    marginBottom: 8,
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
});
