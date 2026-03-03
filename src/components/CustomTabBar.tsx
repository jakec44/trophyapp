import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
const TAB_CONFIG = [
  {
    name: 'Home',
    route: '/(tabs)',
    icon: 'home-outline',
    iconActive: 'home',
  },
  {
    name: 'Compete',
    route: '/(tabs)/tournaments',
    icon: 'trophy-outline',
    iconActive: 'trophy',
  },
  {
    name: 'Log',
    route: '/(tabs)/log',
    icon: 'add-circle',
    iconActive: 'add-circle',
    isCenter: true,
  },
  {
    name: 'Logbook',
    route: '/(tabs)/logbook',
    icon: 'book-outline',
    iconActive: 'book',
  },
  {
    name: 'Profile',
    route: '/(tabs)/profile',
    icon: 'person-outline',
    iconActive: 'person',
  },
] as const;

function isRouteActive(pathname: string, route: string): boolean {
  if (route === '/(tabs)') {
    return !pathname || pathname === '/' || pathname === '/(tabs)' || pathname.endsWith('index');
  }
  if (route.includes('tournaments')) return pathname.includes('tournaments');
  if (route.includes('log')) return pathname.includes('log');
  if (route.includes('logbook')) return pathname.includes('logbook');
  if (route.includes('profile')) return pathname.includes('profile');
  return false;
}

export function CustomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <View style={styles.container}>
      {TAB_CONFIG.map((tab) => {
        const isActive = isRouteActive(pathname, tab.route);
        const isCenter = tab.isCenter ?? false;

        const handlePress = () => {
          if (tab.route === '/(tabs)') {
            router.replace('/(tabs)');
          } else if (tab.route === '/(tabs)/log' && tab.isCenter) {
            router.push('/camera');
          } else {
            router.replace(tab.route as any);
          }
        };

        if (isCenter) {
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.centerBtn}
              onPress={handlePress}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.teal, colors.blue]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.centerBtnInner}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={32}
                  color="#FFF"
                />
              </LinearGradient>
              <Text
                style={[
                  styles.label,
                  styles.centerLabel,
                  isActive && styles.labelActive,
                ]}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={handlePress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={(isActive ? tab.iconActive : tab.icon) as any}
              size={24}
              color={isActive ? colors.teal : 'rgba(214,238,248,0.35)'}
            />
            <Text
              style={[styles.label, isActive && styles.labelActive]}
              numberOfLines={1}
            >
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  centerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
  },
  centerBtnInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#020b14',
    ...Platform.select({
      ios: { shadowColor: colors.teal, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 24 },
      android: { elevation: 8 },
    }),
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(214,238,248,0.35)',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  centerLabel: {
    marginTop: 6,
  },
  labelActive: {
    color: colors.teal,
    opacity: 1,
  },
});
