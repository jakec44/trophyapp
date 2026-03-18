/**
 * Species badge image — Redfish Hunter/Master/Elite/Legend, Snook Elite, etc.
 */

import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { getSpeciesBadgeImageSource } from '@/src/constants/speciesBadgeImages';
import type { SpeciesBadgeTier } from '@/src/constants/speciesBadgeImages';

interface Props {
  /** Either pass badgeKey (preferred) or tier for redfish. */
  badgeKey?: string;
  tier?: SpeciesBadgeTier;
  size: number;
  /** Scale up the badge artwork (PNG has padding, so 1.5 makes it match circular badges) */
  scale?: number;
}

/** Badges that render larger — scale down to match others */
const SCALE_DOWN_BADGES: Record<string, number> = { 'species-snook-legend': 0.82 };

export function SpeciesBadgeImage({ badgeKey, tier, size, scale = 1 }: Props) {
  const key = badgeKey ?? (tier ? `species-red-drum-${tier}` : null);
  const source = key ? getSpeciesBadgeImageSource(key) : null;

  if (!source) return null;

  const effectiveScale = (SCALE_DOWN_BADGES[key ?? ''] ?? 1) * scale;
  const imgStyle = [
    styles.imgFull,
    effectiveScale !== 1 && { transform: [{ scale: effectiveScale }] },
  ];

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image source={source as ImageSourcePropType} style={imgStyle} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  imgFull: {
    width: '100%',
    height: '100%',
  },
});
