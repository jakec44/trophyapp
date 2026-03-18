/**
 * RarityBadge — premium badge with rarity tiers (COMMON, RARE, EPIC, MYTHIC).
 * Higher rarities get glow and subtle animations.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { BadgeRarity } from '@/src/types/badgeRarity';
import { RARITY_PALETTE } from '@/src/types/badgeRarity';

interface RarityBadgeProps {
  rarity: BadgeRarity;
  icon?: string;
  size?: number;
  showLabel?: boolean;
  label?: string;
  /** When true, apply pulse/glow animation for EPIC/MYTHIC */
  animated?: boolean;
  /** When true, tone down glow for small sizes (feed/leaderboard) */
  compact?: boolean;
}

export function RarityBadge({
  rarity,
  icon = '🎖️',
  size = 36,
  showLabel = false,
  label,
  animated = true,
  compact = false,
}: RarityBadgeProps) {
  const palette = RARITY_PALETTE[rarity];
  const glowAnim = useRef(new Animated.Value(0.7)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowSize = compact ? size + 4 : size + 12;
  const glowOpacity = compact ? (rarity === 'RARE' ? 0.5 : 0.6) : (rarity === 'RARE' ? 0.8 : 1);

  useEffect(() => {
    if (!animated || (rarity !== 'EPIC' && rarity !== 'MYTHIC')) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.08,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowAnim, {
            toValue: 0.7,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, rarity]);

  const isMythic = rarity === 'MYTHIC';
  const hasGlow = rarity === 'RARE' || rarity === 'EPIC' || rarity === 'MYTHIC';
  const useScaleAnim = animated && (rarity === 'EPIC' || rarity === 'MYTHIC');
  const flameSize = compact ? size + 8 : size + 16;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          width: size + (hasGlow ? (compact ? 4 : 12) : 0),
          height: size + (hasGlow ? (compact ? 4 : 12) : 0),
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Outer glow — RARE, EPIC, MYTHIC — subtle when compact */}
      {hasGlow && (
        <Animated.View
          style={[
            styles.glowRing,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              borderWidth: compact ? 1 : 2,
              borderColor: palette.border,
              backgroundColor: palette.glow,
              opacity: rarity === 'RARE' ? glowOpacity : glowAnim,
            },
          ]}
        />
      )}

      {/* Mythic flame accents — prestige glow ring (skip when compact) */}
      {isMythic && !compact && (
        <View style={[styles.flameRing, { width: flameSize, height: flameSize }]} pointerEvents="none">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const r = size / 2 + 4;
            const x = size / 2 + 8 + Math.cos(rad) * r - 2.5;
            const y = size / 2 + 8 + Math.sin(rad) * r - 2.5;
            return (
              <View
                key={i}
                style={[
                  styles.flameDot,
                  {
                    position: 'absolute',
                    left: x,
                    top: y,
                    backgroundColor: palette.flame,
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                  },
                ]}
              />
            );
          })}
        </View>
      )}

      {/* Main badge circle */}
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: rarity === 'COMMON' ? 1 : 2,
            borderColor: palette.border,
            backgroundColor: palette.primary,
          },
        ]}
      >
        <Text style={[styles.icon, { fontSize: size * 0.5 }]}>{icon}</Text>
        {/* Inner shine */}
        <View
          style={[
            styles.shine,
            {
              width: size * 0.5,
              height: size * 0.25,
              borderRadius: size * 0.125,
              backgroundColor: palette.shine,
            },
          ]}
        />
      </View>

      {showLabel && (
        <Text style={[styles.rarityLabel, { color: palette.primary }]}>
          {label ?? palette.label}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
  },
  flameRing: {
    position: 'absolute',
  },
  flameDot: {
    opacity: 0.95,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    zIndex: 1,
  },
  shine: {
    position: 'absolute',
    top: 2,
    left: '50%',
    marginLeft: -0,
    transform: [{ translateX: -25 }],
    opacity: 0.9,
  },
  rarityLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
