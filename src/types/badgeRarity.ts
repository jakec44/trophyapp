/**
 * Badge Rarity System — COMMON, RARE, EPIC, MYTHIC.
 * Used for species mastery and collectible badges.
 */

export type BadgeRarity = 'COMMON' | 'RARE' | 'EPIC' | 'MYTHIC';

export const RARITY_PALETTE: Record<
  BadgeRarity,
  {
    primary: string;
    glow: string;
    border: string;
    label: string;
    /** Inner shine color for glow effect */
    shine: string;
    /** Flame/particle accent (MYTHIC) */
    flame: string;
  }
> = {
  COMMON: {
    primary: '#9ca3af',
    glow: 'rgba(156,163,175,0.15)',
    border: 'rgba(156,163,175,0.5)',
    label: 'COMMON',
    shine: 'rgba(255,255,255,0.08)',
    flame: '#9ca3af',
  },
  RARE: {
    primary: '#3b82f6',
    glow: 'rgba(59,130,246,0.45)',
    border: 'rgba(59,130,246,0.75)',
    label: 'RARE',
    shine: 'rgba(147,197,253,0.4)',
    flame: '#60a5fa',
  },
  EPIC: {
    primary: '#a855f7',
    glow: 'rgba(168,85,247,0.55)',
    border: 'rgba(168,85,247,0.8)',
    label: 'EPIC',
    shine: 'rgba(216,180,254,0.5)',
    flame: '#c084fc',
  },
  MYTHIC: {
    primary: '#f59e0b',
    glow: 'rgba(245,158,11,0.7)',
    border: 'rgba(251,191,36,0.9)',
    label: 'MYTHIC',
    shine: 'rgba(254,243,199,0.7)',
    flame: '#fbbf24',
  },
};
