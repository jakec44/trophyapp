/**
 * Photo confirmation screen — passes image to Log.
 * No AI. User fills species/weight/length on Log screen.
 */

import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';
import Feather from '@expo/vector-icons/Feather';

const BRIGHT_BLUE = colors.brightBlue;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FishImageEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ originalUri?: string | string[]; isLiveCatch?: string }>();
  const raw = params.originalUri;
  const isLiveCatch = params.isLiveCatch === '1';
  let originalUri = (Array.isArray(raw) ? raw[0] : typeof raw === 'string' ? raw : '')?.trim() ?? '';
  try {
    if (originalUri && (originalUri.includes('%3A') || originalUri.includes('%2F'))) {
      originalUri = decodeURIComponent(originalUri);
    }
  } catch {}

  const handleContinue = () => {
    const result = {
      originalUri,
      editedUri: originalUri,
      enhancedUri: originalUri,
      isLiveCatch: isLiveCatch || undefined,
    };
    router.replace({
      pathname: '/(tabs)/log',
      params: { fishImageResult: JSON.stringify(result) },
    });
  };

  if (!originalUri) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <SnaggedWordmark />
        </View>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>No image provided</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerSnagged}>Snagged</Text>
        <Text style={styles.headerTitle}>Your Catch</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.content}>
        <Text style={styles.aiComingSoon}>AI identifier coming soon</Text>
        <View style={styles.imageWrap}>
          {isValidImageUri(originalUri) ? (
            <Image
              source={{ uri: originalUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.previewImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.lightBorder }]}>
              <Feather name="image" size={48} color={colors.lightSubtext} />
            </View>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.continueBtn,
            Platform.OS === 'web' && { cursor: 'pointer' as const },
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleContinue}
        >
          <Text style={styles.continueBtnText}>Continue to Log</Text>
          <Feather name="arrow-right" size={20} color="#FFF" />
        </Pressable>
        <Text style={styles.aiTrackerComingSoon}>AI tracker coming soon</Text>
      </View>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  headerBar: { padding: 16, paddingBottom: 8 },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  headerBtn: { width: 40, height: 40 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 480,
    backgroundColor: colors.lightBorder,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: BRIGHT_BLUE,
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  aiComingSoon: {
    fontSize: 13,
    color: colors.lightSubtext,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  aiTrackerComingSoon: {
    fontSize: 13,
    color: colors.lightSubtext,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.lightSubtext,
    textAlign: 'center',
    marginTop: 60,
  },
  backBtn: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRIGHT_BLUE,
  },
});
