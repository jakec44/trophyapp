/**
 * Shared style constants for Competition + Profile screens.
 * Extract here for easy tweaking and consistency.
 */
import { Platform } from 'react-native';

// ── Entry image (fish as hero) — sized to prevent overflow on 320px width ──
export const ENTRY_IMAGE_WIDTH = 60;
export const ENTRY_IMAGE_HEIGHT = 90;
export const ENTRY_IMAGE_RADIUS = 18;
export const AVATAR_SIZE_COMPETITION = 32; // Smaller than fish, fits row

// ── Card / surface ──
export const CARD_RADIUS = 12;
export const CARD_RADIUS_LG = 14;
/** Minimum tap target per iOS HIG */
export const MIN_TAP_TARGET = 44;

// ── Shadow / elevation (consistent across screens) ──
export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  android: { elevation: 3 },
});

export const cardShadowLight = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

// ── Spacing rhythm ──
export const SPACING_XS = 4;
export const SPACING_SM = 8;
export const SPACING_MD = 12;
export const SPACING_LG = 16;
export const SPACING_XL = 20;

// ── Row spacing (leaderboard) ──
export const ROW_PADDING_V = 12;
export const ROW_GAP = 8;

// ── Leaderboard layout (prevent overflow) ──
export const RANK_COL_WIDTH = 56;
export const VOTE_BUTTONS_MIN_WIDTH = 88;

// ── Compact mode (2nd/3rd podium tiles, horizontal layout) ──
export const ENTRY_IMAGE_WIDTH_COMPACT = 44;
export const ENTRY_IMAGE_HEIGHT_COMPACT = 66;
export const AVATAR_SIZE_COMPACT = 24;

// ── Hero mode — vertical aspect, compact ──
export const ENTRY_IMAGE_WIDTH_HERO = 120;
export const ENTRY_IMAGE_HEIGHT_HERO = 165;
export const AVATAR_SIZE_HERO = 36;

// ── Micro mode (entries 4+ — 6 per screen) ──
export const ENTRY_IMAGE_WIDTH_MICRO = 36;
export const ENTRY_IMAGE_HEIGHT_MICRO = 52;
export const AVATAR_SIZE_MICRO = 20;
