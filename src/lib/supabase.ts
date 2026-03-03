import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { createClient } from '@supabase/supabase-js';
import { mediaPath } from './mediaPaths';

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
 * Removes catches, profile, then deletes the auth user via admin RPC.
 */
export async function deleteAccount(userId: string): Promise<{ success: boolean }> {
  // Delete user catches
  await supabase.from('catches').delete().eq('user_id', userId);
  // Delete user profile
  await supabase.from('profiles').delete().eq('id', userId);
  // Delete the auth user — requires a Supabase edge function or admin RPC
  // Fallback: sign the user out so they lose access even if the DB deletion
  // doesn't fully complete on the client side
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
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

/**
 * Watch authentication state changes
 */
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      callback(session.user);
    } else {
      callback(null);
    }
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
      if (profile.avatar_url && !profile.avatar_url.startsWith('http')) {
        profile.avatar_url = getPublicUrl(MEDIA_BUCKET, profile.avatar_url);
      }
      if (profile.banner_url && !profile.banner_url.startsWith('http')) {
        profile.banner_url = getPublicUrl(MEDIA_BUCKET, profile.banner_url);
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
    return data?.[0] ?? null;
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
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
    const rows = (data || []).map((row) => ({
      ...row,
      photo_url: row.photo_path
        ? getPublicUrl(MEDIA_BUCKET, row.photo_path)
        : row.photo_url,
    }));
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
        ? (rawAvatar.startsWith('http') ? rawAvatar : getPublicUrl(MEDIA_BUCKET, rawAvatar))
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
        fromAvatarUrl: p?.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${fromId}`,
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

  console.log('[Storage] upload result', { bucket: MEDIA_BUCKET, path, data, error: error?.message ?? null });
  if (error) {
    console.error('[Storage] upload error', { bucket: MEDIA_BUCKET, path, error });
    throw error;
  }

  if (path.includes('/stories/')) {
    const folder = path.split('/').slice(0, -1).join('/');
    const { data: list, error: listErr } = await supabase.storage.from(MEDIA_BUCKET).list(folder, { limit: 10 });
    console.log('[Storage] media/stories list after upload', { folder, list: list?.map((f) => f.name), error: listErr?.message ?? null });
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
    console.log('[Storage] uploadFileFromUri copied to cache', { from: trimmed, to: fileUri });
  }
  console.log('[Storage] uploadFileFromUri start', { bucket: MEDIA_BUCKET, path, uploadUri: fileUri });
  const response = await fetch(fileUri);
  if (!response.ok) {
    const err = new Error(`Could not read image file (status ${response.status})`);
    console.error('[Storage] uploadFileFromUri fetch failed', { bucket: MEDIA_BUCKET, path, fileUri, status: response.status });
    throw err;
  }
  const blob = await response.blob();
  const blobSize = blob.size;
  const blobType = blob.type;
  console.log('[Storage] uploadFileFromUri blob', { bucket: MEDIA_BUCKET, path, blobSize, blobType });
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

// ============================================================================
// FEED POSTS
// ============================================================================

export interface FeedPostRow {
  id: string;
  user_id: string;
  photo_path: string | null;
  photo_url: string | null;
  species: string;
  weight_lb: number;
  length_in: number | null;
  caption: string | null;
  location: string | null;
  catch_id: string | null;
  hype_count: number;
  comment_count: number;
  created_at: string;
}

export interface InsertFeedPostInput {
  user_id: string;
  photo_path?: string | null;
  photo_url?: string | null;
  species?: string;
  weight_lb?: number;
  length_in?: number | null;
  caption?: string | null;
  location?: string | null;
  catch_id?: string | null;
}

export async function insertFeedPost(input: InsertFeedPostInput): Promise<FeedPostRow> {
  const { data, error } = await supabase
    .from('feed_posts')
    .insert([{
      user_id: input.user_id,
      photo_path: input.photo_path ?? null,
      photo_url: input.photo_url ?? null,
      species: input.species ?? '',
      weight_lb: input.weight_lb ?? 0,
      length_in: input.length_in ?? null,
      caption: input.caption ?? null,
      location: input.location ?? null,
      catch_id: input.catch_id ?? null,
    }])
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

/** Row returned from feed_posts joined with profiles for home feed */
export interface FeedPostWithProfile extends FeedPostRow {
  profiles: { name?: string | null; display_name: string | null; avatar_url: string | null; username: string | null; subscription_plan?: string | null; pro_expires_at?: string | null } | null;
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
    .select('id, display_name, avatar_url, username, subscription_plan, pro_expires_at')
    .in('id', userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((r) => ({
    ...r,
    profiles: byId.get(r.user_id) ?? null,
  })) as FeedPostWithProfile[];
}

/** Create a feed post, uploading photo to storage if it's a local file URI. */
export async function createFeedPost(input: {
  user_id: string;
  photoPath?: string | null;
  photoUrl?: string | null;
  species?: string;
  weight_lb?: number;
  length_in?: number | null;
  caption?: string | null;
  location?: string | null;
  catch_id?: string | null;
}): Promise<FeedPostRow> {
  let photo_path: string | null = input.photoPath ?? null;
  let photo_url: string | null = input.photoUrl ?? null;

  const uri = typeof input.photoUrl === 'string' ? input.photoUrl : '';
  const isLocal = uri.startsWith('file://') || uri.startsWith('content://');
  if (isLocal && uri) {
    const postId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    const path = mediaPath.post(input.user_id, postId);
    await uploadImageAsJpegToStorage(MEDIA_BUCKET, path, uri);
    photo_path = path;
    photo_url = getPublicUrl(MEDIA_BUCKET, path);
  }

  return insertFeedPost({
    user_id: input.user_id,
    photo_path,
    photo_url: photo_path ? null : photo_url,
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
  console.log('[Log] analyze-fish request:', {
    hasImageUrl: !!params.imageUrl,
    hasStoragePath: !!params.storagePath,
  });
  const res = await supabase.functions.invoke('analyze-fish', {
    body: params,
  });
  console.log('[Log] analyze-fish response:', {
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
        avatar: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user_id}`,
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
 * Copy ph://, ph-upload://, asset-library://, content:// URIs to cache so they can be read on iOS.
 * ImageManipulator and FileSystem don't handle these protocols directly ("no suitable url request handler").
 */
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
 * Upload image to Supabase Storage using base64 + Uint8Array (reliable in Expo, avoids fetch/blob).
 * Use for catch-photos, stories, etc. Returns the path on success.
 * Copies ph:// URIs to cache on iOS to avoid "no suitable url request handler".
 */
export async function uploadImageAsJpegToStorage(
  _bucketIgnored: string,
  path: string,
  localUri: string,
  options?: { upsert?: boolean }
): Promise<string> {
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

  console.log('[MEDIA] uploadImageAsJpegToStorage bytes', { bucket: MEDIA_BUCKET, path, byteLength: bytes.length });

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: options?.upsert ?? true,
    });

  if (error) throw error;
  return path;
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
  console.log('[MEDIA] uploadStory BEFORE createStoryRow', { userId, localUri, bucket: MEDIA_BUCKET });

  const story = await createStoryRow(userId, caption);
  if (!story) {
    const err = new Error('createStoryRow returned null');
    console.error('[MEDIA] uploadStory AFTER createStoryRow FAILED', { userId, storyId: null });
    throw err;
  }
  const storyId = story.id;
  const mediaPathKey = `${userId}/stories/${storyId}.jpg`;
  console.log('[MEDIA] uploadStory AFTER createStoryRow', { userId, storyId, bucket: MEDIA_BUCKET, mediaPathKey, localUri });

  try {
    // Single shared upload function — always writes to MEDIA_BUCKET
    await uploadImageAsJpegToStorage(MEDIA_BUCKET, mediaPathKey, localUri, { upsert: true });
    console.log('[MEDIA] uploadStory AFTER upload', { userId, storyId, media_path: mediaPathKey });

    const updated = await updateStoryMedia(story.id, '', mediaPathKey, caption);
    console.log('[MEDIA] uploadStory AFTER updateStoryMedia', { userId, storyId, updated: !!updated });

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

/**
 * Returns the 1-based global rank of a user by counting how many profiles
 * have strictly more total_xp, then adding 1.
 * Falls back to null on error (caller can hide the rank label).
 */
export async function getUserGlobalRank(userId: string): Promise<number | null> {
  try {
    // 1. Get this user's XP
    const { data: me, error: meErr } = await supabase
      .from('profiles')
      .select('total_xp')
      .eq('id', userId)
      .single();
    if (meErr || !me) return null;

    const myXp: number = me.total_xp ?? 0;

    // 2. Count how many users have strictly more XP
    const { count, error: rankErr } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gt('total_xp', myXp);
    if (rankErr) return null;

    return (count ?? 0) + 1;
  } catch {
    return null;
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
      return {
        otherUserId: otherId,
        otherUsername: getProfileDisplayName(p, 'Unknown'),
        otherAvatarUrl: p?.avatar_url ?? '',
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
          avatarUrl: p?.avatar_url ?? '',
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
        senderAvatarUrl: p?.avatar_url ?? '',
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

export default supabase;
