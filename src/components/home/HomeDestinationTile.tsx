import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
/** ~30% of the viewport so two tiles fill a phone screen with scroll room below. */
export const HOME_TILE_HEIGHT = Math.round(SCREEN_HEIGHT * 0.3);

type HomeDestinationTileProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  onPress: () => void;
  /** Stagger entrance slightly when multiple tiles mount. */
  delayMs?: number;
};

export function HomeDestinationTile({
  title,
  subtitle,
  icon,
  accent,
  onPress,
  delayMs = 0,
}: HomeDestinationTileProps) {
  const glow = useRef(new Animated.Value(0.35)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1600, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.35, duration: 1600, useNativeDriver: false }),
      ])
    );
    const entrance = Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      delay: delayMs,
      useNativeDriver: true,
    });
    pulse.start();
    entrance.start();
    return () => {
      pulse.stop();
    };
  }, [glow, enter, delayMs]);

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [`${accent}55`, accent],
  });
  const shadowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.glowFrame,
          {
            borderColor,
            shadowColor: accent,
            shadowOpacity,
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.touch}>
          <LinearGradient
            colors={['#071e30', '#041828', '#020b14']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.inner}
          >
            <View style={[styles.iconOrb, { backgroundColor: `${accent}22`, borderColor: `${accent}66` }]}>
              <Ionicons name={icon} size={34} color={accent} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <View style={styles.ctaRow}>
              <Text style={[styles.cta, { color: accent }]}>Open</Text>
              <Ionicons name="chevron-forward" size={18} color={accent} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  glowFrame: {
    borderRadius: 22,
    borderWidth: 2,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 18,
      },
      android: { elevation: 10 },
    }),
  },
  touch: {
    minHeight: HOME_TILE_HEIGHT,
  },
  inner: {
    minHeight: HOME_TILE_HEIGHT,
    paddingHorizontal: 24,
    paddingVertical: 28,
    justifyContent: 'center',
  },
  iconOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 28,
    letterSpacing: 1.5,
    color: colors.lightText,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Sora_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: colors.lightSubtext,
    maxWidth: '92%',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 20,
  },
  cta: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
    letterSpacing: 0.4,
  },
});
