'use client';

import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthContext } from '@/src/context/AuthContext';

/**
 * Redirects based on auth state:
 * - First-time walkthrough: no auto-redirect; unauthenticated users can use (tabs) until "Continue Fishing" after first catch.
 * - isSignedIn && in (auth) -> go to (tabs) (no separate onboarding screens).
 */
export function AuthRedirect() {
  const { isSignedIn, isLoading } = useAuthContext();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isSignedIn && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn, isLoading, segments, router]);

  return null;
}
