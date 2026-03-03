import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts, Orbitron_400Regular, Orbitron_700Bold, Orbitron_900Black } from '@expo-google-fonts/orbitron';
import { Sora_300Light, Sora_400Regular, Sora_500Medium, Sora_600SemiBold } from '@expo-google-fonts/sora';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect } from 'react';
import { GamificationProvider } from '@/src/context/GamificationContext';
import { AuthProvider } from '@/src/context/AuthContext';
import { FriendsProvider } from '@/src/context/FriendsContext';
import { FeedProvider } from '@/src/context/FeedContext';
import { AuthRedirect } from '@/src/components/AuthRedirect';
import { LoadingScreen } from '@/src/components/LoadingScreen';
import { useAuthContext } from '@/src/context/AuthContext';
import { colors } from '@/utils/colors';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuthContext();
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
  });

  const onLayoutRootView = useCallback(() => {
    if (Platform.OS !== 'web' && fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded) return null;

  return (
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
      <Stack.Screen name="camera" />
      <Stack.Screen name="photo-picker" />
      <Stack.Screen name="fish-image-editor" />
      <Stack.Screen name="search" options={{ title: 'Search' }} />
      <Stack.Screen name="user/[userId]" options={{ title: 'Profile' }} />
      <Stack.Screen name="tournament/[id]" options={{ title: 'Tournament' }} />
      <Stack.Screen name="friends/[id]" options={{ title: 'Friend' }} />
      <Stack.Screen name="chat/[userId]" options={{ title: 'Chat' }} />
      <Stack.Screen name="invite" options={{ title: 'Invite' }} />
      <Stack.Screen name="invite-accept" options={{ title: 'Accept Invite' }} />
      <Stack.Screen
        name="paywall"
        options={{ title: 'Paywall' }}
      />
      <Stack.Screen name="coin-shop" options={{ title: 'Coin Shop' }} />
    </Stack>
    </FeedProvider>
    </GamificationProvider>
    </FriendsProvider>
    </AuthGate>
    </AuthProvider>
  );
}
