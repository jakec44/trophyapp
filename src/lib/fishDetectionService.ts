/**
 * AI Fish Detection - Species, estimated weight, and length from photo
 * Uses fal.ai LLaVA vision model.
 * When EXPO_PUBLIC_FAL_KEY is missing, throws — no mock in production.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export interface FishDetectionResult {
  species: string;
  weightEstimate: number;
  lengthEstimate: number;
  confidence?: number;
}

const FAL_LLAVA_URL = 'https://queue.fal.run/fal-ai/llava-next';

/**
 * Read image as base64 data URI for fal.ai
 */
async function imageToDataUri(uri: string): Promise<string> {
  const trimmed = (uri || '').trim();
  if (!trimmed) throw new Error('Invalid image URI');

  if (trimmed.startsWith('data:')) return trimmed;

  if (Platform.OS === 'web') {
    throw new Error('Fish detection requires the native app (camera/photo picker not supported on web)');
  }

  let fileUri = trimmed;
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('File system not available');

  if (trimmed.startsWith('ph://') || trimmed.startsWith('asset-library://') || trimmed.startsWith('content://')) {
    const cachePath = `${cacheDir}fish_detect_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: trimmed, to: cachePath });
    fileUri = cachePath;
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: 'base64',
  });
  return `data:image/jpeg;base64,${base64}`;
}

const FAL_KEY_REQUIRED_MSG = 'AI species detection is not available.';

/**
 * Detect fish species, weight, and length from image using AI vision.
 * Throws when EXPO_PUBLIC_FAL_KEY is not set — feature is disabled, no mock.
 */
export async function detectFishFromImage(imageUri: string): Promise<FishDetectionResult> {
  const apiKey = process.env.EXPO_PUBLIC_FAL_KEY?.trim();

  if (!apiKey) {
    throw new Error(FAL_KEY_REQUIRED_MSG);
  }

  try {
    const dataUri = await imageToDataUri(imageUri);

    const res = await fetch(FAL_LLAVA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        image_url: dataUri,
        prompt: `This is a photo of a fish that was caught. Identify the fish species (use common name like "Largemouth Bass" or "Redfish"). Estimate the weight in pounds and length in inches based on the image. Respond with ONLY a valid JSON object, no other text: {"species": "Species Name", "weightEstimate": number, "lengthEstimate": number}`,
        max_tokens: 150,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `fal.ai returned ${res.status}`);
    }

    const data = await res.json();
    const output = (data.output || '').trim();

    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }
    const parsed = JSON.parse(jsonMatch[0]) as {
      species?: string;
      weightEstimate?: number;
      lengthEstimate?: number;
    };
    return {
      species: parsed.species || 'Unknown',
      weightEstimate: typeof parsed.weightEstimate === 'number' ? parsed.weightEstimate : 0,
      lengthEstimate: typeof parsed.lengthEstimate === 'number' ? parsed.lengthEstimate : 0,
      confidence: 85,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`AI species detection failed: ${msg}`);
  }
