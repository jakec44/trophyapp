/**
 * Log Catch pipeline: insert row (pending) → upload to media bucket → update (complete).
 * Bucket: media. Path: {userId}/catches/{catchId}.jpg
 */

import { supabase, getPublicUrl, updateCatch, uploadImageAsJpegToStorage } from '@/src/lib/supabase';
import { mediaPath } from './mediaPaths';

const BUCKET = 'media';

export interface CreateCatchInput {
  user_id: string;
  species: string;
  weight_lb: number;
  length_in?: number;
  photo_url?: string;
  photo_path?: string;
  notes?: string;
  location?: string;
  taken_at?: string;
  upload_status?: 'pending_upload' | 'complete' | 'failed';
}

export interface CreateCatchResult {
  id: string;
  user_id: string;
  species: string;
  weight_lb: number;
  length_in?: number;
  photo_url?: string;
  notes?: string;
  location?: string;
  taken_at?: string;
}

export interface LogCatchInput {
  user_id: string;
  species: string;
  weight_lb: number;
  length_in?: number;
  notes?: string;
  location?: string;
  taken_at?: string;
  photoUri?: string;
}

export interface LogCatchResult {
  id: string;
  photo_url: string | null;
  photo_path: string | null;
  status: 'pending_upload' | 'complete' | 'failed';
}

/**
 * Full log-catch pipeline:
 * a) Insert row (status=pending_upload)
 * b) Upload photo to media/{userId}/catches/{catchId}.jpg
 * c) Update row (photo_path, photo_url, status=complete)
 * d) On upload failure: update status=failed, throw for retry
 */
export async function logCatch(input: LogCatchInput): Promise<LogCatchResult> {
  const { user_id, species, weight_lb, length_in, notes, location, taken_at, photoUri } = input;

  const payload: Record<string, unknown> = {
    user_id,
    species,
    weight_lb: Math.max(0.1, weight_lb),
    notes: notes ?? null,
    location: location ?? null,
    photo_url: null,
    taken_at: taken_at ?? new Date().toISOString(),
    upload_status: photoUri ? 'pending_upload' : 'complete',
  };
  if (typeof length_in === 'number' && length_in > 0) payload.length_in = length_in;

  const { data: created, error: insertErr } = await supabase
    .from('catches')
    .insert([payload])
    .select('id, user_id')
    .single();

  if (insertErr) throw insertErr;
  if (!created) throw new Error('Insert returned no row');

  const catchId = created.id as string;
  console.log('[LogCatch] session userId:', user_id, 'inserted catchId:', catchId, 'bucket:', BUCKET);

  if (!photoUri) {
    return { id: catchId, photo_url: null, photo_path: null, status: 'complete' };
  }

  const path = mediaPath.log(user_id, catchId);
  console.log('[MEDIA] catch upload start', { bucket: BUCKET, path });

  try {
    await uploadImageAsJpegToStorage(BUCKET, path, photoUri);
    const photoUrl = getPublicUrl(BUCKET, path);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await updateCatch(catchId, {
          photo_path: path,
          photo_url: photoUrl,
          upload_status: 'complete',
        });
        console.log('[MEDIA] catch upload complete', { bucket: BUCKET, path, url: photoUrl });
        return { id: catchId, photo_url: photoUrl, photo_path: path, status: 'complete' };
      } catch (updateErr) {
        if (attempt === 2) throw updateErr;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw new Error('Failed to save photo path after retries');
  } catch (e) {
    try {
      await updateCatch(catchId, { upload_status: 'failed' });
    } catch {}
    console.error('[MEDIA] catch upload failed', { bucket: BUCKET, path, error: e });
    throw e;
  }
}

/** Retry upload for a catch with status=failed */
export async function retryCatchPhotoUpload(
  catchId: string,
  userId: string,
  photoUri: string
): Promise<LogCatchResult> {
  const path = mediaPath.log(userId, catchId);
  console.log('[MEDIA] catch retry start', { bucket: BUCKET, path });
  await uploadImageAsJpegToStorage(BUCKET, path, photoUri);
  const photoUrl = getPublicUrl(BUCKET, path);
  await updateCatch(catchId, { photo_path: path, upload_status: 'complete' });
  console.log('[MEDIA] catch retry complete', { bucket: BUCKET, path, url: photoUrl });
  return { id: catchId, photo_url: photoUrl, photo_path: path, status: 'complete' };
}
