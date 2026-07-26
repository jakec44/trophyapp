import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import { useTournamentWinCheckContext } from '@/src/context/TournamentWinCheckContext';

/** App Store tab order: Compete · Home · Log · Logbook · Profile */
const TAB_CONFIG = [
  {
    name: 'Compete',
    route: '/(tabs)/tournaments',
    icon: 'trophy-outline' as const,
    iconActive: 'trophy' as const,
  },
  {
    name: 'Home',
    route: '/(tabs)/index',
    icon: 'home-outline' as const,
    iconActive: 'home' as const,
  },
  {
    name: 'Log',
    route: '/(tabs)/log',
    icon: 'add-circle' as const,
    iconActive: 'add-circle' as const,
    isCenter: true,
  },
  {
    name: 'Logbook',
    route: '/(tabs)/logbook',
    icon: 'book-outline' as const,
    iconActive: 'book' as const,
  },
  {
    name: 'Profile',
    route: '/(tabs)/profile',
    icon: 'person-outline' as const,
    iconActive: 'person' as const,
  },
] as const;

function isRouteActive(pathname: string, route: string): boolean {
  if (route.includes('tournaments')) return pathname.includes('tournaments');
  if (route.includes('index') || route === '/(tabs)/index') {
    return (
      pathname === '/' ||
      pathname === '/index' ||
      pathname.endsWith('/(tabs)') ||
      pathname.endsWith('/(tabs)/') ||
      pathname.includes('/index')
    );
  }
  if (route.includes('logbook')) return pathname.includes('logbook');
  if (route.endsWith('/log') || route.includes('(tabs)/log')) {
    return pathname.includes('/log') && !pathname.includes('logbook');
  }
  if (route.includes('profile')) return pathname.includes('profile');
  return false;
}

function measureInWindow(ref: React.RefObject<View>): Promise<{ x: number; y: number; width: number; height: number }> {
  return new Promise((resolve) => {
    ref.current?.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

export function CustomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthContext();
  const winContext = useTournamentWinCheckContext();
  const profileTabRef = useRef<View>(null);
  const trophyTabRef = useRef<View>(null);

  useEffect(() => {
    if (!winContext) return;
    winContext.registerProfileIcon(() => measureInWindow(profileTabRef));
    winContext.registerTrophyIcon(() => measureInWindow(trophyTabRef));
  }, [winContext]);

  return (
    <View style={styles.container}>
      {TAB_CONFIG.map((tab) => {
        const isActive = isRouteActive(pathname, tab.route);
        const isCenter = 'isCenter' in tab && tab.isCenter;
        const isProfile = tab.name === 'Profile';
        const isTrophy = tab.name === 'Compete';

        const handlePress = () => {
          if (tab.route === '/(tabs)/log' && isCenter) {
            if (!user?.id) router.replace('/(tabs)/profile');
            else router.push('/camera');
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
                <Ionicons name={tab.icon} size={32} color="#FFF" />
              </LinearGradient>
              <Text style={[styles.label, styles.centerLabel, isActive && styles.labelActive]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <View
            key={tab.name}
            ref={isProfile ? profileTabRef : isTrophy ? trophyTabRef : undefined}
            style={styles.tab}
            collapsable={false}
          >
            <TouchableOpacity style={styles.tabTouchable} onPress={handlePress} activeOpacity={0.7}>
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={24}
                color={isActive ? colors.teal : 'rgba(214,238,248,0.35)'}
              />
              <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          </View>
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
  tabTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
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
      ios: {
        shadowColor: colors.teal,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
      },
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
