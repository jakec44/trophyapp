import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { useFonts, Orbitron_400Regular, Orbitron_700Bold, Orbitron_900Black } from '@expo-google-fonts/orbitron';
import { Sora_300Light, Sora_400Regular, Sora_500Medium, Sora_600SemiBold } from '@expo-google-fonts/sora';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { BarlowCondensed_400Regular, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useState } from 'react';
import { GamificationProvider } from '@/src/context/GamificationContext';
import { AuthProvider } from '@/src/context/AuthContext';
import { initRevenueCat } from '@/src/lib/revenueCat';
import { FriendsProvider } from '@/src/context/FriendsContext';
import { FeedProvider } from '@/src/context/FeedContext';
import { AuthRedirect } from '@/src/components/AuthRedirect';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { useAuthContext } from '@/src/context/AuthContext';
import { usePushToken } from '@/src/hooks/usePushToken';
import { colors } from '@/utils/colors';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, user } = useAuthContext();
  usePushToken(user?.id ?? null);
  useEffect(() => {
    initRevenueCat(user?.id ?? null).catch(() => {});
  }, [user?.id]);
  if (isLoading) return <LoadingScreen />;
  return (
    <>
      <AuthRedirect />
      {children}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Orbitron_400Regular,
    Orbitron_700Bold,
    Orbitron_900Black,
    Sora_300Light,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    BebasNeue_400Regular,
    BarlowCondensed_400Regular,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });

  const onLayoutRootView = useCallback(() => {
    if (Platform.OS !== 'web' && fontsLoaded) {
      try {
        SplashScreen.hideAsync().catch(() => {});
      } catch (_) {
        // Ignore "No native splash screen registered" (e.g. Expo Go / dev client)
      }
    }
  }, [fontsLoaded]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded) return <LoadingScreen />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AppErrorBoundary>
      <AuthProvider>
      <AuthGate>
      <FriendsProvider>
      <GamificationProvider>
      <FeedProvider>
      <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: false,
        contentStyle: { backgroundColor: colors.lightBackground },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="camera" />
      <Stack.Screen name="photo-picker" />
      <Stack.Screen name="fish-image-editor" />
      <Stack.Screen name="search" options={{ title: 'Search' }} />
      <Stack.Screen name="user/[userId]" options={{ title: 'Profile' }} />
      <Stack.Screen name="tournament/[id]" options={{ title: 'Tournament' }} />
      <Stack.Screen name="friends/[id]" options={{ title: 'Friend' }} />
      <Stack.Screen name="chat/[userId]" options={{ title: 'Chat' }} />
      <Stack.Screen
        name="post/[id]"
        options={{ title: 'Post', presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="invite" options={{ title: 'Invite' }} />
      <Stack.Screen name="invite-accept" options={{ title: 'Accept Invite' }} />
      <Stack.Screen
        name="paywall"
        options={{ title: 'Paywall' }}
      />
      <Stack.Screen
        name="daily-quests"
        options={{ title: 'Daily Quests' }}
      />
      <Stack.Screen
        name="requested-species"
        options={{ title: 'Requested Species' }}
      />
      <Stack.Screen name="wins" options={{ title: 'Tournament Wins' }} />
    </Stack>
    </FeedProvider>
    </GamificationProvider>
    </FriendsProvider>
    </AuthGate>
    </AuthProvider>
    </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}

function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  const [retryKey, setRetryKey] = useState(0);
  return (
    <ErrorBoundary
      retryKey={retryKey}
      onRetry={() => setRetryKey((k) => k + 1)}
    >
      <React.Fragment key={retryKey}>{children}</React.Fragment>
    </ErrorBoundary>
  );
}
