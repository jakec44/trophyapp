/**
 * Profile posts grid — 3 posts per row, compact thumbnails.
 * Tap opens full post in modal.
 * Video posts show a snapshot from the start of the video.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/utils/colors';
import type { FeedPost } from '@/utils/feedMockData';
import { FeedPostCard } from '@/src/components/home/FeedPostCard';
import { isValidImageUri } from '@/src/lib/imageUri';

function isVideoUrl(url: string | number): boolean {
  if (typeof url !== 'string') return false;
  try {
    const path = url.split('?')[0].toLowerCase();
    return /\.(mp4|webm|mov)(\?|$)/i.test(path) || path.includes('/video/');
  } catch {
    return false;
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLS = 3;
const GAP = 6;
const CONTENT_PADDING = 24; // profile content has paddingHorizontal 12 each side
const ITEM_SIZE = (SCREEN_WIDTH - CONTENT_PADDING - (COLS - 1) * GAP) / COLS;

interface Props {
  posts: FeedPost[];
  onHype?: (postId: string, hyped: boolean) => void;
  onAddComment?: (postId: string, text: string) => void;
}

function ProfilePostTile({ post, onPress }: { post: FeedPost; onPress: () => void }) {
  const photoUrl = typeof post.photoUrl === 'string' ? post.photoUrl : null;
  const isVideo = photoUrl != null && isVideoUrl(photoUrl);
  const [videoThumbnailUri, setVideoThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    if (!isVideo || !photoUrl) return;
    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(photoUrl, { time: 0 })
      .then(({ uri }) => {
        if (!cancelled) setVideoThumbnailUri(uri);
      })
      .catch(() => {
        if (!cancelled) setVideoThumbnailUri(null);
      });
    return () => { cancelled = true; };
  }, [isVideo, photoUrl]);

  const imageUri = isVideo ? (videoThumbnailUri ?? undefined) : (photoUrl && isValidImageUri(photoUrl) ? photoUrl : undefined);
  const showPlaceholder = !imageUri;

  return (
    <TouchableOpacity
      style={styles.cell}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.placeholder]}>
          {isVideo ? (
            <Ionicons name="videocam-outline" size={28} color={colors.lightSubtext} />
          ) : (
            <Ionicons name="fish-outline" size={28} color={colors.lightSubtext} />
          )}
        </View>
      )}
      {post.species && (
        <View style={styles.overlay}>
          <Text style={styles.species} numberOfLines={1}>{post.species}</Text>
          {post.weight > 0 && (
            <Text style={styles.weight}>{post.weight} lb</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function ProfilePostsGrid({ posts, onHype, onAddComment }: Props) {
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);

  return (
    <>
      <View style={styles.grid}>
        {posts.map((post) => (
          <ProfilePostTile
            key={post.id}
            post={post}
            onPress={() => setSelectedPost(post)}
          />
        ))}
      </View>

      <Modal
        visible={!!selectedPost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPost(null)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setSelectedPost(null)} hitSlop={12}>
              <Feather name="x" size={24} color={colors.lightText} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedPost && (
              <FeedPostCard
                post={selectedPost}
                onHype={onHype ?? (() => {})}
                onAddComment={onAddComment ?? (() => {})}
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    width: ITEM_SIZE,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.lightBorder,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  species: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  weight: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
  },
  modal: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingBottom: 40,
  },
});
