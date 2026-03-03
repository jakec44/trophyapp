/**
 * PhotoPicker — Take photo / From Gallery buttons and preview.
 * Smaller preview so species/weight/length fit on same screen. Optional crop.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/utils/colors';
import { CatchImagePreview } from '@/src/components/log/CatchImagePreview';

const BRIGHT_BLUE = colors.brightBlue;

export interface PhotoPickerProps {
  photoUri: string | null;
  onTakePhoto: () => void;
  onPickFromGallery: () => void;
  onPhotoCropped?: (uri: string) => void;
}

export function PhotoPicker({
  photoUri,
  onTakePhoto,
  onPickFromGallery,
  onPhotoCropped,
}: PhotoPickerProps) {
  const [cropping, setCropping] = useState(false);

  const handleCrop = async () => {
    if (!photoUri || !onPhotoCropped) return;
    setCropping(true);
    try {
      const workUri = await (async () => {
        const t = (photoUri || '').trim();
        const needsCopy =
          t.startsWith('ph://') || t.startsWith('ph-upload://') ||
          t.startsWith('asset-library://') || t.startsWith('content://');
        const cacheDir = FileSystem.cacheDirectory;
        if (!needsCopy || !cacheDir) return photoUri;
        const cachePath = `${cacheDir}crop_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: photoUri, to: cachePath });
        return cachePath;
      })();
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(workUri, (w, h) => resolve({ width: w, height: h }), reject);
      });
      const inset = 0.1;
      const cropW = Math.floor(width * (1 - 2 * inset));
      const cropH = Math.floor(height * (1 - 2 * inset));
      const result = await ImageManipulator.manipulateAsync(
        workUri,
        [{ crop: { originX: width * inset, originY: height * inset, width: cropW, height: cropH } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      if (result.uri) onPhotoCropped(result.uri);
    } catch (e) {
      Alert.alert('Crop failed', e instanceof Error ? e.message : 'Could not crop image');
    } finally {
      setCropping(false);
    }
  };

  return (
    <View style={styles.section}>
      {photoUri ? (
        <View style={styles.photoWrap}>
          <TouchableOpacity onPress={onTakePhoto} activeOpacity={0.9}>
            <CatchImagePreview uri={photoUri} />
          </TouchableOpacity>
          {onPhotoCropped && (
            <TouchableOpacity
              style={styles.cropButton}
              onPress={handleCrop}
              disabled={cropping}
            >
              <Feather name="crop" size={18} color="#FFFFFF" />
              <Text style={styles.cropButtonText}>{cropping ? 'Cropping…' : 'Crop'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.placeholder}
          onPress={onTakePhoto}
          activeOpacity={0.8}
        >
          <Feather name="camera" size={48} color={BRIGHT_BLUE} />
          <Text style={styles.placeholderText}>Add your catch photo</Text>
        </TouchableOpacity>
      )}
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={onTakePhoto}
        >
          <Feather name="camera" size={20} color="#FFFFFF" />
          <Text style={styles.buttonTextPrimary}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onPickFromGallery}>
          <Feather name="image" size={20} color={BRIGHT_BLUE} />
          <Text style={styles.buttonTextSecondary}>From Gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 12,
  },
  photoWrap: {
    marginBottom: 10,
    position: 'relative',
  },
  cropButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cropButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: '100%',
    height: 140,
    backgroundColor: colors.lightCard,
    borderWidth: 2,
    borderColor: colors.lightBorder,
    borderRadius: 14,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginTop: 8,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: BRIGHT_BLUE,
  },
  buttonPrimary: {
    backgroundColor: BRIGHT_BLUE,
    borderColor: BRIGHT_BLUE,
  },
  buttonTextPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: BRIGHT_BLUE,
  },
});
