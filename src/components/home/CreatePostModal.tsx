/**
 * CreatePostModal — slide-up sheet for creating a social post.
 * Select up to 5 images or videos, write a caption with #hashtags, then post.
 */

import { useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import { useFeedContext } from '@/src/context/FeedContext';
import { useGamificationContext } from '@/src/context/GamificationContext';

const { width: SW } = Dimensions.get('window');
const TEAL = colors.teal;
const MAX_MEDIA = 5;
const THUMB = (SW - 32 - 12 * (3 - 1)) / 3; // 3-col grid thumb size

// ── Hashtag-aware text renderer ───────────────────────────────────────────────
function CaptionPreview({ text }: { text: string }) {
  const parts = text.split(/(#\w+)/g);
  return (
    <Text style={preview.text}>
      {parts.map((part, i) =>
        part.startsWith('#')
          ? <Text key={i} style={preview.tag}>{part}</Text>
          : part
      )}
    </Text>
  );
}
const preview = StyleSheet.create({
  text: { fontSize: 14, color: '#fff', lineHeight: 20 },
  tag:  { color: TEAL, fontWeight: '700' },
});

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
}

interface MediaItem {
  uri: string;
  type: 'image' | 'video';
}

export function CreatePostModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const { addFeedPost } = useFeedContext();
  const gamification = useGamificationContext();

  const [media, setMedia]     = useState<MediaItem[]>([]);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const reset = () => {
    setMedia([]);
    setCaption('');
    setPosting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Pick media ─────────────────────────────────────────────────────────────
  const pickMedia = useCallback(async () => {
    if (media.length >= MAX_MEDIA) {
      Alert.alert('Limit reached', `You can add up to ${MAX_MEDIA} photos or videos.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to add media.');
      return;
    }
    const remaining = MAX_MEDIA - media.length;
    // Pick one at a time so user can crop each image (allowsEditing not supported with multi-select).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      allowsEditing: remaining === 1,
      aspect: remaining === 1 ? [1, 1] : undefined,
      quality: 0.85,
      orderedSelection: true,
    });
    if (!result.canceled) {
      const picked: MediaItem[] = result.assets.map((a) => ({
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
      }));
      setMedia((prev) => [...prev, ...picked].slice(0, MAX_MEDIA));
    }
  }, [media.length]);

  const removeMedia = (idx: number) =>
    setMedia((prev) => prev.filter((_, i) => i !== idx));

  // ── Post ───────────────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (media.length === 0 && !caption.trim()) {
      Alert.alert('Nothing to post', 'Add a photo or write a caption.');
      return;
    }
    setPosting(true);
    try {
      await addFeedPost({
        userId:    user?.id ?? 'anon',
        username:  user?.displayName ?? user?.username ?? 'Angler',
        avatar:    user?.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id ?? 'anon'}`,
        postedAt:  new Date().toISOString(),
        photoUrl:  media[0]?.uri ?? '',
        firstMediaType: media[0]?.type ?? 'image',
        mediaItems: media.map((m) => ({ uri: m.uri, type: m.type })),
        caption:   caption.trim(),
        species:   '',
        weight:    0,
        location:  '',
        authorLevel: gamification?.levelInfo?.level,
        authorAnglerRating: (user as { angler_rating?: number })?.angler_rating,
      });
      reset();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not post. Please try again.');
      setPosting(false);
    }
  };

  const canPost = (media.length > 0 || caption.trim().length > 0) && !posting;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[sheet.root, { backgroundColor: '#0d1624' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <View style={[sheet.header, { paddingTop: insets.top + 4 }]}>
          <TouchableOpacity onPress={handleClose} style={sheet.headerBtn}>
            <Text style={sheet.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <Text style={sheet.headerTitle}>New Post</Text>
          <TouchableOpacity
            onPress={handlePost}
            style={[sheet.postBtn, !canPost && sheet.postBtnDisabled]}
            disabled={!canPost}
          >
            {posting
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={sheet.postBtnTxt}>Post</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          style={sheet.scroll}
          contentContainerStyle={[sheet.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Media grid ── */}
          <View style={sheet.mediaSection}>
            <View style={sheet.mediaGrid}>
              {media.map((item, idx) => (
                <View key={idx} style={sheet.thumb}>
                  {item.type === 'video' ? (
                    <View style={sheet.videoThumb}>
                      <Ionicons name="videocam" size={28} color="rgba(255,255,255,0.7)" />
                      <Text style={sheet.videoLabel}>Video</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: item.uri }} style={sheet.thumbImg} resizeMode="cover" />
                  )}
                  {/* Badge showing order */}
                  <View style={sheet.orderBadge}>
                    <Text style={sheet.orderTxt}>{idx + 1}</Text>
                  </View>
                  {/* Remove button */}
                  <TouchableOpacity
                    style={sheet.removeBtn}
                    onPress={() => removeMedia(idx)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add media tile */}
              {media.length < MAX_MEDIA && (
                <TouchableOpacity style={sheet.addTile} onPress={pickMedia} activeOpacity={0.75}>
                  <Ionicons name="add" size={32} color={TEAL} />
                  <Text style={sheet.addTileTxt}>
                    {media.length === 0 ? 'Add photo\nor video' : `Add more\n(${MAX_MEDIA - media.length} left)`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {media.length > 0 && (
              <Text style={sheet.mediaMeta}>
                {media.length}/{MAX_MEDIA} · tap a photo to remove
              </Text>
            )}
          </View>

          {/* ── Divider ── */}
          <View style={sheet.divider} />

          {/* ── Caption input ── */}
          <View style={sheet.captionSection}>
            <View style={sheet.captionRow}>
              <Feather name="edit-3" size={16} color="rgba(255,255,255,0.35)" style={{ marginTop: 3 }} />
              <TextInput
                ref={inputRef}
                style={sheet.captionInput}
                placeholder="Write a caption… use #hashtags"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={500}
                returnKeyType="default"
                textAlignVertical="top"
              />
            </View>
            <Text style={sheet.charCount}>{caption.length}/500</Text>
          </View>

          {/* ── Live preview of hashtags ── */}
          {caption.includes('#') && (
            <View style={sheet.previewBox}>
              <Text style={sheet.previewLabel}>Preview</Text>
              <CaptionPreview text={caption} />
            </View>
          )}

          {/* ── Tip ── */}
          <View style={sheet.tipRow}>
            <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.25)" />
            <Text style={sheet.tipTxt}>
              Use #hashtags to help others find your post. Up to {MAX_MEDIA} photos/videos.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const sheet = StyleSheet.create({
  root: { flex: 1 },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn: { minWidth: 60 },
  cancelTxt: { fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  postBtn: {
    backgroundColor: TEAL,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnTxt: { fontSize: 14, fontWeight: '800', color: '#000' },

  // scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20 },

  // media
  mediaSection: { paddingHorizontal: 16, marginBottom: 16 },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a2535',
    position: 'relative',
  },
  thumbImg: { width: '100%', height: '100%' },
  videoThumb: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f1e2e',
    gap: 4,
  },
  videoLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  orderBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  addTile: {
    width: THUMB,
    height: THUMB,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: TEAL + '50',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TEAL + '08',
  },
  addTileTxt: {
    fontSize: 11,
    color: TEAL,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },
  mediaMeta: {
    marginTop: 8,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 16,
    marginBottom: 16,
  },

  // caption
  captionSection: { paddingHorizontal: 16, marginBottom: 12 },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
  },
  captionInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    minHeight: 90,
    lineHeight: 22,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 6,
  },

  // preview
  previewBox: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 12,
    backgroundColor: 'rgba(0,229,200,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TEAL + '30',
    gap: 6,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEAL,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // tip
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  tipTxt: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.22)',
    lineHeight: 16,
  },
});
