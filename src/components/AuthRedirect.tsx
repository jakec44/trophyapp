'use client';

import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthContext } from '@/src/context/AuthContext';

/**
 * Redirects based on auth state:
 * - Guests can use (tabs); Superwall will own paywall/onboarding.
 * - isSignedIn && in (auth) -> go to Trophy Board.
 */
export function AuthRedirect() {
  const { isSignedIn, isLoading } = useAuthContext();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isSignedIn && inAuthGroup) {
      router.replace('/(tabs)/leaderboard');
    }
  }, [isSignedIn, isLoading, segments, router]);

  return null;
}
