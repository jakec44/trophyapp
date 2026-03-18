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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';
import type { StoryItem } from '@/utils/feedMockData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
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
        statusBarTranslucent
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
                    style={[styles.storyPhoto, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.storyPhoto, styles.storyPhotoPlaceholder, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
                    <Ionicons name="image-outline" size={48} color="#555" />
                  </View>
                )}
                <View style={styles.storyOverlay} pointerEvents="box-none">
                  {/* Top center: profile pic + username */}
                  <View style={styles.storyTopCenter}>
                    <TouchableOpacity
                      onPress={() => goToProfile(visibleStory.userId)}
                      style={styles.storyTopCenterTouch}
                      activeOpacity={0.9}
                    >
                      {visibleStory.avatar && isValidImageUri(visibleStory.avatar) ? (
                        <Image
                          source={{ uri: visibleStory.avatar }}
                          style={styles.storyTopAvatar}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.storyTopAvatar,
                            styles.storyTopAvatarInitials,
                            { backgroundColor: getColorForKey(visibleStory.userId) },
                          ]}
                        >
                          <Text style={styles.storyTopInitials}>
                            {getInitials(visibleStory.username)}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.storyTopUsername} numberOfLines={1}>
                        {visibleStory.username}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {/* Close top-right */}
                  <TouchableOpacity
                    style={styles.storyCloseBtn}
                    onPress={() => setVisibleStory(null)}
                    hitSlop={12}
                  >
                    <Ionicons name="close" size={28} color="#FFF" />
                  </TouchableOpacity>
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
  },
  storyPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  storyPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
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
  storyTopCenter: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyTopCenterTouch: {
    alignItems: 'center',
    maxWidth: '70%',
  },
  storyTopAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 6,
  },
  storyTopAvatarInitials: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyTopInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  storyTopUsername: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  storyCloseBtn: {
    position: 'absolute',
    top: 56,
    right: 16,
  },
});
