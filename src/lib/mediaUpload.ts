import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadFileFromUri } from './supabase';

async function copyToCacheIfNeeded(uri: string): Promise<string> {
  const trimmed = (uri || '').trim();
  if (!trimmed) throw new Error('Invalid image URI');
  const needsCopy =
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('ph-upload://') ||
    trimmed.startsWith('asset-library://') ||
    trimmed.startsWith('content://');
  const cacheDir = FileSystem.cacheDirectory;
  if (!needsCopy || !cacheDir) return trimmed;
  const cachePath = `${cacheDir}upload_${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: trimmed, to: cachePath });
  return cachePath;
}

/**
 * Convert a local image to JPEG, upload to Supabase Storage, return the object key.
 */
export async function uploadJpeg(
  bucket: string,
  path: string,
  localUri: string,
  compress = 0.9
): Promise<string> {
  const workUri = await copyToCacheIfNeeded(localUri);
  const manipulated = await ImageManipulator.manipulateAsync(
    workUri,
    [],
    { compress, format: ImageManipulator.SaveFormat.JPEG }
  );
  const uploadUri = manipulated?.uri || workUri;
  console.log('[Storage] uploadJpeg', { bucket, path, localUri, manipulatedUri: uploadUri });
  await uploadFileFromUri(bucket, path, uploadUri, {
    upsert: true,
    contentType: 'image/jpeg',
  });
  return path;
}
