import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * ImageOptimizer - Handles image optimization pipeline for Snagged
 *
 * Pipeline:
 * 1. Validate file size (max 10MB)
 * 2. Resize to 1600px max width/height (maintain aspect ratio)
 * 3. Compress to WebP at 80% quality
 * 4. Generate 300px thumbnail
 * 5. Return both optimized and thumbnail URIs
 */

export interface OptimizationResult {
  optimized: {
    uri: string;
    width: number;
    height: number;
    size: number; // bytes
  };
  thumbnail: {
    uri: string;
    width: number;
    height: number;
    size: number; // bytes
  };
  originalSize: number; // bytes
  optimizedSize: number; // bytes (main + thumb combined)
  compressionRatio: number; // percentage saved
}

export interface ImageDimensions {
  width: number;
  height: number;
}

class ImageOptimizer {
  private readonly MAX_FILE_SIZE = 10_000_000; // 10 MB
  private readonly MAX_DISPLAY_DIMENSION = 1600; // pixels
  private readonly THUMBNAIL_DIMENSION = 300; // pixels
  private readonly COMPRESSION_QUALITY = 0.8; // 80%

  /**
   * Get image dimensions without loading the full file
   */
  async getImageDimensions(uri: string): Promise<ImageDimensions> {
    if (Platform.OS === 'web') {
      throw new Error('Image optimization requires the native app (not available on web)');
    }
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      throw new Error('Image file not found');
    }

    // For local files, we need to use ImageManipulator to get dimensions
    const manipulatedImage = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 1,
    });

    return {
      width: manipulatedImage.width,
      height: manipulatedImage.height,
    };
  }

  /**
   * Calculate new dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxDimension: number
  ): ImageDimensions {
    const aspectRatio = originalWidth / originalHeight;

    if (originalWidth > originalHeight) {
      // Width is larger
      const newWidth = Math.min(originalWidth, maxDimension);
      return {
        width: newWidth,
        height: Math.round(newWidth / aspectRatio),
      };
    } else {
      // Height is larger or equal
      const newHeight = Math.min(originalHeight, maxDimension);
      return {
        width: Math.round(newHeight * aspectRatio),
        height: newHeight,
      };
    }
  }

  /**
   * Get file size in bytes
   */
  private async getFileSize(uri: string): Promise<number> {
    if (Platform.OS === 'web') {
      throw new Error('Image optimization requires the native app (not available on web)');
    }
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('File not found');
    }
    return fileInfo.size || 0;
  }

  /**
   * Main optimization function
   */
  async optimize(uri: string): Promise<OptimizationResult> {
    // Step 1: Validate file size
    const originalSize = await this.getFileSize(uri);
    if (originalSize > this.MAX_FILE_SIZE) {
      throw new Error(
        `Image exceeds 10MB limit (current: ${(originalSize / 1_000_000).toFixed(2)}MB)`
      );
    }

    // Step 2: Get original dimensions
    const originalDimensions = await this.getImageDimensions(uri);

    // Step 3: Resize to 1600px (if needed)
    const displayDimensions = this.calculateDimensions(
      originalDimensions.width,
      originalDimensions.height,
      this.MAX_DISPLAY_DIMENSION
    );

    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: displayDimensions.width,
            height: displayDimensions.height,
          },
        },
      ],
      {
        compress: this.COMPRESSION_QUALITY,
        format: ImageManipulator.SaveFormat.WEBP,
      }
    );

    // Step 4: Generate thumbnail (300px)
    const thumbnailDimensions = this.calculateDimensions(
      originalDimensions.width,
      originalDimensions.height,
      this.THUMBNAIL_DIMENSION
    );

    const thumbnail = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: thumbnailDimensions.width,
            height: thumbnailDimensions.height,
          },
        },
      ],
      {
        compress: this.COMPRESSION_QUALITY,
        format: ImageManipulator.SaveFormat.WEBP,
      }
    );

    // Step 5: Get optimized file sizes
    const optimizedSize = await this.getFileSize(resized.uri);
    const thumbnailSize = await this.getFileSize(thumbnail.uri);
    const totalOptimizedSize = optimizedSize + thumbnailSize;

    return {
      optimized: {
        uri: resized.uri,
        width: displayDimensions.width,
        height: displayDimensions.height,
        size: optimizedSize,
      },
      thumbnail: {
        uri: thumbnail.uri,
        width: thumbnailDimensions.width,
        height: thumbnailDimensions.height,
        size: thumbnailSize,
      },
      originalSize,
      optimizedSize: totalOptimizedSize,
      compressionRatio: Math.round(
        ((originalSize - totalOptimizedSize) / originalSize) * 100
      ),
    };
  }

  /**
   * Convert local file to Blob for upload to Supabase
   */
  async fileToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob;
  }

  /**
   * Generate unique filename for storage
   */
  generateFilename(userId: string, type: 'photo' | 'thumb' = 'photo'): string {
    const timestamp = Date.now();
    const suffix = type === 'thumb' ? '_thumb' : '';
    return `${userId}/${timestamp}${suffix}.webp`;
  }
}

export default new ImageOptimizer();
