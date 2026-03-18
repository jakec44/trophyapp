import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCurrentUser,
  getUserProfile,
  ensureProfileForUser,
  signOut,
  onAuthStateChange,
  createCatch,
  updateCatch,
  getPublicUrl,
  uploadImageAsJpegToStorage,
} from '@/src/lib/supabase';
import { mediaPath } from '@/src/lib/mediaPaths';
import {
  getOrCreateGuestId,
  clearGuestId,
  getPendingActions,
  clearPendingActions,
  removePendingAction,
  type PendingCreateCatch,
} from '@/src/lib/pendingActions';

export interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  subscriptionPlan: 'free' | 'pro';
  proVerified: boolean;
  city?: string;
  state?: string;
  location?: string;
  bio?: string;
  /** When true, user can use dev controls, delete any feed post, and delete any tournament entry. */
  isModerator: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isSignedIn: boolean;
}

function isProFromProfile(
  p: { subscription_plan?: string | null; pro_expires_at?: string | null } | null | undefined
): boolean {
  if (!p) return false;
  if ((p.subscription_plan as string) !== 'pro') return false;
  const exp = p.pro_expires_at;
  if (exp == null) return true;
  return new Date(exp) > new Date();
}

/**
 * useAuth Hook - Manages authentication state and user data
 *
 * Usage:
 * const { user, isLoading, isSignedIn, signOut } = useAuth();
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isSignedIn: false,
  });

  const [error, setError] = useState<Error | null>(null);
  const [guestId, setGuestId] = useState<string>('');

  // Load or create guest ID when not signed in
  useEffect(() => {
    if (state.isSignedIn) return;
    getOrCreateGuestId().then(setGuestId);
  }, [state.isSignedIn]);

  /**
   * Migrate guest pending actions (e.g. CREATE_CATCH) to the signed-in user.
   * Call after successful sign-up/sign-in.
   */
  const migrateGuestData = useCallback(async (userId: string): Promise<{ migrated: number; failed: number }> => {
    const pending = await getPendingActions();
    let migrated = 0;
    let failed = 0;
    for (const action of pending) {
      if (action.type !== 'CREATE_CATCH') continue;
      const a = action as PendingCreateCatch;
      try {
        let photoUrl: string | undefined;
        let photoPath: string | undefined;
        if (a.payload.photoUri) {
          try {
            const path = mediaPath.log(userId, a.id);
            await uploadImageAsJpegToStorage('media', path, a.payload.photoUri);
            photoPath = path;
          } catch {
            // continue without photo
          }
        }
        const created = await createCatch(userId, {
          species: a.payload.species,
          weight_lb: a.payload.weight_lb > 0 ? a.payload.weight_lb : 0.1,
          length_in: a.payload.length_in && a.payload.length_in > 0 ? a.payload.length_in : undefined,
          notes: a.payload.notes || undefined,
          taken_at: a.payload.taken_at,
        });
        if (photoPath && created?.id) {
          await updateCatch(created.id, { photo_path: photoPath });
        }
        await removePendingAction(a.id);
        migrated++;
      } catch (e) {
        console.error('Migration failed for', a.id, e);
        failed++;
      }
    }
    if (migrated > 0 && failed === 0) {
      await clearGuestId();
      await clearPendingActions();
    }
    return { migrated, failed };
  }, []);

  /**
   * Clear user-scoped caches on sign-out. Call before clearing auth state.
   */
  const clearUserCache = useCallback(async (signedOutUserId?: string) => {
    const keysToRemove = [
      '@Snagged/xp',
      '@Snagged/totalCatches',
      '@Snagged/totalTournaments',
      '@Snagged/personalRecords',
      '@Snagged/caughtSpecies',
      '@Snagged/caughtSpeciesDates',
    ];
    await Promise.all(keysToRemove.map((k) => AsyncStorage.removeItem(k)));
    if (signedOutUserId) {
      const prefix = `@Snagged/user/${signedOutUserId}`;
      const userKeys = [
        `${prefix}/xp`, `${prefix}/totalCatches`, `${prefix}/totalTournaments`,
        `${prefix}/personalRecords`, `${prefix}/caughtSpecies`, `${prefix}/caughtSpeciesDates`,
      ];
      await Promise.all(userKeys.map((k) => AsyncStorage.removeItem(k)));
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    let unsubscribe: any;

    const initializeAuth = async () => {
      try {
        // Get current user
        const user = await getCurrentUser();

        if (user) {
          const migrationResult = await migrateGuestData(user.id);
          if (migrationResult.failed > 0) {
            console.warn(`Migration: ${migrationResult.migrated} migrated, ${migrationResult.failed} failed`);
          }
          let profile = await getUserProfile(user.id);
          if (!profile) {
            const displayName =
              (user.user_metadata?.display_name as string) ??
              (user.user_metadata?.full_name as string) ??
              user.email?.split('@')[0] ??
              'Angler';
            const username =
              (user.user_metadata?.username as string) ??
              `user_${user.id.replace(/-/g, '').slice(0, 12)}`;
            profile = await ensureProfileForUser(user.id, displayName, undefined, username);
          }
          setState({
            user: profile
              ? {
                  id: user.id,
                  email: user.email,
                  displayName: profile.name ?? profile.display_name,
                  username: profile.username,
                  avatarUrl: profile.avatar_url,
                  bannerUrl: profile.banner_url,
                  subscriptionPlan: (profile.subscription_plan as 'free' | 'pro') ?? 'free',
                  proVerified: isProFromProfile(profile),
                  city: profile.city,
                  state: profile.state,
                  location: profile.location,
                  bio: profile.bio,
                  isModerator: (profile as { is_moderator?: boolean }).is_moderator === true,
                }
              : null,
            isLoading: false,
            isSignedIn: !!profile,
          });
        } else {
          setState({
            user: null,
            isLoading: false,
            isSignedIn: false,
          });
        }

        // Set up auth state listener. Only refetch profile on real sign-in so we don't
        // overwrite profile pic/name when TOKEN_REFRESHED fires (which would revert to stale data).
        unsubscribe = onAuthStateChange(async (event, authUser) => {
          if (!authUser) {
            setState({ user: null, isLoading: false, isSignedIn: false });
            return;
          }
          const isRealSignIn = event === 'INITIAL_SESSION' || event === 'SIGNED_IN';
          if (!isRealSignIn) {
            // TOKEN_REFRESHED, USER_UPDATED, etc. — keep current user state (profile pic, name) intact
            return;
          }
          const migrationResult = await migrateGuestData(authUser.id);
          if (migrationResult.failed > 0) {
            console.warn(`Migration: ${migrationResult.migrated} migrated, ${migrationResult.failed} failed`);
          }
          let profile = await getUserProfile(authUser.id);
          if (!profile) {
            const displayName =
              (authUser.user_metadata?.display_name as string) ??
              (authUser.user_metadata?.full_name as string) ??
              authUser.email?.split('@')[0] ??
              'Angler';
            const username =
              (authUser.user_metadata?.username as string) ??
              `user_${authUser.id.replace(/-/g, '').slice(0, 12)}`;
            profile = await ensureProfileForUser(authUser.id, displayName, undefined, username);
          }
          setState({
            user: profile
              ? {
                  id: authUser.id,
                  email: authUser.email,
                  displayName: profile.name ?? profile.display_name,
                  username: profile.username,
                  avatarUrl: profile.avatar_url,
                  bannerUrl: profile.banner_url,
                  subscriptionPlan: (profile.subscription_plan as 'free' | 'pro') ?? 'free',
                  proVerified: isProFromProfile(profile),
                  city: profile.city,
                  state: profile.state,
                  location: profile.location,
                  bio: profile.bio,
                  isModerator: (profile as { is_moderator?: boolean }).is_moderator === true,
                }
              : null,
            isLoading: false,
            isSignedIn: !!profile,
          });
        });
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError(err instanceof Error ? err : new Error('Auth error'));
        setState({
          user: null,
          isLoading: false,
          isSignedIn: false,
        });
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe.data?.subscription?.unsubscribe();
      }
    };
  }, [migrateGuestData]);

  const handleSignOut = async () => {
    try {
      await clearUserCache(state.user?.id);
      await signOut();
      setState({
        user: null,
        isLoading: false,
        isSignedIn: false,
      });
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Sign out failed');
      setError(error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const profile = await getUserProfile(user.id);
    if (profile) {
      // Append a timestamp to bust React Native's Image cache for avatar/banner.
      // The path is always the same (e.g. userId/avatars/main.jpg), so without this
      // the old image would keep showing after an upload.
      const bust = `?t=${Date.now()}`;
      const avatarUrl = profile.avatar_url
        ? profile.avatar_url.replace(/\?t=\d+$/, '') + bust
        : undefined;
      const bannerUrl = profile.banner_url
        ? profile.banner_url.replace(/\?t=\d+$/, '') + bust
        : undefined;

      setState((prev) => ({
        ...prev,
        user: {
          id: user.id,
          email: user.email,
          displayName: profile.name ?? profile.display_name,
          username: profile.username,
          avatarUrl,
          bannerUrl,
          subscriptionPlan: (profile.subscription_plan as 'free' | 'pro') ?? 'free',
          proVerified: isProFromProfile(profile),
          city: profile.city,
          state: profile.state,
          location: profile.location,
          bio: profile.bio,
          isModerator: (profile as { is_moderator?: boolean }).is_moderator === true,
        },
      }));
    }
  };

  return {
    user: state.user,
    isLoading: state.isLoading,
    isSignedIn: state.isSignedIn,
    isGuest: !state.isSignedIn,
    guestId,
    error,
    signOut: handleSignOut,
    refreshProfile,
    migrateGuestData,
    clearUserCache,
  };
}
