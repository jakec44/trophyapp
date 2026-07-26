import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomTabBar } from '@/src/components/CustomTabBar';

/** App Store tabs: Compete · Home · Log · Logbook · Profile */
export const unstable_settings = {
  initialRouteName: 'tournaments',
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        initialRouteName="tournaments"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: { display: 'none' }, // Hide default, we use CustomTabBar
        }}
      >
        {/* Compete first — matches App Store tab order / initialRouteName */}
        <Tabs.Screen name="tournaments" options={{ title: 'Compete' }} />
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="log" options={{ title: 'Log' }} />
        <Tabs.Screen name="logbook" options={{ title: 'Logbook' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="leaderboard" options={{ title: 'Trophies', href: null }} />
        <Tabs.Screen name="rankings" options={{ title: 'Rankings', href: null }} />
        <Tabs.Screen name="friends" options={{ href: null }} />
        <Tabs.Screen name="messages" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="trophy-room" options={{ href: null }} />
        <Tabs.Screen name="profile-edit" options={{ href: null }} />
        <Tabs.Screen name="passport" options={{ href: null }} />
        <Tabs.Screen name="badges" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
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
