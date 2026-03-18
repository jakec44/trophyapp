/**
 * Species badge image assets.
 * Redfish Hunter/Master/Elite/Legend each have dedicated single images.
 */

import type { ImageSourcePropType } from 'react-native';

export type SpeciesBadgeTier = 'hunter' | 'master' | 'elite' | 'legend';

/** Dedicated Hunter badge (single image, transparent BG). */
export const REDFISH_HUNTER_IMAGE: ImageSourcePropType = require('../../assets/badges/redfish-hunter.png');

/** Dedicated Master badge (single image, transparent BG). */
export const REDFISH_MASTER_IMAGE: ImageSourcePropType = require('../../assets/badges/redfish-master.png');

/** Dedicated Elite badge (single image). */
export const REDFISH_ELITE_IMAGE: ImageSourcePropType = require('../../assets/badges/redfish-elite.png');

/** Dedicated Legend badge (single image). */
export const REDFISH_LEGEND_IMAGE: ImageSourcePropType = require('../../assets/badges/redfish-legend.png');

/** Snook Master badge. */
export const SNOOK_MASTER_IMAGE: ImageSourcePropType = require('../../assets/badges/snook-master.png');

/** Snook Elite badge. */
export const SNOOK_ELITE_IMAGE: ImageSourcePropType = require('../../assets/badges/snook-elite.png');

/** Snook Legend badge. */
export const SNOOK_LEGEND_IMAGE: ImageSourcePropType = require('../../assets/badges/snook-legend.png');

/** Tarpon Master badge. */
export const TARPON_MASTER_IMAGE: ImageSourcePropType = require('../../assets/badges/tarpon-master.png');

/** Tarpon Elite badge. */
export const TARPON_ELITE_IMAGE: ImageSourcePropType = require('../../assets/badges/tarpon-elite.png');

/** Tarpon Legend badge. */
export const TARPON_LEGEND_IMAGE: ImageSourcePropType = require('../../assets/badges/tarpon-legend.png');

/** Largemouth Bass Hunter badge. */
export const LARGEMOUTH_BASS_HUNTER_IMAGE: ImageSourcePropType = require('../../assets/badges/largemouth-bass-hunter.png');

/** Largemouth Bass Master badge. */
export const LARGEMOUTH_BASS_MASTER_IMAGE: ImageSourcePropType = require('../../assets/badges/largemouth-bass-master.png');

/** Largemouth Bass Elite badge. */
export const LARGEMOUTH_BASS_ELITE_IMAGE: ImageSourcePropType = require('../../assets/badges/largemouth-bass-elite.png');

/** Grand Slam Legend achievement badge. */
export const GRAND_SLAM_LEGEND_IMAGE: ImageSourcePropType = require('../../assets/badges/grand-slam-legend.png');

/** 40 Club achievement badge. */
export const FORTY_CLUB_IMAGE: ImageSourcePropType = require('../../assets/badges/40-club.png');

/** 50 Club achievement badge. */
export const FIFTY_CLUB_IMAGE: ImageSourcePropType = require('../../assets/badges/50-club.png');

/** Trophy Hunter achievement badge. */
export const TROPHY_HUNTER_IMAGE: ImageSourcePropType = require('../../assets/badges/trophy-hunter.png');

/** Champion of the Water achievement badge. */
export const CHAMPION_OF_THE_WATER_IMAGE: ImageSourcePropType = require('../../assets/badges/champion-of-the-water.png');

/** Century Angler achievement badge. */
export const CENTURY_ANGLER_IMAGE: ImageSourcePropType = require('../../assets/badges/century-angler.png');

/** Species Collector achievement badge. */
export const SPECIES_COLLECTOR_IMAGE: ImageSourcePropType = require('../../assets/badges/species-collector.png');

/** Hall of Fame achievement badge. */
export const HALL_OF_FAME_IMAGE: ImageSourcePropType = require('../../assets/badges/hall-of-fame.png');

/** Viral Catch achievement badge. */
export const VIRAL_CATCH_IMAGE: ImageSourcePropType = require('../../assets/badges/viral-catch.png');

/** Crowd Favorite achievement badge. */
export const CROWD_FAVORITE_IMAGE: ImageSourcePropType = require('../../assets/badges/crowd-favorite.png');

/** True if badgeKey is a redfish species mastery badge. */
export function isRedfishSpeciesBadge(badgeKey: string): badgeKey is `species-red-drum-${SpeciesBadgeTier}` {
  return /^species-red-drum-(hunter|master|elite|legend)$/.test(badgeKey);
}

/** Extract tier from redfish badge key. */
export function getRedfishBadgeTier(badgeKey: string): SpeciesBadgeTier | null {
  const m = badgeKey.match(/^species-red-drum-(hunter|master|elite|legend)$/);
  return (m?.[1] as SpeciesBadgeTier) ?? null;
}

/** True if badgeKey has a custom species or achievement badge image. */
export function hasCustomSpeciesBadgeImage(badgeKey: string): boolean {
  return isRedfishSpeciesBadge(badgeKey)
    || /^species-snook-(master|elite|legend)$/.test(badgeKey)
    || /^species-tarpon-(master|elite|legend)$/.test(badgeKey)
    || /^species-largemouth-bass-(hunter|master|elite)$/.test(badgeKey)
    || badgeKey === 'achievement-grand-slam-legend'
    || badgeKey === 'achievement-40-club'
    || badgeKey === 'achievement-50-club'
    || badgeKey === 'achievement-trophy-hunter'
    || badgeKey === 'achievement-champion-of-the-water'
    || badgeKey === 'achievement-century-angler'
    || badgeKey === 'achievement-species-collector'
    || badgeKey === 'achievement-hall-of-fame'
    || badgeKey === 'achievement-viral-catch'
    || badgeKey === 'achievement-crowd-favorite';
}

/** Get custom image source for species badge, or null if fallback (RarityBadge) needed. */
export function getSpeciesBadgeImageSource(badgeKey: string): ImageSourcePropType | null {
  if (isRedfishSpeciesBadge(badgeKey)) {
    const t = getRedfishBadgeTier(badgeKey);
    if (t === 'hunter') return REDFISH_HUNTER_IMAGE;
    if (t === 'master') return REDFISH_MASTER_IMAGE;
    if (t === 'elite') return REDFISH_ELITE_IMAGE;
    if (t === 'legend') return REDFISH_LEGEND_IMAGE;
  }
  if (badgeKey === 'species-snook-master') return SNOOK_MASTER_IMAGE;
  if (badgeKey === 'species-snook-elite') return SNOOK_ELITE_IMAGE;
  if (badgeKey === 'species-snook-legend') return SNOOK_LEGEND_IMAGE;
  if (badgeKey === 'species-tarpon-master') return TARPON_MASTER_IMAGE;
  if (badgeKey === 'species-tarpon-elite') return TARPON_ELITE_IMAGE;
  if (badgeKey === 'species-tarpon-legend') return TARPON_LEGEND_IMAGE;
  if (badgeKey === 'species-largemouth-bass-hunter') return LARGEMOUTH_BASS_HUNTER_IMAGE;
  if (badgeKey === 'species-largemouth-bass-master') return LARGEMOUTH_BASS_MASTER_IMAGE;
  if (badgeKey === 'species-largemouth-bass-elite') return LARGEMOUTH_BASS_ELITE_IMAGE;
  if (badgeKey === 'achievement-grand-slam-legend') return GRAND_SLAM_LEGEND_IMAGE;
  if (badgeKey === 'achievement-40-club') return FORTY_CLUB_IMAGE;
  if (badgeKey === 'achievement-50-club') return FIFTY_CLUB_IMAGE;
  if (badgeKey === 'achievement-trophy-hunter') return TROPHY_HUNTER_IMAGE;
  if (badgeKey === 'achievement-champion-of-the-water') return CHAMPION_OF_THE_WATER_IMAGE;
  if (badgeKey === 'achievement-century-angler') return CENTURY_ANGLER_IMAGE;
  if (badgeKey === 'achievement-species-collector') return SPECIES_COLLECTOR_IMAGE;
  if (badgeKey === 'achievement-hall-of-fame') return HALL_OF_FAME_IMAGE;
  if (badgeKey === 'achievement-viral-catch') return VIRAL_CATCH_IMAGE;
  if (badgeKey === 'achievement-crowd-favorite') return CROWD_FAVORITE_IMAGE;
  return null;
}
