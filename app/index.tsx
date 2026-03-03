/**
 * Root index: redirects to tabs (signed in) or auth (signed out).
 * Prevents showing auth screen when user is already signed in.
 */

import { Redirect } from 'expo-router';
import { useAuthContext } from '@/src/context/AuthContext';

export default function Index() {
  const { isSignedIn } = useAuthContext();
  return isSignedIn ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/sign-in" />;
}
