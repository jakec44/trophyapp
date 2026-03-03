/**
 * CatchImagePreview — 9:16 vertical framing, full image display, no crop
 * Portrait: contain inside frame. Landscape: white letterboxing top/bottom.
 */

import { useState, useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isValidImageUri } from '@/src/lib/imageUri';

const ASPECT_RATIO = 9 / 16;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_WIDTH = SCREEN_WIDTH - 32;
const MAX_PREVIEW_HEIGHT = 160;
const CONTAINER_HEIGHT = Math.min(MAX_PREVIEW_HEIGHT, CONTAINER_WIDTH / ASPECT_RATIO);
const BORDER_RADIUS = 12;

export interface CatchImagePreviewProps {
  uri: string;
  width?: number;
  height?: number;
}

export function CatchImagePreview({ uri, width: imgW, height: imgH }: CatchImagePreviewProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(
    imgW != null && imgH != null ? { width: imgW, height: imgH } : null
  );

  useEffect(() => {
    if (imgW != null && imgH != null) {
      setDimensions({ width: imgW, height: imgH });
      return;
    }
    if (!uri?.trim()) {
      setDimensions(null);
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (!cancelled) setDimensions({ width: w, height: h });
      },
      () => {
        if (!cancelled) setDimensions({ width: 1, height: 1 });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri, imgW, imgH]);

  const isPortrait = dimensions
    ? dimensions.height >= dimensions.width
    : true;

  return (
    <View
      style={[
        styles.container,
        !isPortrait && styles.containerLetterbox,
      ]}
    >
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT,
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerLetterbox: {
    backgroundColor: '#000',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT,
    borderRadius: BORDER_RADIUS,
    ...Platform.select({
      ios: { overflow: 'hidden' as const },
      default: {},
    }),
  },
});
