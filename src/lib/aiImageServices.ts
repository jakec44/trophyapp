/**
 * AI Image Services - Enhance only (background removal removed)
 * Note: FileSystem not available on web - use mobile app for image editing.
 *
 * For development, wire to your backend or use env vars.
 * Enhance (pop/3D): fal.ai image-to-image
 */

import * as FileSystem from 'expo-file-system/legacy';

const FAL_IMAGE2IMAGE_URL =
  'https://queue.fal.run/fal-ai/playground-v25/image-to-image';

export interface EnhanceResult {
  imageUri: string;
  width: number;
  height: number;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  return `data:image/png;base64,${base64}`;
}

/**
 * Enhance the fish - makes it pop more (optional, not used by default).
 * Env: EXPO_PUBLIC_FAL_KEY
 */
export async function enhanceFish(imageUri: string): Promise<EnhanceResult> {
  const apiKey = process.env.EXPO_PUBLIC_FAL_KEY;
  if (!apiKey) {
    return { imageUri, width: 0, height: 0 };
  }

  const imageData = imageUri.startsWith('data:')
    ? imageUri
    : await uriToBase64(imageUri);

  const res = await fetch(FAL_IMAGE2IMAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        image_url: imageData,
        prompt:
          'enhance this fish photo, make it pop with vibrant colors, add subtle 3D depth and professional studio lighting, sharp scales, lifelike',
        strength: 0.3,
        num_inference_steps: 28,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Enhance failed: ${await res.text()}`);
  }

  const data = await res.json();
  const outputUri =
    data.data?.images?.[0]?.url ??
    data.images?.[0]?.url ??
    data.data?.image?.url ??
    data.image?.url;
  if (!outputUri) throw new Error('No output from enhance API');

  return {
    imageUri: outputUri,
    width: 0,
    height: 0,
  };
}
