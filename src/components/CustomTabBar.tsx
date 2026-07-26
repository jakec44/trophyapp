import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
import { useTournamentWinCheckContext } from '@/src/context/TournamentWinCheckContext';

const TAB_CONFIG = [
  {
    name: 'Home',
    route: '/(tabs)/index',
    icon: 'home-outline' as const,
    iconActive: 'home' as const,
  },
  {
    name: 'Rankings',
    route: '/(tabs)/rankings',
    icon: 'ribbon-outline' as const,
    iconActive: 'ribbon' as const,
    emoji: '🥇',
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
  if (route.includes('index')) {
    return (
      pathname === '/' ||
      pathname === '/index' ||
      pathname.endsWith('/(tabs)') ||
      pathname.endsWith('/(tabs)/') ||
      pathname.includes('/index')
    );
  }
  if (route.includes('rankings')) return pathname.includes('rankings');
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
  const winContext = useTournamentWinCheckContext();
  const profileTabRef = useRef<View>(null);
  const homeTabRef = useRef<View>(null);

  useEffect(() => {
    if (!winContext) return;
    winContext.registerProfileIcon(() => measureInWindow(profileTabRef));
    // Win fly-to still uses the "trophy" slot — Home is the primary hub now.
    winContext.registerTrophyIcon(() => measureInWindow(homeTabRef));
  }, [winContext]);

  return (
    <View style={styles.container}>
      {TAB_CONFIG.map((tab) => {
        const isActive = isRouteActive(pathname, tab.route);
        const isCenter = 'isCenter' in tab && tab.isCenter;
        const isProfile = tab.name === 'Profile';
        const isHome = tab.name === 'Home';
        const useEmoji = 'emoji' in tab && !!tab.emoji;

        const handlePress = () => {
          if (tab.route === '/(tabs)/log' && isCenter) {
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
            ref={isProfile ? profileTabRef : isHome ? homeTabRef : undefined}
            style={styles.tab}
            collapsable={false}
          >
            <TouchableOpacity style={styles.tabTouchable} onPress={handlePress} activeOpacity={0.7}>
              {useEmoji ? (
                <Text style={[styles.emojiIcon, isActive && styles.emojiIconActive]}>
                  {(tab as { emoji?: string }).emoji}
                </Text>
              ) : (
                <Ionicons
                  name={(isActive ? tab.iconActive : tab.icon) as any}
                  size={22}
                  color={isActive ? colors.teal : 'rgba(214,238,248,0.35)'}
                />
              )}
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
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 10,
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
    minWidth: 0,
    paddingVertical: 4,
  },
  tabTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  centerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    minWidth: 0,
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
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: 'rgba(214,238,248,0.35)',
    marginTop: 4,
    textAlign: 'center',
  },
  centerLabel: {
    marginTop: 6,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  labelActive: {
    color: colors.teal,
    opacity: 1,
  },
  emojiIcon: {
    fontSize: 20,
    lineHeight: 24,
    opacity: 0.45,
  },
  emojiIconActive: {
    opacity: 1,
  },
});
