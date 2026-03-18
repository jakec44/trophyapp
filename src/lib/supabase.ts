import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { createClient } from '@supabase/supabase-js';
import { mediaPath } from './mediaPaths';
import { devLog } from './env';

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================
// Set these in your .env.local file or environment variables:
// EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
// EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Missing Supabase credentials. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.'
  );
}

// Use placeholders when missing so createClient doesn't throw on app load.
// Auth/storage calls will fail until real credentials are set.
const URL = SUPABASE_URL || 'https://placeholder.supabase.co';
const KEY = SUPABASE_ANON_KEY || 'placeholder-anon-key';

/** True when real Supabase credentials are set (dev: use npm start so .env.local is loaded). */
export const isSupabaseConfigured =
  !!SUPABASE_URL && !!SUPABASE_ANON_KEY && !URL.includes('placeholder');

// ============================================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================================
export const supabase = createClient(URL, KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Single storage bucket used for ALL media (stories, avatars, banners, catches). */
export const MEDIA_BUCKET = 'media' as const;

/** Reject after ms so async operations don't hang (e.g. on slow network or iOS file ops). */
function promiseWithTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

// ============================================================================
// AUTH HELPERS
// ============================================================================

export interface SignUpData {
  email: string;
  password: string;
  displayName?: string;
}

/**
 * Sign up a new user and create their profile
 */
export async function signUp(data: SignUpData) {
  try {
    const displayName = data.displayName || data.email.split('@')[0];

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    return { success: true, user: authData.user, session: authData.session };
  } catch (error) {
    console.error('Sign up error:', error);
    throw error;
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return { success: true, session: data.session };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
}

/**
 * Sign in with Apple identity token (for native iOS/Expo)
 * Use with expo-apple-authentication credential.identityToken
 */
export async function signInWithApple(
  idToken: string,
  fullName?: { givenName?: string; familyName?: string }
) {
  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: idToken,
    });

    if (error) throw error;

    if (data.user) {
      if (fullName) {
        const displayName = [fullName.givenName, fullName.familyName]
          .filter(Boolean)
          .join(' ');
        if (displayName) {
          await supabase.auth.updateUser({
            data: { full_name: displayName },
          });
        }
      }
      const profile = await getUserProfile(data.user.id);
      if (!profile) {
        const displayName =
          fullName?.givenName || fullName?.familyName || data.user.email?.split('@')[0] || 'Angler';
        await ensureProfileForUser(data.user.id, displayName);
      }
    }

    return { success: true, session: data.session };
  } catch (error) {
    console.error('Sign in with Apple error:', error);
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function resetPasswordForEmail(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: undefined, // Use default Supabase redirect
    });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Reset password error:', error);
    throw error;
  }
}

/**
 * Sign out current user
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Delete the current user's account and all associated data.
 * Calls delete_my_account RPC (deletes auth user; profiles/catches cascade).
 * Caller must sign out and clear local cache after this succeeds.
 */
export async function deleteAccount(_userId: string): Promise<{ success: boolean }> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut();
  return { success: true };
}

/**
 * Get current user session
 */
export async function getCurrentSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    console.error('Get session error:', error);
    return null;
  }
}

/**
 * Get current authenticated user
 * Uses getSession() to avoid AuthSessionMissingError when no session exists
 * (expected for "explore first" - browsing without signing in).
 */
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.user ?? null;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

/** Auth event: INITIAL_SESSION | SIGNED_IN | SIGNED_OUT | TOKEN_REFRESHED | USER_UPDATED | ... */
export type AuthChangeEvent = string;

/**
 * Watch authentication state changes.
 * Callback receives (event, user) so caller can avoid refetching profile on TOKEN_REFRESHED.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, user: { id: string; email?: string; user_metadata?: any } | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user ?? null);
  });
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Use to avoid passing mock IDs (e.g. "user-jc") to Supabase UUID columns. */
export function isValidUuid(s: string): boolean {
  return typeof s === 'string' && UUID_REGEX.test(s.trim());
}

/**
 * Fetch user's profile with all details.
 * Uses limit(1) instead of single() to avoid PGRST116 when no profile exists yet
 * (e.g. new user before trigger ran, or trigger not applied).
 * Returns null immediately for non-UUID ids (e.g. mock users like "user-jc") to avoid 22P02.
 */
export async function getUserProfile(userId: string) {
  if (!userId || !isValidUuid(userId)) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .limit(1);

    if (error) throw error;
    const profile = data?.[0] ?? null;
    if (profile) {
      const updatedAt = (profile as { updated_at?: string }).updated_at;
      profile.avatar_url = getAvatarUrlWithCacheBust(profile.avatar_url, updatedAt) ?? profile.avatar_url ?? null;
      if (profile.banner_url && !profile.banner_url.startsWith('http')) {
        const bannerBase = getPublicUrl(MEDIA_BUCKET, profile.banner_url);
        profile.banner_url = updatedAt ? `${bannerBase}?t=${new Date(updatedAt).getTime()}` : bannerBase;
      }
    }
    return profile;
  } catch (error) {
    console.error('Get profile error:', error);
    return null;
  }
}

/**
 * Ensure current user has a profile. Call on app load after session is restored.
 * Gets session → fetches profile → creates if missing.
 */
export async function ensureProfile() {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user?.id) return null;
    let profile = await getUserProfile(user.id);
    if (profile) return profile;
    const displayName =
      (user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0]) || 'Angler';
    const username = user.user_metadata?.username ?? `user_${user.id.replace(/-/g, '').slice(0, 12)}`;
    return ensureProfileForUser(user.id, displayName, undefined, username);
  } catch (e) {
    console.error('ensureProfile error:', e);
    return null;
  }
}

/**
 * Ensure a profile row exists for the user. Creates one if missing.
 * Call after signup/signin when getUserProfile returns null.
 * Sets name and display_name from displayName for backward compatibility.
 */
export async function ensureProfileForUser(
  userId: string,
  displayName?: string,
  avatarUrl?: string,
  username?: string
) {
  try {
    const disp = displayName ?? 'Angler';
    const payload: Record<string, unknown> = {
      id: userId,
      display_name: disp,
      avatar_url:
        avatarUrl ??
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
      is_mock: false,
    };
    if (username != null && username.trim())
      payload.username = username.trim().toLowerCase();

    const { data, error } = await supabase
      .from('profiles')
      .upsert([payload], { onConflict: 'id' })
      .select()
      .limit(1);

    if (error) throw error;
    return data?.[0] ?? null;
  } catch (error) {
    console.error('Ensure profile error:', error);
    return null;
  }
}

/** Resolve display name from profile: name -> display_name -> username -> fallback */
export function getProfileDisplayName(
  p: { name?: string | null; display_name?: string | null; username?: string | null } | null | undefined,
  fallback = 'Angler'
): string {
  const v = p?.name ?? p?.display_name ?? p?.username;
  return (typeof v === 'string' && v.trim()) ? v.trim() : fallback;
}

/** Check if username is available (case-insensitive). Exclude current user when editing. */
export async function checkUsernameAvailable(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  const u = username.trim().toLowerCase();
  if (!u) return false;
  try {
    const q = supabase
      .from('profiles')
      .select('id')
      .ilike('username', u)
      .limit(1);
    const { data } = await (excludeUserId ? q.neq('id', excludeUserId) : q);
    return !data?.length;
  } catch {
    return false;
  }
}

/**
 * Update user profile
 * When name or display_name is updated, also updates Supabase Auth user metadata
 * so the dashboard (Authentication → Users) shows the correct display name.
 */
export async function updateUserProfile(userId: string, updates: any) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .limit(1);

    if (error) throw error;

    const nameVal = updates.display_name ?? updates.name;
    if (nameVal != null && typeof nameVal === 'string') {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: nameVal,
          full_name: nameVal,
          name: nameVal,
        },
      });
      if (authError) {
        console.error('Update auth user metadata error:', authError);
        // Don't throw — profile was saved; auth metadata is best-effort
      }
    }

    return data?.[0] ?? null;
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
}

/**
 * Lightweight fetch for gamification: only species + dates (no photos, notes, etc.).
 * Much faster than getUserCatches when building passport / caught species.
 */
export async function getUserCatchesForPassport(userId: string, limit = 2000) {
  try {
    const { data, error, count } = await supabase
      .from('catches')
      .select('species, taken_at, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('taken_at', { ascending: false })
      .range(0, limit - 1);

    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  } catch (error) {
    console.error('Get catches for passport error:', error);
    return { data: [], total: 0 };
  }
}

/**
 * Fetch user's catches with pagination
 */
export async function getUserCatches(userId: string, limit = 20, offset = 0) {
  try {
    const { data, error, count } = await supabase
      .from('catches')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('taken_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    const rows = (data || []).map((row) => {
      let photoUrl: string | null = row.photo_path
        ? getPublicUrl(MEDIA_BUCKET, row.photo_path)
        : row.photo_url ?? null;
      // Legacy: photo_url may be a storage path (not full URL) — resolve it
      if (photoUrl && !photoUrl.toLowerCase().startsWith('http')) {
        photoUrl = getPublicUrl(MEDIA_BUCKET, photoUrl);
      }
      return { ...row, photo_url: photoUrl };
    });
    return { data: rows, total: count || 0 };
  } catch (error) {
    console.error('Get catches error:', error);
    return { data: [], total: 0 };
  }
}

/**
 * Create a new catch record (uses create_log_entry RPC to enforce free-tier 20 limit)
 */
export async function createCatch(userId: string, catchData: any) {
  try {
    const { data, error } = await supabase.rpc('create_log_entry', {
      p_species: catchData.species ?? 'Unknown',
      p_weight_lb: Math.max(0.1, catchData.weight_lb ?? 0.1),
      p_length_in: catchData.length_in ?? null,
      p_notes: catchData.notes ?? null,
      p_location: catchData.location ?? null,
      p_taken_at: catchData.taken_at ?? new Date().toISOString(),
      p_upload_status: catchData.upload_status ?? 'complete',
    });
    if (error) throw error;
    const r = data as { id: string; user_id: string } | null;
    if (!r?.id) throw new Error('Insert returned no row');
    return { id: r.id, user_id: r.user_id, ...catchData };
  } catch (error) {
    console.error('Create catch error:', error);
    throw error;
  }
}

/**
 * Update a catch record (e.g. after AI analysis, photo upload)
 */
export async function updateCatch(catchId: string, updates: Record<string, unknown>) {
  try {
    const { data, error } = await supabase
      .from('catches')
      .update(updates)
      .eq('id', catchId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Update catch error:', error);
    throw error;
  }
}

/**
 * Delete all catches for the current user. Uses RPC to bypass getUserCatches
 * (which can fail on malformed data). Returns number deleted.
 */
export async function deleteAllMyCatches(): Promise<number> {
  const { data, error } = await supabase.rpc('delete_my_catches');
  if (error) throw error;
  return typeof data === 'number' ? data : Number(data) || 0;
}

/**
 * Permanently delete a catch record owned by the current user.
 * Also removes the photo from storage when present (full delete).
 */
export async function deleteCatch(catchId: string): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from('catches')
    .select('id, user_id, photo_path')
    .eq('id', catchId)
    .single();

  if (fetchError || !row) {
    throw fetchError || new Error('Catch not found');
  }

  if (row.photo_path) {
    try {
      await supabase.storage.from(MEDIA_BUCKET).remove([row.photo_path]);
    } catch (storageErr) {
      console.warn('[deleteCatch] Storage remove failed (continuing with row delete):', storageErr);
    }
  }

  const { error: deleteError } = await supabase
    .from('catches')
    .delete()
    .eq('id', catchId);

  if (deleteError) throw deleteError;
}


/**
 * Fetch leaderboard entries for a competition
 */
export async function getLeaderboardEntries(
  competitionId: number,
  location?: string,
  limit = 100
) {
  try {
    let query = supabase
      .from('leaderboard_entries')
      .select('*, profiles(display_name, avatar_url, username)')
      .eq('competition_id', competitionId)
      .eq('hidden', false)
      .lt('flagged_count', 5)
      .order('weight_lb', { ascending: false })
      .limit(limit);

    if (location) {
      query = query.eq('location', location);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return [];
  }
}

/**
 * Create a leaderboard entry
 */
export async function createLeaderboardEntry(
  userId: string,
  competitionId: number,
  catchId: string,
  entryData: any
) {
  try {
    const { data, error } = await supabase
      .from('leaderboard_entries')
      .insert([
        {
          user_id: userId,
          competition_id: competitionId,
          catch_id: catchId,
          ...entryData,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Create leaderboard entry error:', error);
    throw error;
  }
}

export interface FriendWithProfile {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  username?: string;
}

/**
 * Fetch user's accepted friends with profile data for the OTHER user
 */
export async function getFriendsWithProfiles(userId: string): Promise<FriendWithProfile[]> {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('id, user_id_1, user_id_2')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .eq('status', 'accepted');

    if (error) throw error;
    if (!data?.length) return [];

    const otherIds = data.map((r) => (r.user_id_1 === userId ? r.user_id_2 : r.user_id_1));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, username')
      .in('id', otherIds);

    const byId = new Map((profiles || []).map((p) => [p.id, p]));
    return data.map((r) => {
      const otherId = r.user_id_1 === userId ? r.user_id_2 : r.user_id_1;
      const p = byId.get(otherId);
      const rawAvatar = p?.avatar_url;
      const avatarUrl = rawAvatar
        ? (getAvatarUrlWithCacheBust(rawAvatar) ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherId}`)
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherId}`;
      return {
        id: r.id,
        userId: otherId,
        displayName: getProfileDisplayName(p),
        avatarUrl,
        username: p?.username,
      };
    });
  } catch (error) {
    console.error('Get friends error:', error);
    return [];
  }
}

/**
 * @deprecated Use getFriendsWithProfiles for friend list with profiles
 */
export async function getUserFriends(userId: string) {
  const friends = await getFriendsWithProfiles(userId);
  return friends.map((f) => ({ id: f.id, user_id_1: userId, user_id_2: f.userId, status: 'accepted' }));
}

export interface PendingFriendRequest {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  fromAvatarUrl: string;
  fromUsername?: string;
  createdAt: string;
}

/**
 * Fetch pending friend requests where current user is the RECIPIENT
 * (i.e. someone else sent the request to me — requested_by != userId)
 */
export async function getPendingFriendRequests(userId: string): Promise<PendingFriendRequest[]> {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('id, user_id_1, user_id_2, requested_by, created_at')
      .eq('status', 'pending')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

    if (error) throw error;
    if (!data?.length) return [];

    // Only show requests that SOMEONE ELSE sent to me
    const receivedRequests = data.filter((r) => r.requested_by !== userId);
    if (!receivedRequests.length) return [];

    // The sender is whoever is stored in requested_by
    const requesterIds = receivedRequests.map((r) => r.requested_by as string);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, username')
      .in('id', requesterIds);

    const byId = new Map((profiles || []).map((p) => [p.id, p]));
    return receivedRequests.map((r) => {
      const fromId = r.requested_by as string;
      const p = byId.get(fromId);
      return {
        id: r.id,
        fromUserId: fromId,
        fromDisplayName: getProfileDisplayName(p),
        fromAvatarUrl: getAvatarUrlWithCacheBust(p?.avatar_url) ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${fromId}`,
        fromUsername: p?.username,
        createdAt: r.created_at,
      };
    });
  } catch (error) {
    console.error('Get pending requests error:', error);
    return [];
  }
}

/**
 * Accept a friend request (current user must be the recipient)
 */
export async function acceptFriendRequest(friendshipId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .eq('status', 'pending');
    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error('Accept friend request error:', e);
    throw e;
  }
}

/**
 * Decline a friend request (remove or block)
 */
export async function declineFriendRequest(friendshipId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .eq('status', 'pending');
    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error('Decline friend request error:', e);
    throw e;
  }
}

/**
 * Remove a friend (unfriend)
 */
export async function removeFriend(friendshipId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .eq('status', 'accepted');
    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error('Remove friend error:', e);
    throw e;
  }
}

/**
 * Generate a friend invite code
 */
export async function generateInviteCode(userId: string) {
  try {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

    const { data, error } = await supabase
      .from('friend_invites')
      .insert([
        {
          code,
          user_id: userId,
          expires_at: expiresAt.toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Generate invite code error:', error);
    throw error;
  }
}

/**
 * Send a friend request from current user to target user.
 * Creates a pending friendship. Target user must accept.
 */
export async function sendFriendRequest(requesterId: string, targetUserId: string) {
  try {
    if (requesterId === targetUserId) {
      throw new Error('Cannot send friend request to yourself');
    }

    const minId = requesterId < targetUserId ? requesterId : targetUserId;
    const maxId = requesterId < targetUserId ? targetUserId : requesterId;

    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status, requested_by')
      .eq('user_id_1', minId)
      .eq('user_id_2', maxId)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error('Already friends');
      }
      if (existing.status === 'pending' && existing.requested_by === requesterId) {
        throw new Error('Friend request already sent');
      }
      if (existing.status === 'blocked') {
        throw new Error('Cannot send request');
      }
    }

    const { data, error } = await supabase
      .from('friendships')
      .insert([
        {
          user_id_1: minId,
          user_id_2: maxId,
          status: 'pending',
          requested_by: requesterId,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { success: true, friendship: data };
  } catch (error) {
    console.error('Send friend request error:', error);
    throw error;
  }
}

/**
 * Redeem a friend invite code
 */
export async function redeemInviteCode(code: string, userId: string) {
  try {
    // Find the invite (maybeSingle avoids PGRST116 when no row)
    const { data: invite, error: inviteError } = await supabase
      .from('friend_invites')
      .select('*')
      .eq('code', code.toUpperCase())
      .gt('expires_at', new Date().toISOString())
      .is('redeemed_at', null)
      .maybeSingle();

    if (inviteError) throw new Error('Invalid or expired invite code');
    if (!invite) throw new Error('Invite not found');

    // Create friendship (both directions for easier querying)
    const user1 = invite.user_id;
    const user2 = userId;
    const minId = user1 < user2 ? user1 : user2;
    const maxId = user1 < user2 ? user2 : user1;

    const { error: friendError } = await supabase.from('friendships').insert([
      {
        user_id_1: minId,
        user_id_2: maxId,
        status: 'accepted',
      },
    ]);

    if (friendError) throw friendError;

    // Mark invite as redeemed
    const { error: redeemError } = await supabase
      .from('friend_invites')
      .update({
        redeemed_by_user_id: userId,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', invite.id);

    if (redeemError) throw redeemError;

    return { success: true, invitedBy: invite.user_id };
  } catch (error) {
    console.error('Redeem invite code error:', error);
    throw error;
  }
}

/**
 * Send a message to a friend
 */
export async function sendMessage(
  senderId: string,
  recipientId: string,
  body: string
) {
  try {
    const conversationId = [senderId, recipientId].sort().join('_');

    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          sender_id: senderId,
          recipient_id: recipientId,
          body,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Send message error:', error);
    throw error;
  }
}

/**
 * Fetch conversation messages
 */
export async function getConversation(user1Id: string, user2Id: string) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user1Id},recipient_id.eq.${user2Id}),and(sender_id.eq.${user2Id},recipient_id.eq.${user1Id})`
      )
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get conversation error:', error);
    return [];
  }
}

/**
 * Subscribe to real-time messages
 */
export function subscribeToMessages(
  user1Id: string,
  user2Id: string,
  onMessage: (message: any) => void
) {
  const conversationId = [user1Id, user2Id].sort().join('_');

  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onMessage(payload.new);
      }
    )
    .subscribe();
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

/**
 * Upload a file to Supabase Storage (always uses MEDIA_BUCKET).
 */
export async function uploadFile(
  _bucketIgnored: string,
  path: string,
  file: Blob | ArrayBuffer | Uint8Array,
  options?: { upsert?: boolean; contentType?: string }
) {
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: options?.upsert ?? true,
      ...options,
    });

  devLog('[Storage] upload result', { bucket: MEDIA_BUCKET, path, data, error: error?.message ?? null });
  if (error) {
    console.error('[Storage] upload error', { bucket: MEDIA_BUCKET, path, error });
    throw error;
  }

  if (path.includes('/stories/')) {
    const folder = path.split('/').slice(0, -1).join('/');
    const { data: list, error: listErr } = await supabase.storage.from(MEDIA_BUCKET).list(folder, { limit: 10 });
    devLog('[Storage] media/stories list after upload', { folder, list: list?.map((f) => f.name), error: listErr?.message ?? null });
  }
  return data;
}

/**
 * Upload from local file URI (React Native). Uses expo-file-system.
 * Copies ph://, asset-library://, content://, file:// to cache first so they can be read on iOS.
 * Always uploads to MEDIA_BUCKET.
 */
export async function uploadFileFromUri(
  _bucketIgnored: string,
  path: string,
  uri: string,
  options?: { upsert?: boolean; contentType?: string }
) {
  const trimmed = (uri || '').trim();
  if (!trimmed) throw new Error('Invalid file URI');
  let fileUri = trimmed;
  const cacheDir = FileSystem.cacheDirectory;
  const needsCopy =
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('asset-library://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('file://');
  if (cacheDir && needsCopy) {
    const cachePath = `${cacheDir}upload_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: trimmed, to: cachePath });
    fileUri = cachePath;
    devLog('[Storage] uploadFileFromUri copied to cache', { from: trimmed, to: fileUri });
  }
  devLog('[Storage] uploadFileFromUri start', { bucket: MEDIA_BUCKET, path, uploadUri: fileUri });
  const response = await fetch(fileUri);
  if (!response.ok) {
    const err = new Error(`Could not read image file (status ${response.status})`);
    console.error('[Storage] uploadFileFromUri fetch failed', { bucket: MEDIA_BUCKET, path, fileUri, status: response.status });
    throw err;
  }
  const blob = await response.blob();
  const blobSize = blob.size;
  const blobType = blob.type;
  devLog('[Storage] uploadFileFromUri blob', { bucket: MEDIA_BUCKET, path, blobSize, blobType });
  if (!blob || blobSize === 0) {
    const err = new Error('Blob is empty or conversion failed');
    console.error('[Storage] uploadFileFromUri empty blob', { bucket: MEDIA_BUCKET, path, fileUri });
    throw err;
  }
  return await uploadFile(MEDIA_BUCKET, path, blob, options);
}

/**
 * Get public URL for a file in the media bucket.
 * The bucket parameter is accepted for legacy call-site compatibility but always uses MEDIA_BUCKET.
 */
export function getPublicUrl(_bucketIgnored: string, path: string): string {
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Build avatar URL (path → full URL) with optional cache-bust so the current profile pic always displays.
 * Use updatedAt (ISO string or timestamp) when available; otherwise pass a load/session timestamp.
 */
export function getAvatarUrlWithCacheBust(
  avatarPathOrUrl: string | null | undefined,
  cacheBust?: string | number | null
): string | undefined {
  if (!avatarPathOrUrl || !avatarPathOrUrl.trim()) return undefined;
  const base = avatarPathOrUrl.startsWith('http')
    ? avatarPathOrUrl.replace(/\?t=\d+$/, '')
    : getPublicUrl(MEDIA_BUCKET, avatarPathOrUrl);
  const t = cacheBust != null
    ? (typeof cacheBust === 'number' ? cacheBust : new Date(cacheBust).getTime())
    : Date.now();
  return `${base}?t=${t}`;
}

// ============================================================================
// FEED POSTS
// ============================================================================

export interface FeedPostRow {
  id: string;
  user_id: string;
  photo_path: string | null;
  photo_url: string | null;
  media_paths: string[] | null;
  species: string;
  weight_lb: number;
  length_in: number | null;
  caption: string | null;
  location: string | null;
  catch_id: string | null;
  hype_count: number;
  comment_count: number;
  share_count?: number;
  created_at: string;
}

export interface InsertFeedPostInput {
  user_id: string;
  id?: string;
  photo_path?: string | null;
  photo_url?: string | null;
  media_paths?: string[] | null;
  species?: string;
  weight_lb?: number;
  length_in?: number | null;
  caption?: string | null;
  location?: string | null;
  catch_id?: string | null;
}

export async function insertFeedPost(input: InsertFeedPostInput): Promise<FeedPostRow> {
  const row: Record<string, unknown> = {
    user_id: input.user_id,
    photo_path: input.photo_path ?? null,
    photo_url: input.photo_url ?? null,
    species: input.species ?? '',
    weight_lb: input.weight_lb ?? 0,
    length_in: input.length_in ?? null,
    caption: input.caption ?? null,
    location: input.location ?? null,
    catch_id: input.catch_id ?? null,
  };
  if (input.id != null) row.id = input.id;
  if (input.media_paths != null) row.media_paths = input.media_paths;
  const { data, error } = await supabase
    .from('feed_posts')
    .insert([row])
    .select()
    .single();
  if (error) throw error;
  return data as FeedPostRow;
}

export async function getFeedPostsByUserId(
  userId: string,
  limit = 30,
  offset = 0
): Promise<FeedPostRow[]> {
  const { data, error } = await supabase
    .from('feed_posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as FeedPostRow[];
}

/** Delete a feed post. Allowed for post author or moderator (RLS). */
export async function deleteFeedPost(postId: string): Promise<void> {
  const { error } = await supabase.from('feed_posts').delete().eq('id', postId);
  if (error) throw error;
}

/** Row returned from feed_posts joined with profiles for home feed */
export interface FeedPostWithProfile extends FeedPostRow {
  profiles: { name?: string | null; display_name: string | null; avatar_url: string | null; username: string | null; subscription_plan?: string | null; pro_expires_at?: string | null; total_xp?: number | null; angler_rating?: number | null } | null;
}

/** Fetch all feed posts (universal feed) with author profile data. Newest first. */
export async function getFeedPostsForHome(limit = 50): Promise<FeedPostWithProfile[]> {
  const { data: posts, error } = await supabase
    .from('feed_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (posts ?? []) as FeedPostRow[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, username, subscription_plan, pro_expires_at, total_xp, angler_rating, updated_at')
    .in('id', userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((r) => ({
    ...r,
    profiles: byId.get(r.user_id) ?? null,
  })) as FeedPostWithProfile[];
}

/** Fetch a single feed post by id with author profile. For shared-post links and post detail screen. */
export async function getFeedPostById(postId: string): Promise<FeedPostWithProfile | null> {
  const { data: row, error } = await supabase
    .from('feed_posts')
    .select('*')
    .eq('id', postId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const r = row as FeedPostRow;
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, username, subscription_plan, pro_expires_at, total_xp, angler_rating, updated_at')
    .in('id', [r.user_id]);
  const p = (profiles ?? [])[0] ?? null;
  return { ...r, profiles: p } as FeedPostWithProfile;
}

/** Search feed posts by species or caption (hashtags, text). Returns same shape as getFeedPostsForHome. */
export async function getFeedPostsSearch(term: string, limit = 50): Promise<FeedPostWithProfile[]> {
  const t = term.trim();
  if (!t) return [];
  const pattern = `%${t}%`;
  const [bySpecies, byCaption] = await Promise.all([
    supabase.from('feed_posts').select('*').ilike('species', pattern).order('created_at', { ascending: false }).limit(limit),
    supabase.from('feed_posts').select('*').ilike('caption', pattern).order('created_at', { ascending: false }).limit(limit),
  ]);
  const err = bySpecies.error || byCaption.error;
  if (err) throw err;
  const seen = new Set<string>();
  const rows: FeedPostRow[] = [];
  for (const row of [...(bySpecies.data ?? []), ...(byCaption.data ?? [])] as FeedPostRow[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const limited = rows.slice(0, limit);
  if (limited.length === 0) return [];

  const userIds = [...new Set(limited.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, username, subscription_plan, pro_expires_at, total_xp, angler_rating, updated_at')
    .in('id', userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return limited.map((r) => ({
    ...r,
    profiles: byId.get(r.user_id) ?? null,
  })) as FeedPostWithProfile[];
}

/** Post IDs the given user has hyped (for isHyped on feed). */
export async function getHypedPostIdsForUser(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('feed_post_hypes')
    .select('post_id')
    .eq('user_id', userId);
  if (error) {
    console.error('getHypedPostIdsForUser error:', error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.post_id));
}

/** Toggle hype on a feed post. Returns new count and isHyped. */
export async function hypeFeedPost(
  postId: string,
  hype: boolean
): Promise<{ hypeCount: number; isHyped: boolean }> {
  const { data, error } = await supabase.rpc('hype_feed_post', {
    p_post_id: postId,
    p_hype: hype,
  });
  if (error) throw error;
  return {
    hypeCount: (data as { hypeCount?: number })?.hypeCount ?? 0,
    isHyped: (data as { isHyped?: boolean })?.isHyped ?? hype,
  };
}

/** Add a comment (or reply). Returns new comment id and comment count. */
export async function addFeedComment(
  postId: string,
  text: string,
  parentCommentId?: string | null
): Promise<{ commentId: string; commentCount: number }> {
  const { data, error } = await supabase.rpc('add_feed_comment', {
    p_post_id: postId,
    p_text: text.trim(),
    p_parent_id: parentCommentId ?? null,
  });
  if (error) throw error;
  const d = data as { commentId?: string; commentCount?: number };
  return {
    commentId: d?.commentId ?? '',
    commentCount: d?.commentCount ?? 0,
  };
}

/** Comment row with profile for display. */
export interface FeedCommentWithProfile {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  text: string;
  likes: number;
  created_at: string;
  profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
}

/** Fetch comments for a feed post (with author profile). Ordered by created_at asc. */
export async function getFeedComments(postId: string): Promise<FeedCommentWithProfile[]> {
  const { data: comments, error } = await supabase
    .from('feed_comments')
    .select('id, post_id, user_id, parent_comment_id, text, likes, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('getFeedComments error:', error);
    return [];
  }
  const rows = (comments ?? []) as { id: string; user_id: string; parent_comment_id: string | null; text: string; likes: number; created_at: string }[];
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    id: r.id,
    post_id: postId,
    user_id: r.user_id,
    parent_comment_id: r.parent_comment_id,
    text: r.text,
    likes: r.likes,
    created_at: r.created_at,
    profiles: byId.get(r.user_id) ?? null,
  }));
}

/** Increment share count for a post (RPC only; client cannot set count directly). */
export async function incrementFeedShare(postId: string): Promise<{ shareCount: number }> {
  const { data, error } = await supabase.rpc('increment_feed_share', { p_post_id: postId });
  if (error) throw error;
  const d = data as { shareCount?: number };
  return { shareCount: d?.shareCount ?? 0 };
}

function generatePostId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Create a feed post, uploading photo(s) or video(s) to storage. Supports multiple media. */
export async function createFeedPost(input: {
  user_id: string;
  photoPath?: string | null;
  photoUrl?: string | null;
  mediaType?: 'image' | 'video';
  /** When set, upload all items and store in media_paths; photo_path = first path. */
  mediaItems?: { uri: string; type: 'image' | 'video' }[];
  species?: string;
  weight_lb?: number;
  length_in?: number | null;
  caption?: string | null;
  location?: string | null;
  catch_id?: string | null;
}): Promise<FeedPostRow> {
  const postId = generatePostId();
  let photo_path: string | null = input.photoPath ?? null;
  let photo_url: string | null = input.photoUrl ?? null;
  let media_paths: string[] | null = null;

  const items = input.mediaItems?.filter((m) => m.uri?.trim()) ?? [];
  if (items.length > 0) {
    const paths: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const { uri, type } = items[i];
      const isLocal = uri.startsWith('file://') || uri.startsWith('content://');
      const ext = type === 'video' ? 'mp4' : 'jpg';
      const path = mediaPath.postIndex(input.user_id, postId, i, ext);
      if (isLocal) {
        if (type === 'video') {
          await uploadVideoToStorage(MEDIA_BUCKET, path, uri);
        } else {
          await uploadImageAsJpegToStorage(MEDIA_BUCKET, path, uri);
        }
      }
      paths.push(path);
    }
    photo_path = paths[0];
    photo_url = getPublicUrl(MEDIA_BUCKET, paths[0]);
    media_paths = paths;
  } else {
    const uri = typeof input.photoUrl === 'string' ? input.photoUrl : '';
    const isLocal = uri.startsWith('file://') || uri.startsWith('content://');
    const isVideo = input.mediaType === 'video';
    if (isLocal && uri) {
      const path = isVideo
        ? mediaPath.post(input.user_id, postId).replace(/\.jpg$/i, '.mp4')
        : mediaPath.post(input.user_id, postId);
      if (isVideo) {
        await uploadVideoToStorage(MEDIA_BUCKET, path, uri);
      } else {
        await uploadImageAsJpegToStorage(MEDIA_BUCKET, path, uri);
      }
      photo_path = path;
      photo_url = getPublicUrl(MEDIA_BUCKET, path);
    }
  }

  return insertFeedPost({
    user_id: input.user_id,
    id: postId,
    photo_path,
    photo_url: photo_path ? null : photo_url,
    media_paths,
    species: input.species,
    weight_lb: input.weight_lb,
    length_in: input.length_in,
    caption: input.caption,
    location: input.location,
    catch_id: input.catch_id,
  });
}

/**
 * Call analyze-fish Edge Function for AI species/weight/length identification.
 * Input: imageUrl (public URL) OR storagePath + optional bucket
 * Returns: { species, confidence, top3, estimated_length_in, estimated_weight_lb, notes }
 */
export async function invokeAnalyzeFish(params: {
  imageUrl?: string;
  storagePath?: string;
  bucket?: string;
}) {
  devLog('[Log] analyze-fish request:', {
    hasImageUrl: !!params.imageUrl,
    hasStoragePath: !!params.storagePath,
  });
  const res = await supabase.functions.invoke('analyze-fish', {
    body: params,
  });
  devLog('[Log] analyze-fish response:', {
    hasError: !!res.error,
    errorMessage: (res.error as { message?: string })?.message,
    errorStatus: (res.error as { status?: number })?.status,
    dataError: res.data?.error,
  });
  const { data, error } = res;
  if (error) {
    const status = (error as { status?: number })?.status;
    const msg = (error as { message?: string })?.message ?? String(error);
    const details = res.data?.error ?? (typeof res.data === 'object' ? JSON.stringify(res.data) : null);
    throw new Error(
      status ? `${status}: ${msg}` + (details ? ` — ${details}` : '') : msg + (details ? ` — ${details}` : '')
    );
  }
  if (data?.error) throw new Error(String(data.error));
  return data as {
    species: string;
    confidence: number;
    top3: { species: string; confidence: number }[];
    estimated_length_in: number;
    estimated_weight_lb: number;
    notes: string;
  };
}

export interface FriendStory {
  userId: string;
  username: string;
  avatar: string;
  catchPhotoUrl: string;
  species: string;
  weight: number;
  postedAt: string;
  catchId: string;
  isNearby?: boolean;
}

/**
 * Fetch friends' active stories (only explicitly posted stories — NOT auto-generated from catches).
 * Stories expire after 24h via the expires_at column.
 */
export async function getFriendStories(userId: string): Promise<FriendStory[]> {
  try {
    const friends = await getFriendsWithProfiles(userId);
    const friendIds = friends.map((f) => f.userId);
    if (friendIds.length === 0) return [];

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('stories')
      .select('id, user_id, media_url, media_path, created_at, expires_at')
      .in('user_id', friendIds)
      .gt('expires_at', now)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data?.length) return [];

    const byUser = new Map(friends.map((f) => [f.userId, f]));
    const seen = new Set<string>();
    const stories: FriendStory[] = [];

    for (const s of data) {
      if (seen.has(s.user_id)) continue;
      seen.add(s.user_id);
      const f = byUser.get(s.user_id);
      if (!f) continue;
      const mediaUrl = s.media_path
        ? getPublicUrl(MEDIA_BUCKET, s.media_path)
        : s.media_url;
      if (!mediaUrl) continue;
      stories.push({
        userId: s.user_id,
        username: f.displayName,
        avatar: f.avatarUrl,
        catchPhotoUrl: mediaUrl,
        species: '',
        weight: 0,
        postedAt: s.created_at ?? s.expires_at ?? new Date().toISOString(),
        catchId: s.id,
      });
    }
    return stories;
  } catch (error) {
    console.error('Get friend stories error:', error);
    return [];
  }
}

/**
 * Fetch recent catches (last 24h) from nearby public users who opted into location sharing.
 * Uses a lat/lng bounding box (~radiusKm radius) to avoid PostGIS dependency.
 * Excludes the current user and any friend userIds passed in.
 */
export async function getNearbyUsersWithStories(
  userLat: number,
  userLng: number,
  excludeUserIds: string[],
  radiusKm = 50,
): Promise<FriendStory[]> {
  try {
    // Bounding box: 1 deg lat ≈ 111 km
    const deltaLat = radiusKm / 111;
    const deltaLng = radiusKm / (111 * Math.cos((userLat * Math.PI) / 180));

    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, username, lat, lng')
      .eq('public', true)
      .eq('location_sharing', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .gte('lat', userLat - deltaLat)
      .lte('lat', userLat + deltaLat)
      .gte('lng', userLng - deltaLng)
      .lte('lng', userLng + deltaLng);

    if (profErr) throw profErr;
    if (!profiles?.length) return [];

    const nearbyIds = profiles
      .map((p) => p.id as string)
      .filter((id) => !excludeUserIds.includes(id));
    if (nearbyIds.length === 0) return [];

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: catches, error: catchErr } = await supabase
      .from('catches')
      .select('id, user_id, species, weight_lb, photo_url, photo_path, taken_at')
      .in('user_id', nearbyIds)
      .or('photo_url.not.is.null,photo_path.not.is.null')
      .gte('taken_at', since)
      .is('deleted_at', null)
      .order('taken_at', { ascending: false });

    if (catchErr) throw catchErr;
    if (!catches?.length) return [];

    const byUser = new Map(profiles.map((p) => [p.id, p]));
    const seen = new Set<string>();
    const stories: FriendStory[] = [];
    for (const c of catches) {
      if (seen.has(c.user_id)) continue;
      seen.add(c.user_id);
      const p = byUser.get(c.user_id);
      if (!p) continue;
      const photoUrl = c.photo_path
        ? getPublicUrl(MEDIA_BUCKET, c.photo_path)
        : c.photo_url;
      if (!photoUrl) continue;
      stories.push({
        userId: c.user_id,
        username: getProfileDisplayName(p),
        avatar: getAvatarUrlWithCacheBust(p.avatar_url) ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user_id}`,
        catchPhotoUrl: photoUrl,
        species: c.species,
        weight: c.weight_lb,
        postedAt: c.taken_at ?? c.id,
        catchId: c.id,
        isNearby: true,
      });
    }
    return stories;
  } catch (error) {
    // Suppress "column profiles.lat does not exist" — means migration hasn't been run yet.
    // Run schema-migrations/004_profiles_location_sharing.sql in Supabase SQL Editor to enable nearby.
    const code = (error as { code?: string })?.code;
    if (code !== '42703') console.error('getNearbyUsersWithStories error:', error);
    return [];
  }
}

/**
 * Permanently delete a story: removes the storage file then the DB row.
 * Only the owner can call this (RLS enforced on DB + storage).
 */
export async function deleteStory(storyId: string): Promise<void> {
  const { data } = await supabase
    .from('stories')
    .select('media_path')
    .eq('id', storyId)
    .maybeSingle();

  if (data?.media_path) {
    try {
      await supabase.storage.from(MEDIA_BUCKET).remove([data.media_path]);
    } catch {
      // Non-fatal — still delete the DB row
    }
  }

  const { error } = await supabase.from('stories').delete().eq('id', storyId);
  if (error) throw error;
}

/**
 * Fetch a single catch by id (for catch detail screen)
 */
export async function getCatchById(catchId: string) {
  try {
    const { data, error } = await supabase
      .from('catches')
      .select('*, profiles(display_name, avatar_url, username)')
      .eq('id', catchId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      photo_url: data.photo_path
        ? getPublicUrl(MEDIA_BUCKET, data.photo_path)
        : data.photo_url,
    };
  } catch (error) {
    console.error('Get catch error:', error);
    return null;
  }
}

// ============================================================================
// STORIES
// ============================================================================

export interface StoryRow {
  id: string;
  user_id: string;
  media_url: string;
  media_path: string;
  created_at: string;
  expires_at: string;
  updated_at?: string;
  caption?: string | null;
}

/**
 * Insert a new story row with placeholder media; returns the row with id. Caller uploads then calls updateStoryMedia.
 */
export async function createStoryRow(userId: string, caption?: string | null): Promise<StoryRow | null> {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('stories')
      .insert([
        {
          user_id: userId,
          media_url: '',
          media_path: '',
          expires_at: expiresAt,
          ...(caption != null && caption !== '' ? { caption } : {}),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Create story row error:', e);
    return null;
  }
}

/**
 * Delete a story row (for cleanup when upload fails).
 */
export async function deleteStoryRow(storyId: string): Promise<void> {
  try {
    await supabase.from('stories').delete().eq('id', storyId);
  } catch (e) {
    console.error('Delete story row error:', e);
  }
}

/**
 * Update an existing story row with media_path only (never full URL or error string).
 */
export async function updateStoryMedia(
  storyId: string,
  _mediaUrl: string,
  mediaPath: string,
  caption?: string | null
) {
  try {
    const updates: Record<string, unknown> = { media_path: mediaPath, media_url: '' };
    if (caption !== undefined) updates.caption = caption;
    const { data, error } = await supabase
      .from('stories')
      .update(updates)
      .eq('id', storyId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Update story media error:', e);
    throw e;
  }
}

/** Valid story media_path: non-empty, contains '/', ends with image extension */
function isValidStoryPath(path: string | null | undefined): path is string {
  if (!path || typeof path !== 'string' || !path.trim()) return false;
  const p = path.trim();
  if (!p.includes('/')) return false;
  const lower = p.toLowerCase();
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png');
}

/**
 * Fetch active stories for a user (expires_at > now), newest first.
 * Only returns rows with valid media_path. Always computes media_url from media_path (never trust DB media_url).
 */
export async function getUserStories(userId: string): Promise<StoryRow[]> {
  try {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .not('media_path', 'eq', '')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = data || [];
    return rows
      .filter((row) => isValidStoryPath(row.media_path))
      .map((row) => {
        const path = row.media_path as string;
        const url = getPublicUrl(MEDIA_BUCKET, path);
        return { ...row, media_url: url };
      });
  } catch (e) {
    console.error('Get user stories error:', e);
    return [];
  }
}

/**
 * Fetch current user's active stories (for own profile)
 */
export async function getMyStories(): Promise<StoryRow[]> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return [];
  return getUserStories(userId);
}

/**
 * Copy ph://, ph-upload://, asset-library://, content://, file:// URIs to cache so they can be read on iOS.
 * ImageManipulator and FileSystem don't handle ph/content directly ("no suitable url request handler").
 * file:// from camera/ImagePicker can be ephemeral on iOS TestFlight — copying ensures a stable path.
 */
async function copyToCacheIfNeeded(uri: string, extension = 'jpg'): Promise<string> {
  const trimmed = (uri || '').trim();
  if (!trimmed) throw new Error('Invalid image URI');
  const needsCopy =
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('ph-upload://') ||
    trimmed.startsWith('asset-library://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('file://');
  const cacheDir = FileSystem.cacheDirectory;
  if (!needsCopy || !cacheDir) return trimmed;
  const cachePath = `${cacheDir}upload_${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: trimmed, to: cachePath });
  return cachePath;
}

const UPLOAD_IMAGE_TIMEOUT_MS = 50000;
const UPLOAD_VIDEO_TIMEOUT_MS = 120000;

/**
 * Upload video file to Supabase Storage (no image decoding). Use for feed post videos.
 * Copies to cache with .mp4 extension, reads as base64, uploads with video/mp4.
 */
export async function uploadVideoToStorage(
  _bucketIgnored: string,
  path: string,
  localUri: string,
  options?: { upsert?: boolean }
): Promise<string> {
  return promiseWithTimeout(
    (async () => {
      const workUri = await copyToCacheIfNeeded(localUri, 'mp4');
      const base64 = await FileSystem.readAsStringAsync(workUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64) throw new Error('Empty base64 from video file');

      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      if (bytes.length === 0) throw new Error('Video upload produced empty bytes');

      devLog('[MEDIA] uploadVideoToStorage bytes', { bucket: MEDIA_BUCKET, path, byteLength: bytes.length });

      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, bytes, {
          contentType: 'video/mp4',
          upsert: options?.upsert ?? true,
        });

      if (error) throw error;
      return path;
    })(),
    UPLOAD_VIDEO_TIMEOUT_MS,
    'Video upload timed out. Check your connection and try again.'
  );
}

/**
 * Upload image to Supabase Storage using base64 + Uint8Array (reliable in Expo, avoids fetch/blob).
 * Use for catch-photos, stories, etc. Returns the path on success.
 * Copies ph:// URIs to cache on iOS to avoid "no suitable url request handler".
 * Bounded by timeout so slow file/network ops don't hang (e.g. TestFlight).
 */
export async function uploadImageAsJpegToStorage(
  _bucketIgnored: string,
  path: string,
  localUri: string,
  options?: { upsert?: boolean }
): Promise<string> {
  return promiseWithTimeout(
    (async () => {
      const workUri = await copyToCacheIfNeeded(localUri);
      const manipulated = await ImageManipulator.manipulateAsync(
        workUri,
        [],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      const jpegUri = manipulated?.uri ?? workUri;

      const base64 = await FileSystem.readAsStringAsync(jpegUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64) throw new Error('Empty base64 from image');

      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      if (bytes.length === 0) throw new Error('Image upload produced empty bytes');

      devLog('[MEDIA] uploadImageAsJpegToStorage bytes', { bucket: MEDIA_BUCKET, path, byteLength: bytes.length });

      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, bytes, {
          contentType: 'image/jpeg',
          upsert: options?.upsert ?? true,
        });

      if (error) throw error;
      return path;
    })(),
    UPLOAD_IMAGE_TIMEOUT_MS,
    'Photo upload timed out. Check your connection and try again.'
  );
}

/**
 * Upload story: insert row → upload to MEDIA_BUCKET → update row with storage key.
 * Path: {userId}/stories/{storyId}.jpg  (stored as media_path, never a full URL).
 * Uses uploadImageAsJpegToStorage — the single shared upload function so there is
 * exactly ONE code path that calls supabase.storage.from(MEDIA_BUCKET).
 */
export async function uploadStory(localUri: string, caption?: string | null): Promise<StoryRow | null> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) {
    const err = new Error('No session for story upload');
    console.error('[MEDIA] uploadStory BEFORE createStoryRow FAILED', { userId: null, localUri });
    throw err;
  }
  devLog('[MEDIA] uploadStory BEFORE createStoryRow', { userId, localUri, bucket: MEDIA_BUCKET });

  const story = await createStoryRow(userId, caption);
  if (!story) {
    const err = new Error('createStoryRow returned null');
    console.error('[MEDIA] uploadStory AFTER createStoryRow FAILED', { userId, storyId: null });
    throw err;
  }
  const storyId = story.id;
  const mediaPathKey = `${userId}/stories/${storyId}.jpg`;
  devLog('[MEDIA] uploadStory AFTER createStoryRow', { userId, storyId, bucket: MEDIA_BUCKET, mediaPathKey, localUri });

  try {
    // Single shared upload function — always writes to MEDIA_BUCKET
    await uploadImageAsJpegToStorage(MEDIA_BUCKET, mediaPathKey, localUri, { upsert: true });
    devLog('[MEDIA] uploadStory AFTER upload', { userId, storyId, media_path: mediaPathKey });

    const updated = await updateStoryMedia(story.id, '', mediaPathKey, caption);
    devLog('[MEDIA] uploadStory AFTER updateStoryMedia', { userId, storyId, updated: !!updated });

    const url = getPublicUrl(MEDIA_BUCKET, mediaPathKey);
    if (!updated) return { ...story, media_url: url, media_path: mediaPathKey };
    return { ...updated, media_url: url };
  } catch (e) {
    console.error('[MEDIA] uploadStory FAILED', {
      userId,
      storyId,
      bucket: MEDIA_BUCKET,
      mediaPathKey,
      localUri,
      error: (e as Error)?.message,
    });
    await deleteStoryRow(story.id);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Story likes (TASK D)
// ---------------------------------------------------------------------------

/** Get like count for a story */
export async function getStoryLikeCount(storyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('story_likes')
    .select('*', { count: 'exact', head: true })
    .eq('story_id', storyId);
  if (error) {
    console.error('[STORY_VIEW] getStoryLikeCount error', { storyId, error });
    return 0;
  }
  return count ?? 0;
}

/** Check if current user liked a story */
export async function getStoryLikedByMe(storyId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return false;
  const { data, error } = await supabase
    .from('story_likes')
    .select('id')
    .eq('story_id', storyId)
    .eq('liked_by', userId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

/** Toggle like: if already liked, delete; else insert. Returns { liked: boolean, count: number } */
export async function toggleStoryLike(storyId: string): Promise<{ liked: boolean; count: number }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return { liked: false, count: await getStoryLikeCount(storyId) };
  const liked = await getStoryLikedByMe(storyId);
  if (liked) {
    await supabase.from('story_likes').delete().eq('story_id', storyId).eq('liked_by', userId);
    const count = await getStoryLikeCount(storyId);
    return { liked: false, count };
  } else {
    await supabase.from('story_likes').insert([{ story_id: storyId, liked_by: userId }]);
    const count = await getStoryLikeCount(storyId);
    return { liked: true, count };
  }
}

/**
 * Delete a file from the media bucket.
 */
export async function deleteFile(_bucketIgnored: string, path: string) {
  try {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete file error:', error);
    throw error;
  }
}

// ============================================================================
// GLOBAL RANK — XP sync + rank query
// ============================================================================

/**
 * Push the current user's XP to the profiles table so all clients see the
 * same value and rank queries work across users.
 * Uses max(local, remote) so we never overwrite server with a lower value.
 * Retries up to 2 times on failure.
 */
export async function syncUserXp(userId: string, xp: number): Promise<void> {
  const sync = async (attempt: number): Promise<void> => {
    try {
      const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('total_xp')
        .eq('id', userId)
        .single();
      if (fetchErr && attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
        return sync(1);
      }
      const remote = typeof profile?.total_xp === 'number' ? profile.total_xp : 0;
      const toSave = Math.max(remote, xp);
      const { error } = await supabase
        .from('profiles')
        .update({ total_xp: toSave })
        .eq('id', userId);
      if (error && attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
        return sync(1);
      }
      if (error) console.warn('[syncUserXp]', error.message);
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
        return sync(1);
      }
      console.warn('[syncUserXp] network error', err);
    }
  };
  await sync(0);
}

// ============================================================================
// ANGLER RATING (AR) — tournament-based competitive rank (replaces XP global rank)
// ============================================================================

export interface AnglerLeaderboardRow {
  rank: number;
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  state?: string | null;
  angler_rating: number;
  wins: number;
  podiums: number;
}

export interface AnglerRankResult {
  rank: number | null;
  angler_rating: number;
  wins: number;
  podiums: number;
}

/**
 * Fetch AR leaderboard from Supabase. scope: 'global' | 'local'. For local, pass user's state (e.g. 'FL'); null/empty = all.
 * Uses RPC get_angler_leaderboard; on empty or error, falls back to direct profiles query so leaderboard always shows.
 */
export async function getAnglerLeaderboard(
  scope: 'global' | 'local',
  stateFilter: string | null,
  limit = 10000
): Promise<AnglerLeaderboardRow[]> {
  const state = stateFilter && stateFilter.trim() ? stateFilter.trim() : null;

  const parseRpc = (data: unknown): AnglerLeaderboardRow[] => {
    const rows = (data ?? []) as { rank: number; id: string; username: string | null; display_name: string | null; avatar_url: string | null; state?: string | null; angler_rating: number; wins: number; podiums: number }[];
    return rows.map((r) => ({
      rank: Number(r.rank),
      id: r.id,
      username: r.username ?? null,
      display_name: r.display_name ?? null,
      avatar_url: r.avatar_url ?? null,
      state: r.state ?? null,
      angler_rating: Number(r.angler_rating ?? 0),
      wins: Number(r.wins ?? 0),
      podiums: Number(r.podiums ?? 0),
    }));
  };

  // Try RPC with correct param names (int, text, text)
  try {
    const { data, error } = await supabase.rpc('get_angler_leaderboard', {
      p_limit_n: limit,
      p_scope: scope,
      p_state_filter: state,
    });
    if (!error && data && Array.isArray(data) && data.length > 0) {
      return parseRpc(data);
    }
    if (error) {
      console.warn('[getAnglerLeaderboard] RPC error:', (error as { message?: string }).message);
    }
  } catch (e) {
    console.warn('[getAnglerLeaderboard] RPC exception:', (e as Error).message);
  }

  // Fallback: direct profiles query so leaderboard always shows (e.g. RPC missing or returns empty)
  try {
    let query = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, angler_rating')
      .order('angler_rating', { ascending: false })
      .limit(limit);

    if (scope === 'local' && state) {
      query = query.ilike('state', state.trim());
    }

    const { data: profiles, error: profileError } = await query;
    if (profileError) {
      console.error('[getAnglerLeaderboard] fallback profiles error:', profileError.message);
      return [];
    }
    const list = (profiles ?? []) as { id: string; username: string | null; display_name: string | null; avatar_url: string | null; angler_rating: number | null }[];
    if (list.length === 0) return [];

    // Fetch wins/podiums from trophy_badges for these users
    const ids = list.map((p) => p.id);
    const { data: badges } = await supabase
      .from('trophy_badges')
      .select('user_id, place')
      .in('user_id', ids);
    const winsMap = new Map<string, number>();
    const podiumsMap = new Map<string, number>();
    for (const b of badges ?? []) {
      const uid = (b as { user_id: string; place: number }).user_id;
      const place = (b as { place: number }).place;
      if (place === 1) winsMap.set(uid, (winsMap.get(uid) ?? 0) + 1);
      if (place <= 3) podiumsMap.set(uid, (podiumsMap.get(uid) ?? 0) + 1);
    }

    const withStats = list.map((p) => ({
      id: p.id,
      username: p.username ?? null,
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
      angler_rating: Number(p.angler_rating ?? 0),
      wins: winsMap.get(p.id) ?? 0,
      podiums: podiumsMap.get(p.id) ?? 0,
    }));
    // Sort by AR desc, wins desc, podiums desc (match RPC ordering) then assign ranks
    withStats.sort((a, b) => {
      if (b.angler_rating !== a.angler_rating) return b.angler_rating - a.angler_rating;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.podiums - a.podiums;
    });
    return withStats.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      state: null,
      angler_rating: row.angler_rating,
      wins: row.wins,
      podiums: row.podiums,
    }));
  } catch (e) {
    console.error('[getAnglerLeaderboard] fallback failed:', e);
    return [];
  }
}

/**
 * Get a single user's AR rank and stats. scope: 'global' | 'local'; stateFilter for local (user's state).
 */
export async function getAnglerRank(
  userId: string,
  scope: 'global' | 'local' = 'global',
  stateFilter: string | null = null
): Promise<AnglerRankResult> {
  try {
    const { data, error } = await supabase.rpc('get_angler_rank', {
      p_user_id: userId,
      p_scope: scope,
      p_state_filter: stateFilter && stateFilter.trim() ? stateFilter.trim() : null,
    });
    if (error || !data || !Array.isArray(data) || data.length === 0) {
      const profile = await supabase.from('profiles').select('angler_rating').eq('id', userId).single();
      const ar = profile.data?.angler_rating ?? 0;
      return { rank: null, angler_rating: ar, wins: 0, podiums: 0 };
    }
    const row = data[0] as { rank: number; angler_rating: number; wins: number; podiums: number };
    return {
      rank: row.rank != null ? Number(row.rank) : null,
      angler_rating: Number(row.angler_rating ?? 0),
      wins: Number(row.wins ?? 0),
      podiums: Number(row.podiums ?? 0),
    };
  } catch (e) {
    console.error('[getAnglerRank]', e);
    return { rank: null, angler_rating: 0, wins: 0, podiums: 0 };
  }
}

/** Batch fetch total_xp and prestige for leaderboard users. Returns Record<userId, { total_xp, prestige }>. */
export async function getLeaderboardProfileExtras(
  userIds: string[]
): Promise<Record<string, { total_xp: number; prestige: number }>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, total_xp, prestige')
      .in('id', unique);
    if (error || !data?.length) return {};
    return (data as { id: string; total_xp?: number | null; prestige?: number | null }[]).reduce(
      (acc, row) => {
        acc[row.id] = {
          total_xp: row.total_xp ?? 0,
          prestige: Math.min(3, Math.max(0, row.prestige ?? 0)),
        };
        return acc;
      },
      {} as Record<string, { total_xp: number; prestige: number }>
    );
  } catch (e) {
    console.error('[getLeaderboardProfileExtras]', e);
    return {};
  }
}

// ============================================================================
// SEASONS + PRESTIGE
// ============================================================================

export interface SeasonInfo {
  id: string;
  season_number: number;
  name: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
}

export async function getCurrentSeason(): Promise<SeasonInfo | null> {
  try {
    const { data, error } = await supabase.rpc('get_current_season');
    if (error || !data || !Array.isArray(data) || data.length === 0) return null;
    const row = data[0] as { id: string; season_number: number; name: string; start_date: string; end_date: string; days_remaining: number };
    return {
      id: row.id,
      season_number: row.season_number,
      name: row.name,
      start_date: row.start_date,
      end_date: row.end_date,
      days_remaining: row.days_remaining ?? 0,
    };
  } catch (e) {
    console.error('[getCurrentSeason]', e);
    return null;
  }
}

export interface SeasonResultRow {
  season_id: string;
  season_number: number;
  season_name: string;
  final_ar: number;
  final_rank: number;
}

export async function getSeasonResultsForUser(userId: string): Promise<SeasonResultRow[]> {
  try {
    const { data: results, error } = await supabase
      .from('season_results')
      .select('season_id, final_ar, final_rank')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error || !results?.length) return [];
    const seasonIds = [...new Set(results.map((r) => r.season_id))];
    const { data: seasons } = await supabase.from('seasons').select('id, season_number, name').in('id', seasonIds);
    const seasonMap = new Map((seasons ?? []).map((s) => [s.id, s]));
    return results.map((r) => {
      const s = seasonMap.get(r.season_id);
      return {
        season_id: r.season_id,
        season_number: s?.season_number ?? 0,
        season_name: s?.name ?? `Season ${s?.season_number ?? '?'}`,
        final_ar: r.final_ar ?? 0,
        final_rank: Number(r.final_rank ?? 0),
      };
    });
  } catch (e) {
    console.error('[getSeasonResultsForUser]', e);
    return [];
  }
}

export type PrestigeResult = { status: 'success'; prestige: number } | { status: string; message?: string };

export async function prestigeNow(): Promise<PrestigeResult> {
  try {
    const { data, error } = await supabase.rpc('prestige_now');
    if (error) {
      return { status: 'error', message: error.message };
    }
    const result = data as { status?: string; prestige?: number; message?: string };
    if (result?.status === 'success' && typeof result.prestige === 'number') {
      return { status: 'success', prestige: result.prestige };
    }
    return { status: result?.status ?? 'error', message: result?.message };
  } catch (e) {
    console.error('[prestigeNow]', e);
    return { status: 'error', message: String(e) };
  }
}

// ============================================================================
// DIRECT MESSAGE CONVERSATIONS
// ============================================================================

export interface DmConversation {
  otherUserId: string;
  otherUsername: string;
  otherAvatarUrl: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

/** Deterministic conversation_id from two user UUIDs (matches chat screen logic). */
export function conversationIdForDm(a: string, b: string): string {
  const [lo, hi] = [a, b].sort();
  const clean = (s: string) => s.replace(/-/g, '');
  const loHex = clean(lo);
  const hiHex = clean(hi);
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += (parseInt(loHex[i], 16) ^ parseInt(hiHex[i], 16)).toString(16);
  }
  return `${result.slice(0, 8)}-${result.slice(8, 12)}-${result.slice(12, 16)}-${result.slice(16, 20)}-${result.slice(20)}`;
}

/** Message body prefix for shared feed posts. Body = prefix + JSON.stringify({ postId, species, weight, caption, photoUrl }). */
export const SHARED_POST_MESSAGE_PREFIX = '[SNAGGED:POST]';

export interface SharedPostPayload {
  postId: string;
  species: string;
  weight: string;
  caption: string;
  photoUrl: string;
  /** When true, photoUrl is a video; show thumbnail from start of video in chat. */
  isVideo?: boolean;
}

export function buildSharedPostMessage(payload: SharedPostPayload): string {
  return SHARED_POST_MESSAGE_PREFIX + JSON.stringify(payload);
}

export function parseSharedPostBody(body: string): SharedPostPayload | null {
  if (!body.startsWith(SHARED_POST_MESSAGE_PREFIX)) return null;
  try {
    const json = body.slice(SHARED_POST_MESSAGE_PREFIX.length);
    const o = JSON.parse(json) as SharedPostPayload;
    return o?.postId ? o : null;
  } catch {
    return null;
  }
}

/**
 * Send a direct message. Used by chat screen and by "share post to friend" flow.
 */
export async function sendDirectMessage(
  senderId: string,
  recipientId: string,
  body: string
): Promise<{ id: string; created_at: string }> {
  const convId = conversationIdForDm(senderId, recipientId);
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: convId,
      sender_id: senderId,
      recipient_id: recipientId,
      body,
    })
    .select('id, created_at')
    .single();
  if (error) throw error;
  return data as { id: string; created_at: string };
}

/**
 * Returns one entry per unique DM conversation partner, ordered most-recent first.
 */
export async function getDirectConversations(myUserId: string): Promise<DmConversation[]> {
  const { data: msgs, error } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .or(`sender_id.eq.${myUserId},recipient_id.eq.${myUserId}`)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error || !msgs || msgs.length === 0) return [];

  // Build per-conversation map (keyed by other user's id)
  const convMap = new Map<string, { lastMsg: typeof msgs[0]; unread: number }>();
  for (const m of msgs) {
    const otherId = m.sender_id === myUserId ? m.recipient_id : m.sender_id;
    if (!convMap.has(otherId)) {
      convMap.set(otherId, { lastMsg: m, unread: 0 });
    }
    if (m.recipient_id === myUserId && !m.read_at) {
      convMap.get(otherId)!.unread += 1;
    }
  }

  if (convMap.size === 0) return [];

  const otherIds = [...convMap.keys()];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', otherIds);

  const profileMap = new Map<string, { name?: string | null; username: string; display_name: string | null; avatar_url: string | null }>();
  for (const p of profiles ?? []) profileMap.set(p.id, p);

  return otherIds
    .map((otherId) => {
      const { lastMsg, unread } = convMap.get(otherId)!;
      const p = profileMap.get(otherId);
      const otherAvatarUrl = getAvatarUrlWithCacheBust(p?.avatar_url) ?? '';
      return {
        otherUserId: otherId,
        otherUsername: getProfileDisplayName(p, 'Unknown'),
        otherAvatarUrl,
        lastMessage: lastMsg.body,
        lastMessageAt: lastMsg.created_at,
        unreadCount: unread,
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

// ============================================================================
// GROUP CHATS
// ============================================================================

export interface GroupChatMember {
  userId: string;
  username: string;
  avatarUrl: string;
  joinedAt: string;
}

export interface GroupChatSummary {
  id: string;
  name: string;
  imageUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  members: GroupChatMember[];
  lastMessage: string | null;
  lastMessageAt: string | null;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderUsername: string;
  senderAvatarUrl: string;
  body: string;
  createdAt: string;
}

/**
 * Create a new group chat and add the specified members.
 */
export async function createGroupChat(
  name: string,
  imageUrl: string | null,
  memberIds: string[],
  createdBy: string
): Promise<GroupChatSummary> {
  const { data: group, error: groupErr } = await supabase
    .from('group_chats')
    .insert({ name, image_url: imageUrl, created_by: createdBy })
    .select()
    .single();
  if (groupErr || !group) throw groupErr ?? new Error('Failed to create group');

  const memberRows = [...new Set([createdBy, ...memberIds])].map((uid) => ({
    group_id: group.id,
    user_id: uid,
  }));
  const { error: memberErr } = await supabase.from('group_chat_members').insert(memberRows);
  if (memberErr) throw memberErr;

  return {
    id: group.id,
    name: group.name,
    imageUrl: group.image_url,
    createdBy: group.created_by,
    createdAt: group.created_at,
    members: [],
    lastMessage: null,
    lastMessageAt: null,
  };
}

/**
 * Fetch all group chats where the user is a member, with members + last message.
 */
export async function getUserGroupChats(userId: string): Promise<GroupChatSummary[]> {
  // My group memberships
  const { data: memberships, error: mErr } = await supabase
    .from('group_chat_members')
    .select('group_id')
    .eq('user_id', userId);
  if (mErr || !memberships || memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.group_id);

  // Group details
  const { data: groups, error: gErr } = await supabase
    .from('group_chats')
    .select('id, name, image_url, created_by, created_at')
    .in('id', groupIds)
    .order('created_at', { ascending: false });
  if (gErr || !groups) return [];

  // All members for these groups
  const { data: allMembers } = await supabase
    .from('group_chat_members')
    .select('group_id, user_id, joined_at')
    .in('group_id', groupIds);

  // Profiles for all member user_ids
  const memberUserIds = [...new Set((allMembers ?? []).map((m) => m.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', memberUserIds);
  const profileMap = new Map<string, { name?: string | null; username: string; display_name: string | null; avatar_url: string | null }>();
  for (const p of profiles ?? []) profileMap.set(p.id, p);

  // Latest message per group
  const { data: latestMsgs } = await supabase
    .from('group_messages')
    .select('group_id, body, created_at')
    .in('group_id', groupIds)
    .order('created_at', { ascending: false });

  const lastMsgMap = new Map<string, { body: string; created_at: string }>();
  for (const m of latestMsgs ?? []) {
    if (!lastMsgMap.has(m.group_id)) lastMsgMap.set(m.group_id, m);
  }

  return groups.map((g) => {
    const groupMembers: GroupChatMember[] = (allMembers ?? [])
      .filter((m) => m.group_id === g.id)
      .map((m) => {
        const p = profileMap.get(m.user_id);
        return {
          userId: m.user_id,
          username: getProfileDisplayName(p, 'Unknown'),
          avatarUrl: getAvatarUrlWithCacheBust(p?.avatar_url) ?? '',
          joinedAt: m.joined_at,
        };
      });
    const lastMsg = lastMsgMap.get(g.id);
    return {
      id: g.id,
      name: g.name,
      imageUrl: g.image_url,
      createdBy: g.created_by,
      createdAt: g.created_at,
      members: groupMembers,
      lastMessage: lastMsg?.body ?? null,
      lastMessageAt: lastMsg?.created_at ?? null,
    };
  });
}

/**
 * Fetch messages for a group chat (most recent 100), ordered ascending for display.
 */
export async function getGroupMessages(groupId: string): Promise<GroupMessage[]> {
  const { data: msgs, error } = await supabase
    .from('group_messages')
    .select('id, group_id, sender_id, body, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !msgs) return [];

  const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', senderIds);
  const profileMap = new Map<string, { name?: string | null; username: string; display_name: string | null; avatar_url: string | null }>();
  for (const p of profiles ?? []) profileMap.set(p.id, p);

  return msgs
    .reverse()
    .map((m) => {
      const p = profileMap.get(m.sender_id);
      return {
        id: m.id,
        groupId: m.group_id,
        senderId: m.sender_id,
        senderUsername: getProfileDisplayName(p, 'Unknown'),
        senderAvatarUrl: getAvatarUrlWithCacheBust(p?.avatar_url) ?? '',
        body: m.body,
        createdAt: m.created_at,
      };
    });
}

/**
 * Send a message to a group chat.
 */
export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  body: string
): Promise<GroupMessage> {
  const { data, error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, sender_id: senderId, body })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Failed to send message');
  return {
    id: data.id,
    groupId: data.group_id,
    senderId: data.sender_id,
    senderUsername: '',
    senderAvatarUrl: '',
    body: data.body,
    createdAt: data.created_at,
  };
}

/**
 * Update the group chat image URL (after upload).
 */
export async function updateGroupChatImage(groupId: string, imageUrl: string): Promise<void> {
  const { error } = await supabase
    .from('group_chats')
    .update({ image_url: imageUrl })
    .eq('id', groupId);
  if (error) throw error;
}

// ============================================================================
// TROPHY BADGES (tournament winner rewards)
// ============================================================================

export interface TrophyBadgeRow {
  id: string;
  user_id: string;
  tournament_id: string;
  entry_id: string;
  place: 1 | 2 | 3;
  trophy_tier: 'gold' | 'silver' | 'bronze';
  cycle_id?: number;
  xp_awarded: number;
  fish_photo_url: string | null;
  tournament_name: string | null;
  created_at: string;
  shown_at: string | null;
}

export type ClaimTournamentWinResult =
  | { status: 'not_signed_in' }
  | { status: 'tournament_not_found' }
  | { status: 'tournament_not_ended' }
  | { status: 'not_winner' }
  | { status: 'claimed'; badge: TrophyBadgeRow }
  | { status: 'awarded'; badge: TrophyBadgeRow }
  | { status: 'rpc_error'; message: string };

export async function claimTournamentWin(tournamentId: string): Promise<ClaimTournamentWinResult> {
  const { data, error } = await supabase.rpc('claim_tournament_win', {
    p_tournament_id: tournamentId,
  });
  if (error) {
    console.error('[claimTournamentWin] RPC error for tournamentId:', tournamentId, error.message, error);
    return { status: 'rpc_error', message: error.message };
  }
  const result = (data ?? { status: 'not_winner' }) as ClaimTournamentWinResult;
  if (!result || typeof (result as { status?: string }).status === 'undefined') {
    console.warn('[claimTournamentWin] RPC returned null or invalid payload for tournamentId:', tournamentId, data);
  }
  return result;
}

export async function setTrophyShown(badgeId: string): Promise<void> {
  const { error } = await supabase.rpc('set_trophy_shown', { p_badge_id: badgeId });
  if (error) console.warn('[setTrophyShown]', error.message);
}

export async function setTrophyHidden(badgeId: string): Promise<void> {
  const { error } = await supabase.rpc('set_trophy_hidden', { p_badge_id: badgeId });
  if (error) console.warn('[setTrophyHidden]', error.message);
}

export async function deleteTrophyBadge(badgeId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_trophy_badge', { p_badge_id: badgeId });
  if (error) {
    console.warn('[deleteTrophyBadge]', error.message);
    return false;
  }
  return data === true;
}

/** Top 3 trophy badges for a tournament cycle (for detail modal). */
export async function getTournamentPodium(
  tournamentId: string,
  cycleId: number
): Promise<TrophyBadgeRow[]> {
  const { data, error } = await supabase.rpc('get_tournament_podium', {
    p_tournament_id: tournamentId,
    p_cycle_id: cycleId,
  });
  if (error) return [];
  return (Array.isArray(data) ? data : data ?? []) as TrophyBadgeRow[];
}

/**
 * Dev/test only: end current cycle now and start a new one.
 * Use durationSeconds (1–3600) for short test (e.g. 20), or durationMinutes (≤60) for minute-based.
 */
export async function forceRestartTournament(
  templateKey: string,
  durationMinutes: number = 10,
  durationSeconds?: number
): Promise<{ ok: boolean; tournament_id?: string; duration_minutes?: number; duration_seconds?: number; error?: string }> {
  const payload: { p_template_key: string; p_duration_minutes: number; p_duration_seconds?: number } = {
    p_template_key: templateKey,
    p_duration_minutes: durationMinutes,
  };
  if (durationSeconds != null && durationSeconds > 0) {
    payload.p_duration_seconds = durationSeconds;
  }
  const { data, error } = await supabase.rpc('force_restart_tournament', payload);
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false }) as { ok: boolean; tournament_id?: string; duration_minutes?: number; duration_seconds?: number; error?: string };
}

export async function getTrophyBadges(userId: string): Promise<TrophyBadgeRow[]> {
  const { data, error } = await supabase
    .from('trophy_badges')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as TrophyBadgeRow[];
}

// =============================================================================
// Trophies table + profile display items (dynamic "Trophies & Badges" row)
// =============================================================================

export interface TrophyRow {
  id: string;
  user_id: string;
  tournament_id: string;
  entry_id: string;
  place: 1 | 2 | 3;
  awarded_at: string;
}

export interface ProfileDisplayItemRow {
  id: string;
  user_id: string;
  item_type: 'badge' | 'trophy';
  badge_key: string | null;
  trophy_id: string | null;
  sort_order: number;
  created_at: string;
}

/** Trophy with joined tournament name and entry image (for list/display). */
export interface TrophyWithDetails extends TrophyRow {
  tournament_name?: string;
  entry_image_url?: string;
}

/** Single display item for the profile row: either badge or trophy. */
export type ProfileDisplayItem =
  | { type: 'badge'; id: string; badgeKey: string; label: string; icon: string; rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'MYTHIC' }
  | { type: 'trophy'; id: string; trophyId: string; tournamentName: string; place: 1 | 2 | 3 | 4 | 5; imageUrl?: string };

/** If this badge looks like a tournament placement, return 1–5 so UI can show true badge instead of medallion. */
export function getInferredPlaceFromBadge(badgeKey: string, label?: string): 1 | 2 | 3 | 4 | 5 | null {
  const combined = `${(label ?? '').toLowerCase()} ${badgeKey.toLowerCase()}`;
  if (/\b1st\b|first|place-1|place_1|^tournament-1-|1st-place/.test(combined) || /^tournament-1-/.test(badgeKey)) return 1;
  if (/\b2nd\b|second|place-2|place_2|^tournament-2-|2nd-place/.test(combined) || /^tournament-2-/.test(badgeKey)) return 2;
  if (/\b3rd\b|third|place-3|place_3|^tournament-3-|3rd-place/.test(combined) || /^tournament-3-/.test(badgeKey)) return 3;
  if (/\b4th\b|fourth|place-4|place_4|^tournament-4-|4th-place/.test(combined) || /^tournament-4-/.test(badgeKey)) return 4;
  if (/\b5th\b|fifth|place-5|place_5|^tournament-5-|5th-place/.test(combined) || /^tournament-5-/.test(badgeKey)) return 5;
  if (/^tournament-/.test(badgeKey)) return 1;
  return null;
}

/** Podium entry for trophy detail modal. */
export interface PodiumEntry {
  place: 1 | 2 | 3 | 4 | 5;
  username: string;
  image_url: string | null;
  weight_lb: number | null;
  length_in: number | null;
}

/** Fetch user's trophies with tournament name and entry image. */
export async function getTrophiesForUser(userId: string): Promise<TrophyWithDetails[]> {
  const { data: trophies, error: te } = await supabase
    .from('trophies')
    .select('*')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false });
  if (te || !trophies?.length) return [];
  const tRows = trophies as TrophyRow[];
  const tournamentIds = [...new Set(tRows.map((t) => t.tournament_id))];
  const entryIds = tRows.map((t) => t.entry_id);
  const { data: tournaments } = await supabase.from('tournaments').select('id, title').in('id', tournamentIds);
  const { data: entries } = await supabase.from('tournament_entries').select('id, image_url').in('id', entryIds);
  const tMap = (tournaments ?? []).reduce<Record<string, { title: string }>>((a, b: { id: string; title: string }) => ({ ...a, [b.id]: { title: b.title } }), {});
  const eMap = (entries ?? []).reduce<Record<string, { image_url: string }>>((a, b: { id: string; image_url: string }) => ({ ...a, [b.id]: { image_url: b.image_url } }), {});
  return tRows.map((t) => ({
    ...t,
    tournament_name: tMap[t.tournament_id]?.title,
    entry_image_url: eMap[t.entry_id]?.image_url,
  })) as TrophyWithDetails[];
}

/** Fetch pinned profile display items (max 3) with full badge/trophy details. */
export async function getProfileDisplayItems(userId: string): Promise<ProfileDisplayItem[]> {
  const { data: rows, error } = await supabase
    .from('user_profile_display_items')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(3);
  if (error || !rows?.length) return [];
  const items = rows as ProfileDisplayItemRow[];
  const result: ProfileDisplayItem[] = [];
  const trophyIds = items.filter((r) => r.trophy_id).map((r) => r.trophy_id!);
  let trophiesMap: Record<string, TrophyWithDetails> = {};
  if (trophyIds.length > 0) {
    const { data: trophies } = await supabase.from('trophies').select('*').in('id', trophyIds);
    if (trophies?.length) {
      const entryIds = (trophies as TrophyRow[]).map((t) => t.entry_id);
      const tournamentIds = [...new Set((trophies as TrophyRow[]).map((t) => t.tournament_id))];
      const [entriesRes, tournamentsRes] = await Promise.all([
        supabase.from('tournament_entries').select('id, image_url').in('id', entryIds),
        supabase.from('tournaments').select('id, title').in('id', tournamentIds),
      ]);
      const eMap = (entriesRes.data ?? []).reduce<Record<string, { image_url: string }>>((a, b: { id: string; image_url: string }) => ({ ...a, [b.id]: { image_url: b.image_url } }), {});
      const tMap = (tournamentsRes.data ?? []).reduce<Record<string, { title: string }>>((a, b: { id: string; title: string }) => ({ ...a, [b.id]: { title: b.title } }), {});
      trophiesMap = (trophies as TrophyRow[]).reduce<Record<string, TrophyWithDetails>>((a, t) => ({
        ...a,
        [t.id]: {
          ...t,
          tournament_name: tMap[t.tournament_id]?.title,
          entry_image_url: eMap[t.entry_id]?.image_url,
        },
      }), {});
    }
  }
  // Fallback: resolve trophy_id from trophy_badges when not in trophies (e.g. display items saved with badge id, or sync lag)
  const missingTrophyIds = trophyIds.filter((id) => !trophiesMap[id]);
  if (missingTrophyIds.length > 0) {
    const { data: badges } = await supabase.from('trophy_badges').select('id, place, tournament_name').in('id', missingTrophyIds);
    if (badges?.length) {
      for (const b of badges as { id: string; place: number; tournament_name: string | null }[]) {
        if (b.place >= 1 && b.place <= 5) {
          trophiesMap[b.id] = {
            id: b.id,
            user_id: '',
            tournament_id: '',
            entry_id: '',
            place: b.place as 1 | 2 | 3 | 4 | 5,
            awarded_at: '',
            tournament_name: b.tournament_name ?? undefined,
            entry_image_url: undefined,
          } as TrophyWithDetails;
        }
      }
    }
  }
  for (const row of items) {
    if (row.item_type === 'badge' && row.badge_key) {
      const placeMatch = row.badge_key.match(/^tournament-([12345])-/);
      if (placeMatch) {
        const place = parseInt(placeMatch[1], 10) as 1 | 2 | 3 | 4 | 5;
        result.push({
          type: 'trophy',
          id: `badge-as-trophy-${row.badge_key}`,
          trophyId: row.badge_key,
          tournamentName: 'Tournament',
          place,
          imageUrl: undefined,
        });
      } else if (row.badge_key.startsWith('species-')) {
        const m = row.badge_key.match(/^species-(.+?)-(hunter|master|elite|legend)$/);
        const speciesName = m
          ? m[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          : 'Fish';
        const tier = m ? m[2].charAt(0).toUpperCase() + m[2].slice(1) : '';
        const rarityMap = { hunter: 'COMMON' as const, master: 'RARE' as const, elite: 'EPIC' as const, legend: 'MYTHIC' as const };
        const rarity = m ? rarityMap[m[2] as keyof typeof rarityMap] : 'COMMON';
        result.push({
          type: 'badge',
          id: `badge-${row.badge_key}`,
          badgeKey: row.badge_key,
          label: `${speciesName} ${tier}`,
          icon: '🎖️',
          rarity,
        });
      } else {
        result.push({
          type: 'badge',
          id: `badge-${row.badge_key}`,
          badgeKey: row.badge_key,
          label: row.badge_key.replace(/^level-\d+-/, '').replace(/-/g, ' ') || 'Badge',
          icon: '🎖️',
        });
      }
    } else if (row.item_type === 'trophy' && row.trophy_id) {
      const t = trophiesMap[row.trophy_id];
      if (t)
        result.push({
          type: 'trophy',
          id: `trophy-${row.trophy_id}`,
          trophyId: row.trophy_id,
          tournamentName: t.tournament_name ?? 'Tournament',
          place: t.place,
          imageUrl: t.entry_image_url ?? undefined,
        });
    }
  }
  return result;
}

/** Batch fetch pinned display items for multiple users. Returns Record<userId, ProfileDisplayItem[]>. */
export async function getProfileDisplayItemsBatch(
  userIds: string[]
): Promise<Record<string, ProfileDisplayItem[]>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data: rows, error } = await supabase
    .from('user_profile_display_items')
    .select('*')
    .in('user_id', unique)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error || !rows?.length) {
    return Object.fromEntries(unique.map((id) => [id, []]));
  }
  const byUser = rows.reduce<Record<string, ProfileDisplayItemRow[]>>((acc, r: ProfileDisplayItemRow) => {
    const uid = r.user_id;
    if (!acc[uid]) acc[uid] = [];
    if (acc[uid].length < 3) acc[uid].push(r);
    return acc;
  }, {});
  const allRows = rows as ProfileDisplayItemRow[];
  const trophyIds = [...new Set(allRows.filter((r) => r.trophy_id).map((r) => r.trophy_id!))];
  let trophiesMap: Record<string, TrophyWithDetails> = {};
  if (trophyIds.length > 0) {
    const { data: trophies } = await supabase.from('trophies').select('*').in('id', trophyIds);
    if (trophies?.length) {
      const tRows = trophies as TrophyRow[];
      const entryIds = tRows.map((t) => t.entry_id);
      const tournamentIds = [...new Set(tRows.map((t) => t.tournament_id))];
      const [entriesRes, tournamentsRes] = await Promise.all([
        supabase.from('tournament_entries').select('id, image_url').in('id', entryIds),
        supabase.from('tournaments').select('id, title').in('id', tournamentIds),
      ]);
      const eMap = (entriesRes.data ?? []).reduce<Record<string, { image_url: string }>>(
        (a, b: { id: string; image_url: string }) => ({ ...a, [b.id]: { image_url: b.image_url } }),
        {}
      );
      const tMap = (tournamentsRes.data ?? []).reduce<Record<string, { title: string }>>(
        (a, b: { id: string; title: string }) => ({ ...a, [b.id]: { title: b.title } }),
        {}
      );
      trophiesMap = tRows.reduce<Record<string, TrophyWithDetails>>(
        (a, t) => ({
          ...a,
          [t.id]: {
            ...t,
            tournament_name: tMap[t.tournament_id]?.title,
            entry_image_url: eMap[t.entry_id]?.image_url,
          },
        }),
        {}
      );
    }
  }
  const missingTrophyIds = trophyIds.filter((id) => !trophiesMap[id]);
  if (missingTrophyIds.length > 0) {
    const { data: badges } = await supabase
      .from('trophy_badges')
      .select('id, place, tournament_name')
      .in('id', missingTrophyIds);
    if (badges?.length) {
      for (const b of badges as { id: string; place: number; tournament_name: string | null }[]) {
        if (b.place >= 1 && b.place <= 5) {
          trophiesMap[b.id] = {
            id: b.id,
            user_id: '',
            tournament_id: '',
            entry_id: '',
            place: b.place as 1 | 2 | 3 | 4 | 5,
            awarded_at: '',
            tournament_name: b.tournament_name ?? undefined,
            entry_image_url: undefined,
          } as TrophyWithDetails;
        }
      }
    }
  }
  const result: Record<string, ProfileDisplayItem[]> = {};
  for (const uid of unique) {
    result[uid] = [];
    const items = byUser[uid] ?? [];
    for (const row of items) {
      if (row.item_type === 'badge' && row.badge_key) {
        const placeMatch = row.badge_key.match(/^tournament-([12345])-/);
        if (placeMatch) {
          const place = parseInt(placeMatch[1], 10) as 1 | 2 | 3 | 4 | 5;
          result[uid].push({
            type: 'trophy',
            id: `badge-as-trophy-${row.badge_key}`,
            trophyId: row.badge_key,
            tournamentName: 'Tournament',
            place,
            imageUrl: undefined,
          });
        } else if (row.badge_key.startsWith('species-')) {
          const m = row.badge_key.match(/^species-(.+?)-(hunter|master|elite|legend)$/);
          const speciesName = m
            ? m[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            : 'Fish';
          const rarityMap = { hunter: 'COMMON' as const, master: 'RARE' as const, elite: 'EPIC' as const, legend: 'MYTHIC' as const };
          const rarity = m ? rarityMap[m[2] as keyof typeof rarityMap] : 'COMMON';
          result[uid].push({
            type: 'badge',
            id: `badge-${row.badge_key}`,
            badgeKey: row.badge_key,
            label: `${speciesName} ${m ? m[2].charAt(0).toUpperCase() + m[2].slice(1) : ''}`,
            icon: '🎖️',
            rarity,
          });
        } else {
          result[uid].push({
            type: 'badge',
            id: `badge-${row.badge_key}`,
            badgeKey: row.badge_key,
            label: row.badge_key.replace(/^level-\d+-/, '').replace(/-/g, ' ') || 'Badge',
            icon: '🎖️',
          });
        }
      } else if (row.item_type === 'trophy' && row.trophy_id) {
        const t = trophiesMap[row.trophy_id];
        if (t) {
          result[uid].push({
            type: 'trophy',
            id: `trophy-${row.trophy_id}`,
            trophyId: row.trophy_id,
            tournamentName: t.tournament_name ?? 'Tournament',
            place: t.place,
            imageUrl: t.entry_image_url ?? undefined,
          });
        }
      }
    }
  }
  return result;
}

/** Save profile display items (replaces all for user). Max 3; badge_key or trophy_id per item. */
export async function saveProfileDisplayItems(
  userId: string,
  items: Array<{ type: 'badge'; badge_key: string } | { type: 'trophy'; trophy_id: string }>
): Promise<boolean> {
  const limited = items.slice(0, 3);
  const { error: delErr } = await supabase.from('user_profile_display_items').delete().eq('user_id', userId);
  if (delErr) return false;
  if (limited.length === 0) return true;
  const rows = limited.map((item, i) => ({
    user_id: userId,
    item_type: item.type,
    badge_key: item.type === 'badge' ? item.badge_key : null,
    trophy_id: item.type === 'trophy' ? item.trophy_id : null,
    sort_order: i,
  }));
  const { error: insErr } = await supabase.from('user_profile_display_items').insert(rows);
  return !insErr;
}

/** Fetch podium (top 3) for the same tournament/cycle as the given trophy. */
export async function getPodiumForTrophy(trophyId: string): Promise<PodiumEntry[]> {
  const { data: trophy, error: tErr } = await supabase.from('trophies').select('*').eq('id', trophyId).single();
  if (tErr || !trophy) return [];
  const tr = trophy as TrophyRow;
  const { data: myEntry } = await supabase.from('tournament_entries').select('cycle_id').eq('id', tr.entry_id).single();
  const cycleId = (myEntry as { cycle_id?: number } | null)?.cycle_id ?? 1;
  const { data: allTrophies } = await supabase
    .from('trophies')
    .select('id, place, entry_id')
    .eq('tournament_id', tr.tournament_id)
    .order('place', { ascending: true });
  if (!allTrophies?.length) return [];
  const entryIds = (allTrophies as { entry_id: string }[]).map((t) => t.entry_id);
  const { data: entries } = await supabase
    .from('tournament_entries')
    .select('id, username, image_url, weight_lb, length_in, cycle_id')
    .in('id', entryIds);
  const entriesList = (entries ?? []) as { id: string; username: string; image_url: string; weight_lb: number | null; length_in: number | null; cycle_id: number }[];
  const entryMap = entriesList.reduce((a: Record<string, (typeof entriesList)[0]>, b) => ({ ...a, [b.id]: b }), {});
  const result: PodiumEntry[] = [];
  for (const t of allTrophies as { place: 1 | 2 | 3 | 4 | 5; entry_id: string }[]) {
    const e = entryMap[t.entry_id];
    if (e && e.cycle_id === cycleId) {
      result.push({ place: t.place, username: e.username, image_url: e.image_url, weight_lb: e.weight_lb, length_in: e.length_in });
      if (result.length >= 3) break;
    }
  }
  return result;
}

/** Pair of tournament id and the cycle that ended (for session guard: don't show modal twice for same pair). */
export type EndedTournamentPair = { tournamentId: string; endedCycleId: number };

/** Fetch ended (tournament_id, cycle_id) pairs for win check: only public.tournaments.id (TEXT).
 * Only includes tournaments where last_ended_cycle_id IS NOT NULL so we stay in sync with the server:
 * claim_tournament_win returns tournament_not_ended when cycle_ends_at > now() AND last_ended_cycle_id IS NULL,
 * so we avoid calling claim until reset has run (last_ended_cycle_id set). */
export async function getEndedTournamentPairsForUser(userId: string): Promise<EndedTournamentPair[]> {
  const { data: endedRows, error: tErr } = await supabase
    .from('tournaments')
    .select('id, cycle_id, last_ended_cycle_id')
    .eq('is_active', true)
    .not('last_ended_cycle_id', 'is', null);
  if (tErr || !endedRows?.length) return [];
  const pairs: EndedTournamentPair[] = (endedRows as { id: string; cycle_id: number; last_ended_cycle_id: number | null }[])
    .map((t) => ({ tournamentId: t.id, endedCycleId: t.last_ended_cycle_id ?? t.cycle_id }));
  const { data: entries, error: entriesErr } = await supabase
    .from('tournament_entries')
    .select('tournament_id, cycle_id')
    .eq('user_id', userId);
  if (entriesErr || !entries?.length) return [];
  const entrySet = new Set((entries as { tournament_id: string; cycle_id: number }[]).map((e) => `${e.tournament_id}:${e.cycle_id}`));
  return pairs.filter((p) => entrySet.has(`${p.tournamentId}:${p.endedCycleId}`));
}

/** Fetch ended tournament IDs only (for callers that don't need cycle_id). Uses getEndedTournamentPairsForUser. */
export async function getEndedTournamentIdsForUser(userId: string): Promise<string[]> {
  const pairs = await getEndedTournamentPairsForUser(userId);
  return [...new Set(pairs.map((p) => p.tournamentId))];
}

// ---------------------------------------------------------------------------
// SPECIES REQUESTS (passport "request fish" feature)
// ---------------------------------------------------------------------------

export interface SpeciesRequestRow {
  id: string;
  user_id: string;
  species_name: string;
  created_at: string;
}

/** Insert a species request. Requires authenticated user. */
export async function insertSpeciesRequest(
  userId: string,
  speciesName: string
): Promise<{ success: boolean; error?: string }> {
  const name = (speciesName || '').trim();
  if (!name || name.length < 2) {
    return { success: false, error: 'Please enter a species name (at least 2 characters).' };
  }
  try {
    const { error } = await supabase.from('species_requests').insert({
      user_id: userId,
      species_name: name,
    });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error('Insert species request error:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to submit request.',
    };
  }
}

/** Fetch aggregated requested species: species name + request count, ordered by count desc. */
export async function getRequestedSpeciesList(): Promise<
  { species_name: string; count: number }[]
> {
  try {
    const { data, error } = await supabase
      .from('species_requests')
      .select('species_name');
    if (error) throw error;
    const rows = (data ?? []) as { species_name: string }[];
    const byName: Record<string, number> = {};
    for (const r of rows) {
      const n = (r.species_name || '').trim();
      if (!n) continue;
      const key = n.toLowerCase();
      byName[key] = (byName[key] ?? 0) + 1;
    }
    return Object.entries(byName)
      .map(([k, count]) => ({ species_name: k, count }))
      .sort((a, b) => b.count - a.count);
  } catch (e) {
    console.error('Get requested species error:', e);
    return [];
  }
}

export default supabase;
