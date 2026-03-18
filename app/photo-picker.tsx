import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/utils/colors';
import { setPickedImageBase64 } from '@/src/lib/pickedImageStore';

const GOLD = colors.gold;

export default function PhotoPickerScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'permission' | 'loading' | 'ready'>('permission');
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');

  const requestPermissionAndOpen = async () => {
    // On web/desktop, skip permission flow—it can hang on Windows.
    // Use file picker instead (no permission required).
    if (Platform.OS === 'web') {
      pickFromFiles();
      return;
    }
    setStep('loading');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setPermissionStatus(status === 'granted' ? 'granted' : 'denied');

    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Access Required',
        'Snagged needs access to your photo library to upload images of your catches. Please enable it in Settings.',
        [
          { text: 'Go Back', onPress: () => router.back() },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      setStep('permission');
      return;
    }

    try {
      // Wait for view hierarchy to be ready (fixes "view not in window hierarchy" on iOS/Expo Go)
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          setTimeout(resolve, 300);
        });
      });

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
        selectionLimit: 1,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        router.back();
        return;
      }

      const asset = result.assets[0];
      if (asset.base64) {
        setPickedImageBase64(asset.uri, asset.base64);
      }
      router.replace({
        pathname: '/(tabs)/log',
        params: { originalUri: asset.uri },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not open photo library';
      Alert.alert(
        'Photo Library Error',
        `${msg}\n\nTry: Settings > Expo Go > Photos > All Photos. Or turn off "Optimize iPhone Storage" in Settings > Photos.`,
        [
          { text: 'Go Back', onPress: () => router.back() },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    } finally {
      setStep('permission');
    }
  };

  const pickFromFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (file?.uri) {
        router.replace({
          pathname: '/(tabs)/log',
          params: { originalUri: file.uri },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not browse files';
      Alert.alert('Error', msg);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <SnaggedWordmark />
      </View>

      <View style={styles.content}>
        {step === 'permission' && (
          <>
            <View style={styles.iconWrap}>
              <Feather name="image" size={64} color={GOLD} />
            </View>
            <Text style={styles.heading}>Access Photo Library</Text>
            <Text style={styles.aiComingSoon}>AI identifier coming soon</Text>
            <Text style={styles.desc}>
              {Platform.OS === 'web'
                ? 'Choose an image from your computer. For Apple Photos on your iPhone, use the Snagged app on your phone.'
                : "Snagged needs permission to access your iPhone's Apple Photos so you can upload images of your catches."}
            </Text>
            <TouchableOpacity
              style={styles.allowButton}
              onPress={requestPermissionAndOpen}
            >
              <Text style={styles.allowButtonText}>Choose from Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={pickFromFiles}
            >
              <Text style={styles.browseButtonText}>Browse Files</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'loading' && (
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>
              {permissionStatus === 'undetermined'
                ? 'Requesting access...'
                : 'Opening photo library...'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 8,
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.lightText,
    textAlign: 'center',
    marginBottom: 8,
  },
  aiComingSoon: {
    fontSize: 13,
    color: colors.lightSubtext,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 12,
  },
  desc: {
    fontSize: 16,
    color: colors.lightSubtext,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  allowButton: {
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  allowButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  browseButton: {
    backgroundColor: colors.lightCardBlue,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.accentBlue,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.lightSubtext,
  },
  loadingWrap: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.lightSubtext,
  },
});
