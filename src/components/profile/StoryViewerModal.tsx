/**
 * Full-screen story viewer: progress bar, media (image), caption, like, tap zones.
 * Media resolution rule:
 * - If media_path exists and contains '/', use it (resolved via storage).
 * - Else if media_url starts with http, use it.
 * - Else render placeholder (do not attempt to load).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Modal,
  Dimensions,
  TouchableOpacity,
  Animated,
  PanResponder,
  StyleSheet,
  Platform,
  Text,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getStoryLikeCount, getStoryLikedByMe, toggleStoryLike } from '@/src/lib/supabase';
import { isValidImageUri } from '@/src/lib/imageUri';
import { resolveMediaUrl } from '@/src/lib/mediaUrl';
import { devLog } from '@/src/lib/env';

const STORY_DURATION_MS = 5000;

/** Guard: reject strings that look like encoded JSON or error messages (never use as image URL) */
function isGarbageUrl(s: string): boolean {
  return s.includes('%22') || s.includes('{') || s.includes('error');
}

export interface StoryViewerItem {
  id: string;
  media_path?: string | null;
  media_url?: string | null;
  caption?: string | null;
}

interface StoryViewerModalProps {
  visible: boolean;
  stories: StoryViewerItem[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** Called each time a story becomes the active slide (to mark it viewed). */
  onStoryViewed?: (storyId: string) => void;
  /** When true, shows a delete button for the current story. */
  isOwnProfile?: boolean;
  /** Called when the user confirms deletion of the current story. */
  onDeleteStory?: (storyId: string) => Promise<void>;
}

export function StoryViewerModal({
  visible,
  stories,
  currentIndex,
  onPrev,
  onNext,
  onClose,
  onStoryViewed,
  isOwnProfile = false,
  onDeleteStory,
}: StoryViewerModalProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const current = stories[currentIndex];
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);

  const resolveUrl = useCallback((item: StoryViewerItem) => {
    setLoading(true);
    setLoadError(false);

    // Rule: media_path only (preferred). media_url only if http(s) and not garbage.
    const path = item.media_path?.trim();
    const urlRaw = item.media_url?.trim();

    let url: string | null = null;
    if (path && path.includes('/')) {
      url = resolveMediaUrl('media', path);
    } else if (urlRaw && (urlRaw.startsWith('http://') || urlRaw.startsWith('https://')) && !isGarbageUrl(urlRaw)) {
      url = urlRaw;
    }

    if (url && !isGarbageUrl(url)) {
      setDisplayUrl(url);
    } else {
      devLog('[MEDIA] INVALID STORY PATH', { storyId: item.id, media_path: path, media_url: urlRaw });
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!visible || !current) return;
    setDisplayUrl(null);
    setLoadError(false);
    setLoading(true);
    resolveUrl(current);
    // Mark story as viewed as soon as it becomes the active slide
    if (current.id) onStoryViewed?.(current.id);
  }, [visible, current?.id, current?.media_path, current?.media_url, resolveUrl]);

  useEffect(() => {
    if (!visible || stories.length === 0) return;
    progressAnim.setValue(0);
    translateY.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION_MS,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onNext();
    });
    return () => progressAnim.stopAnimation();
  }, [visible, currentIndex, stories.length]);

  useEffect(() => {
    if (!current?.id) return;
    getStoryLikeCount(current.id).then(setLikeCount);
    getStoryLikedByMe(current.id).then(setLiked);
  }, [current?.id]);

  const handleRetry = useCallback(() => {
    if (!current) return;
    setLoadError(false);
    setLoading(true);
    resolveUrl(current);
  }, [current, resolveUrl]);

  const handleLike = useCallback(async () => {
    if (!current?.id) return;
    const { liked: newLiked, count } = await toggleStoryLike(current.id);
    setLiked(newLiked);
    setLikeCount(count);
  }, [current?.id]);

  const handleDelete = useCallback(() => {
    if (!current?.id || !onDeleteStory) return;
    Alert.alert('Delete Story', 'Remove this story permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await onDeleteStory(current.id);
          // Move to next story or close if this was the last one
          if (stories.length <= 1) {
            onClose();
          } else {
            onNext();
          }
        },
      },
    ]);
  }, [current?.id, onDeleteStory, stories.length, onClose, onNext]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 10,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) translateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 80 || vy > 0.5) {
          Animated.timing(translateY, {
            toValue: 400,
            duration: 200,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  if (!current) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const { width: SW, height: SH } = Dimensions.get('window');
  const tapZoneWidth = SW * 0.35;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.95)' }]}>
        <View style={[styles.progressTrack, { width: SW - 32 }]}>
          {stories.map((_, i) => (
            <View key={i} style={styles.progressSegment}>
              {i < currentIndex ? (
                <View style={[styles.progressFill, { width: '100%' }]} />
              ) : i === currentIndex ? (
                <Animated.View
                  style={[styles.progressFill, { width: progressWidth }]}
                />
              ) : (
                <View style={[styles.progressFill, { width: '0%' }]} />
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={16}>
          <Ionicons name="close" size={32} color="#FFF" />
        </TouchableOpacity>

        {isOwnProfile && onDeleteStory && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} hitSlop={16}>
            <Ionicons name="trash-outline" size={26} color="rgba(255,80,80,0.9)" />
          </TouchableOpacity>
        )}

        <Animated.View
          style={[styles.content, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.tapRow}>
            <TouchableOpacity
              style={[styles.tapZone, { width: tapZoneWidth }]}
              onPress={onPrev}
              activeOpacity={1}
            />
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[styles.tapZone, { width: tapZoneWidth }]}
              onPress={onNext}
              activeOpacity={1}
            />
          </View>

          {loading && !displayUrl && !loadError && (
            <View style={[styles.mediaPlaceholder, { width: SW, height: SH }]}>
              <ActivityIndicator size="large" color="#FFF" />
            </View>
          )}

          {loadError && (
            <View style={[styles.mediaPlaceholder, { width: SW, height: SH }]}>
              <Text style={styles.errorText}>Story failed to load</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {isValidImageUri(displayUrl) && displayUrl && !loadError && (
            <Image
              source={{ uri: displayUrl }}
              style={[styles.image, { width: SW, height: SH }]}
              resizeMode="cover"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => {
                setLoading(false);
                setLoadError(false);
              }}
              onError={(e) => {
                console.error('[STORY_VIEW] image load error', {
                  storyId: current.id,
                  uri: displayUrl,
                  error: e.nativeEvent,
                });
                setLoading(false);
                setLoadError(true);
              }}
            />
          )}

          {current.caption?.trim() ? (
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.captionGradient}
            >
              <Text style={styles.captionText}>{current.caption.trim()}</Text>
            </LinearGradient>
          ) : null}

          <View style={styles.likeRow}>
            <TouchableOpacity onPress={handleLike} style={styles.likeBtn} hitSlop={12}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={28}
                color={liked ? '#E91E63' : '#FFF'}
              />
            </TouchableOpacity>
            {likeCount > 0 && (
              <Text style={styles.likeCount}>{likeCount}</Text>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  progressTrack: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 44,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 4,
    zIndex: 11,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 2,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
  },
  deleteBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    zIndex: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  tapRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    zIndex: 5,
  },
  tapZone: {
    flex: 0,
    minHeight: 200,
  },
  image: {
    alignSelf: 'center',
  },
  mediaPlaceholder: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
    marginBottom: 12,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: '600',
  },
  captionGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingVertical: 32,
    paddingBottom: 48,
  },
  captionText: {
    color: '#FFF',
    fontSize: 15,
  },
  likeRow: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeBtn: {},
  likeCount: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
