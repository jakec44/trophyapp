import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserLink } from '@/src/components/profile/UserLink';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';
import type { StoryItem } from '@/utils/feedMockData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AVATAR_SIZE = 68;
const STORY_RING_WIDTH = 3;
/** Blue ring when user hasn't viewed this friend's story yet */
const RING_UNWATCHED = '#3B82F6';
const RING_WATCHED = colors.lightBorder;

const AVATAR_COLORS = ['#4A90E2', '#D4AF37', '#4CAF50', '#9C27B0', '#E91E63'];
function getColorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash += key.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '??';
}

interface StoriesRowProps {
  stories: StoryItem[];
  onStoryViewed?: (userId: string) => void;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

export function StoriesRow({ stories, onStoryViewed }: StoriesRowProps) {
  const router = useRouter();
  const [visibleStory, setVisibleStory] = useState<StoryItem | null>(null);

  const openStory = (story: StoryItem) => {
    setVisibleStory(story);
    onStoryViewed?.(story.userId);
  };

  const goToProfile = (userId: string) => {
    setVisibleStory(null);
    router.push(`/user/${userId}`);
  };

  if (stories.length === 0) return null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroll}
      >
        {stories.map((story) => {
          const watched = story.watched ?? false;
          const ringColor = watched ? RING_WATCHED : RING_UNWATCHED;
          const initials = getInitials(story.username);
          const avatarColor = getColorForKey(story.userId);

          return (
            <View key={story.userId} style={styles.storyWrapper}>
              <TouchableOpacity
                style={styles.story}
                onPress={() => openStory(story)}
                activeOpacity={0.8}
              >
                <View style={[styles.ring, { borderColor: ringColor }]}>
                  {story.avatar && isValidImageUri(story.avatar) ? (
                    <Image
                      source={{ uri: story.avatar }}
                      style={styles.avatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatar,
                        styles.avatarInitials,
                        { backgroundColor: avatarColor },
                      ]}
                    >
                      <Text style={styles.initialsText}>{initials}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
                  {story.username}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* Full-screen story viewer — shows the catch photo */}
      <Modal
        visible={!!visibleStory}
        transparent
        animationType="fade"
        onRequestClose={() => setVisibleStory(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setVisibleStory(null)}
        >
          <View style={styles.modalContent}>
            {visibleStory && (
              <>
                {isValidImageUri(visibleStory.catchPhotoUrl) ? (
                  <Image
                    source={{ uri: visibleStory.catchPhotoUrl }}
                    style={styles.storyPhoto}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.storyPhoto, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' }]}>
                    <Ionicons name="image-outline" size={48} color="#555" />
                  </View>
                )}
                <View style={styles.storyOverlay}>
                  <View style={styles.storyHeader}>
                    <UserLink
                      userId={visibleStory.userId}
                      username={visibleStory.username}
                      onPressOverride={() => goToProfile(visibleStory.userId)}
                      variant="avatar-only"
                      avatarSize={40}
                    >
                      <View
                        style={[
                          styles.storyAvatar,
                          styles.storyAvatarInitials,
                          { backgroundColor: getColorForKey(visibleStory.userId) },
                        ]}
                      >
                        <Text style={styles.storyAvatarInitialsText}>
                          {getInitials(visibleStory.username)}
                        </Text>
                      </View>
                    </UserLink>
                    <View style={styles.storyMeta}>
                      <UserLink
                        userId={visibleStory.userId}
                        username={visibleStory.username}
                        onPressOverride={() => goToProfile(visibleStory.userId)}
                        variant="text-only"
                        textStyle={styles.storyUsername}
                      />
                      {(visibleStory.species || visibleStory.weight) ? (
                        <Text style={styles.storySpecs}>
                          {visibleStory.species} · {visibleStory.weight.toFixed(1)} lbs
                        </Text>
                      ) : (
                        <Text style={styles.storySpecs}>Story</Text>
                      )}
                    </View>
                    <Text style={styles.storyTime}>
                      {formatTimeAgo(visibleStory.postedAt)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setVisibleStory(null)}
                      hitSlop={12}
                    >
                      <Ionicons name="close" size={28} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginBottom: 0,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    paddingBottom: 8,
    gap: 14,
    alignItems: 'flex-start',
  },
  storyWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  story: {
    alignItems: 'center',
    width: AVATAR_SIZE + STORY_RING_WIDTH * 2 + 16,
  },
  ring: {
    width: AVATAR_SIZE + STORY_RING_WIDTH * 2,
    height: AVATAR_SIZE + STORY_RING_WIDTH * 2,
    borderRadius: (AVATAR_SIZE + STORY_RING_WIDTH * 2) / 2,
    borderWidth: STORY_RING_WIDTH,
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarInitials: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightText,
    width: AVATAR_SIZE + STORY_RING_WIDTH * 2 + 10,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
  },
  storyPhoto: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    alignSelf: 'center',
  },
  storyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyAvatarTouchable: {
    marginRight: 12,
  },
  storyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  storyAvatarInitials: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatarInitialsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  storyMeta: {
    flex: 1,
    minWidth: 0,
  },
  storyUsername: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  storySpecs: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  storyTime: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 8,
  },
});
