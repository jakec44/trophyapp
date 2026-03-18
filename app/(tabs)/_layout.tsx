import { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomTabBar } from '@/src/components/CustomTabBar';
import { useAuthContext } from '@/src/context/AuthContext';
import { OnboardingOverlayContext } from '@/src/context/OnboardingOverlayContext';

const ONBOARDING_NEEDS_PROFILE = 'onboarding_needs_profile';
const ONBOARDING_FIRST_CATCH_PENDING = 'onboarding_first_catch_pending';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthContext();
  const [hideTabBar, setHideTabBar] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.getItem(ONBOARDING_NEEDS_PROFILE).then((v) => {
      if (v === '1') {
        AsyncStorage.multiRemove([ONBOARDING_FIRST_CATCH_PENDING]).catch(() => {});
        router.replace('/(tabs)/profile');
      }
    });
  }, [user?.id, router]);

  return (
    <OnboardingOverlayContext.Provider value={{ hideTabBar, setHideTabBar }}>
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: { display: 'none' }, // Hide default, we use CustomTabBar
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="tournaments" options={{ title: 'Compete' }} />
        <Tabs.Screen name="log" options={{ title: 'Log' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="friends" options={{ href: null }} />
        <Tabs.Screen
          name="leaderboard"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="messages"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="settings"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="trophy-room"
          options={{ href: null }}
        />
        <Tabs.Screen name="logbook" options={{ title: 'Logbook' }} />
        <Tabs.Screen
          name="profile-edit"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="passport"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="badges"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="notifications"
          options={{ href: null }}
        />
      </Tabs>
      <View
        style={[
          styles.tabBarWrapper,
          { paddingBottom: insets.bottom || 12 },
          hideTabBar && { opacity: 0, pointerEvents: 'none' as const },
        ]}
      >
        <CustomTabBar />
      </View>
    </View>
    </OnboardingOverlayContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020b14',
  },
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(2,11,20,0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,229,200,0.1)',
  },
});
