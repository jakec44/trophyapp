/**
 * Sleek ribbon badges for tournament cards: LIVE, ENDING SOON, PODIUM.
 * Compact pill style with subtle depth and icons.
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';

type RibbonVariant = 'live' | 'ending-soon' | 'podium' | 'ended';

interface CompetitionRibbonProps {
  variant: RibbonVariant;
  /** For ending-soon: countdown text. For podium: "gold" | "silver" | "bronze" */
  label?: string;
  /** Optional custom text override */
  text?: string;
}

const RIBBON_STYLES: Record<
  RibbonVariant,
  { bg: string; text: string; border: string; icon?: keyof typeof Ionicons.glyphMap }
> = {
  live: {
    bg: 'rgba(0, 240, 160, 0.12)',
    text: colors.green,
    border: 'rgba(0, 240, 160, 0.35)',
  },
  'ending-soon': {
    bg: 'rgba(0, 229, 200, 0.12)',
    text: colors.teal,
    border: 'rgba(0, 229, 200, 0.35)',
    icon: 'time-outline',
  },
  podium: {
    bg: 'rgba(212, 175, 55, 0.12)',
    text: colors.gold,
    border: 'rgba(212, 175, 55, 0.4)',
    icon: 'trophy-outline',
  },
  ended: {
    bg: 'rgba(107, 114, 128, 0.15)',
    text: colors.textFaint,
    border: 'rgba(107, 114, 128, 0.3)',
    icon: 'checkmark-done-outline',
  },
};

export function CompetitionRibbon({
  variant,
  label,
  text,
}: CompetitionRibbonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const s = RIBBON_STYLES[variant];

  useEffect(() => {
    if (variant !== 'live') return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.92,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [variant, pulseAnim]);

  const displayText =
    text ??
    (variant === 'live'
      ? 'LIVE'
      : variant === 'ending-soon'
        ? label ?? 'Soon'
        : variant === 'podium'
          ? label ?? 'Podium'
          : variant === 'ended'
            ? 'ENDED'
            : '');

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: s.bg,
          borderColor: s.border,
        },
      ]}
    >
      {variant === 'live' && (
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: s.text, transform: [{ scale: pulseAnim }] },
          ]}
        />
      )}
      {variant === 'ending-soon' && s.icon && (
        <Ionicons
          name={s.icon}
          size={10}
          color={s.text}
          style={styles.icon}
        />
      )}
      {variant === 'podium' && s.icon && (
        <Ionicons
          name={s.icon}
          size={10}
          color={s.text}
          style={styles.icon}
        />
      )}
      <Text style={[styles.label, { color: s.text }]} numberOfLines={1}>
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  icon: {
    marginRight: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
