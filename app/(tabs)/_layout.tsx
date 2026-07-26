import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomTabBar } from '@/src/components/CustomTabBar';

/** First visible tab — avoid /(tabs) resolving to hidden Home (index). */
export const unstable_settings = {
  initialRouteName: 'leaderboard',
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: { display: 'none' }, // Hide default, we use CustomTabBar
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', href: null }} />
        <Tabs.Screen name="tournaments" options={{ title: 'Compete', href: null }} />
        <Tabs.Screen name="leaderboard" options={{ title: 'Trophy Board' }} />
        <Tabs.Screen name="rankings" options={{ title: 'Rankings' }} />
        <Tabs.Screen name="log" options={{ title: 'Log' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="friends" options={{ href: null }} />
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
        ]}
      >
        <CustomTabBar />
      </View>
    </View>
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
