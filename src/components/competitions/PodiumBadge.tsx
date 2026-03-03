/**
 * PodiumBadge — premium trophy badge for #1 / #2 / #3.
 * The whole rectangular badge pulses subtly — no circular glow effects.
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type PodiumPlace = 1 | 2 | 3;

interface PodiumBadgeProps {
  place: PodiumPlace;
}

const RANK_CONFIG = {
  1: {
    label:      '1st',
    trophyColor:'#FFD700',
    textColor:  '#FFD700',
    bgColor:    'rgba(28, 18, 0, 0.92)',
    borderColor:'rgba(255, 215, 0, 0.65)',
    trophySize: 16,
  },
  2: {
    label:      '2nd',
    trophyColor:'#C8D8E8',
    textColor:  '#C8D8E8',
    bgColor:    'rgba(8, 16, 28, 0.92)',
    borderColor:'rgba(180, 210, 240, 0.55)',
    trophySize: 15,
  },
  3: {
    label:      '3rd',
    trophyColor:'#E8924A',
    textColor:  '#E8924A',
    bgColor:    'rgba(22, 8, 0, 0.92)',
    borderColor:'rgba(220, 130, 60, 0.55)',
    trophySize: 15,
  },
} as const;

export function PodiumBadge({ place }: PodiumBadgeProps) {
  const cfg = RANK_CONFIG[place];
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.delay(1400),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: cfg.bgColor,
          borderColor: cfg.borderColor,
          transform: [{ scale: pulse }],
        },
        Platform.select({
          ios: {
            shadowColor: cfg.trophyColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 4,
          },
          android: { elevation: place === 1 ? 5 : 3 },
        }),
      ]}
    >
      <Ionicons name="trophy" size={cfg.trophySize} color={cfg.trophyColor} />
      <Text style={[styles.label, { color: cfg.textColor }]}>
        {cfg.label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
    minWidth: 52,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: 'Orbitron_700Bold',
  },
});
