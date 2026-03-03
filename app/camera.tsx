import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/utils/colors';
import { setPickedImageBase64 } from '@/src/lib/pickedImageStore';

const GOLD = colors.gold;

export default function CameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleCapture = async () => {
    if (!cameraRef.current || !permission?.granted || capturing || !cameraReady) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: true,
      });
      if (photo?.uri) {
        if (photo.base64) {
          setPickedImageBase64(photo.uri, photo.base64);
        }
        router.replace({
          pathname: '/(tabs)/log',
          params: { originalUri: photo.uri, isLiveCatch: '1' },
        });
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Failed to take photo';
      Alert.alert('Error', msg);
    } finally {
      setCapturing(false);
    }
  };

  const handleOpenPhotos = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo access',
          'Allow access to your photos to choose a catch image.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
        selectionLimit: 1,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.base64) {
        setPickedImageBase64(asset.uri, asset.base64);
      }
      router.replace({
        pathname: '/(tabs)/log',
        params: { originalUri: asset.uri },
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not open photos');
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
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not browse files');
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.message}>Requesting camera access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <SnaggedWordmark />
        </View>
        <View style={styles.centered}>
          <Text style={styles.message}>
            Camera permission is required to take photos of your catches.
            {Platform.OS === 'web' && ' On a computer, use "Choose photo from files" below.'}
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.browseFilesButton}
            onPress={pickFromFiles}
          >
            <Feather name="folder" size={20} color={colors.accentBlue} />
            <Text style={styles.browseFilesButtonText}>Choose photo from files</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CameraView
        style={styles.camera}
        ref={cameraRef}
        onCameraReady={() => setCameraReady(true)}
      >
        <TouchableOpacity
          style={styles.cameraHeader}
          onPress={() => router.back()}
          activeOpacity={0.8}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.cameraHeaderSnagged}>Snagged</Text>
        </TouchableOpacity>
        <View style={styles.controls}>
          <View style={styles.controlsRow}>
            <View style={styles.controlsSpacer} />
            <TouchableOpacity
              style={[styles.captureButton, (capturing || !cameraReady) && styles.captureButtonDisabled]}
              onPress={handleCapture}
              disabled={capturing || !cameraReady}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photosButton}
              onPress={handleOpenPhotos}
              activeOpacity={0.8}
            >
              <Feather name="image" size={26} color="#FFFFFF" />
              <Text style={styles.photosButtonText}>Photos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraHeader: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  cameraHeaderSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  headerBar: {
    padding: 16,
    paddingBottom: 8,
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  controls: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 24,
  },
  controlsSpacer: {
    width: 80,
  },
  photosButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    minWidth: 80,
  },
  photosButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginBottom: 16,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  browseFilesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accentBlue,
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
  },
  browseFilesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accentBlue,
  },
});
