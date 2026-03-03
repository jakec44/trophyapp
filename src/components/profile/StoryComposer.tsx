/**
 * Story composer: full-size image preview with text overlay (Snapchat-style).
 * User types text over the image before posting.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';

const { width: SW, height: SH } = Dimensions.get('window');

interface StoryComposerProps {
  visible: boolean;
  imageUri: string;
  onPost: (uri: string, caption: string | null) => Promise<void>;
  onCancel: () => void;
}

export function StoryComposer({
  visible,
  imageUri,
  onPost,
  onCancel,
}: StoryComposerProps) {
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    setPosting(true);
    try {
      await onPost(imageUri, caption.trim() || null);
      setCaption('');
    } finally {
      setPosting(false);
    }
  };

  if (!visible || !imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="cover"
        />
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            scrollEventThrottle={16}
          >
            <View style={styles.textOverlay}>
              <TextInput
                style={styles.textInput}
                placeholder="Add text..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={200}
                editable={!posting}
              />
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                disabled={posting}
              >
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.postBtn, posting && styles.postBtnDisabled]}
                onPress={handlePost}
                disabled={posting}
              >
                <Text style={styles.postBtnText}>{posting ? 'Posting...' : 'Post'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SW,
    height: SH,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  textOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  textInput: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    padding: 8,
  },
  postBtn: {
    backgroundColor: colors.accentBlue,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  postBtnDisabled: {
    opacity: 0.6,
  },
  postBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
