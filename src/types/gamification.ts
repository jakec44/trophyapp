/**
 * Gamification types: XP, levels, passport
 */

export const XP_PER_CATCH = 15; // base (common) — rarity multiplies this
export const XP_PER_TOURNAMENT_ENTRY = 50;
export const XP_PER_PERSONAL_RECORD = 200;
/** XP awarded for placing in a tournament (1st–5th) */
export const XP_TOURNAMENT_WIN: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 500,
  2: 300,
  3: 150,
  4: 100,
  5: 50,
};

/** AR (Angler Rating) awarded per place — server-side; client reference only */
export const AR_TOURNAMENT_PLACE: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 100,
  2: 60,
  3: 30,
  4: 20,
  5: 10,
};

/**
 * Level roadmap — 15 levels.
 * Cumulative XP required to reach each level:
 * L1: 0  L2: 100  L3: 250  L4: 450  L5: 700  L6: 1,000  L7: 1,350  L8: 1,750  L9: 2,200
 * L10: 2,700  L11: 3,250  L12: 3,850  L13: 4,500  L14: 5,200  L15: 6,000
 */
export const LEVEL_ROADMAP: {
  level: number;
  title: string;
  xpRequired: number;
  icon: string;
}[] = [
  { level: 1,  title: 'Bait Boy',            xpRequired: 0,     icon: '🪱' },
  { level: 2,  title: 'Shoreman',            xpRequired: 100,   icon: '🏖️' },
  { level: 3,  title: 'Caster',              xpRequired: 250,   icon: '🎣' },
  { level: 4,  title: 'Line Wetter',         xpRequired: 450,   icon: '💧' },
  { level: 5,  title: 'Angler',              xpRequired: 700,   icon: '🐟' },
  { level: 6,  title: 'Rod Bender',          xpRequired: 1000,  icon: '🌊' },
  { level: 7,  title: 'Keeper',              xpRequired: 1350,  icon: '🏆' },
  { level: 8,  title: 'Deckhand',            xpRequired: 1750,  icon: '⚓' },
  { level: 9,  title: 'Dockmaster',          xpRequired: 2200,  icon: '🚢' },
  { level: 10, title: 'Reel Hunter',         xpRequired: 2700,  icon: '🎯' },
  { level: 11, title: 'Trophy Chaser',       xpRequired: 3250,  icon: '🥇' },
  { level: 12, title: 'Tidewalker',          xpRequired: 3850,  icon: '🦀' },
  { level: 13, title: 'Saltblood',           xpRequired: 4500,  icon: '🔱' },
  { level: 14, title: 'Grand Slam',          xpRequired: 5200,  icon: '⚡' },
  { level: 15, title: 'Legend of the Water', xpRequired: 6000,  icon: '💎' },
];

/** Features/badges/titles unlocked at each level — every level has a TITLE entry */
export const LEVEL_UNLOCKS: Record<number, { label: string; type: 'FEATURE' | 'BADGE' | 'TITLE' }[]> = {
  2:  [{ label: 'Shoreman',            type: 'TITLE'   }, { label: 'Species Log',       type: 'FEATURE' }],
  3:  [{ label: 'Caster',              type: 'TITLE'   }, { label: 'Caster Badge',      type: 'BADGE'   }],
  4:  [{ label: 'Line Wetter',         type: 'TITLE'   }, { label: 'Logbook Filters',   type: 'FEATURE' }],
  5:  [{ label: 'Angler',              type: 'TITLE'   }, { label: 'Tournaments',       type: 'FEATURE' }, { label: 'Veteran Badge',     type: 'BADGE'   }],
  6:  [{ label: 'Rod Bender',          type: 'TITLE'   }, { label: 'Stories',           type: 'FEATURE' }],
  7:  [{ label: 'Keeper',              type: 'TITLE'   }, { label: 'Keeper Badge',      type: 'BADGE'   }],
  8:  [{ label: 'Deckhand',            type: 'TITLE'   }, { label: 'Crew Leaderboard',  type: 'FEATURE' }],
  9:  [{ label: 'Dockmaster',          type: 'TITLE'   }, { label: 'Dockmaster Badge',  type: 'BADGE'   }],
  10: [{ label: 'Reel Hunter',         type: 'TITLE'   }, { label: 'Elite Mode',        type: 'FEATURE' }],
  11: [{ label: 'Trophy Chaser',       type: 'TITLE'   }, { label: 'Trophy Badge',      type: 'BADGE'   }],
  12: [{ label: 'Tidewalker',          type: 'TITLE'   }, { label: 'Tidewalker Badge',  type: 'BADGE'   }],
  13: [{ label: 'Saltblood',           type: 'TITLE'   }, { label: 'Saltblood Badge',   type: 'BADGE'   }],
  14: [{ label: 'Grand Slam',          type: 'TITLE'   }, { label: 'Grand Slam Mode',   type: 'FEATURE' }],
  15: [{ label: 'Legend of the Water', type: 'TITLE'   }, { label: 'Legend Status',     type: 'BADGE'   }],
};

/** Max level in roadmap */
export const MAX_LEVEL = 15;

/** Max prestige level (earned by resetting from level 15 to 1) */
export const MAX_PRESTIGE = 3;

/** XP needed to complete each level (not cumulative). Index 0 = level 1, etc. Varies per level. */
export const XP_NEEDED_FOR_LEVEL: number[] = LEVEL_ROADMAP.map((r, i) => {
  if (r.level === MAX_LEVEL) return 0; // max level has no "next"
  const next = LEVEL_ROADMAP[i + 1];
  return next ? next.xpRequired - r.xpRequired : 0;
});

/** Icon for a level badge key (e.g. "level-5-veteran-badge") so other users' profiles show the same icon as the owner. */
export function getLevelBadgeIcon(badgeKey: string): string {
  const match = badgeKey.match(/^level-(\d+)-/);
  if (!match) return '🎖️';
  const level = parseInt(match[1], 10);
  if (level < 1 || level > MAX_LEVEL) return '🎖️';
  return LEVEL_ROADMAP[level - 1]?.icon ?? '🎖️';
}

/** Derived for getLevelFromXp: ceiling XP to complete each level (cumulative). */
export const LEVEL_BOUNDS: { maxXp: number; title: string; icon: string; xpForThisLevel: number }[] = LEVEL_ROADMAP.map((r, i) => ({
  maxXp: r.level === MAX_LEVEL ? Infinity : (LEVEL_ROADMAP[i + 1]?.xpRequired ?? Infinity),
  title: r.title,
  icon:  r.icon,
  xpForThisLevel: XP_NEEDED_FOR_LEVEL[i] ?? 0,
}));

export function getLevelFromXp(xp: number): {
  level: number;
  title: string;
  icon: string;
  xpInLevel: number;
  xpForNext: number;
} {
  let prev = 0;
  for (let i = 0; i < LEVEL_BOUNDS.length; i++) {
    const bound = LEVEL_BOUNDS[i].maxXp;
    const ceiling = bound === Infinity ? 999999 : bound;
    if (xp < ceiling) {
      const xpInLevel = xp - prev;
      const xpForNext = LEVEL_BOUNDS[i].xpForThisLevel; // use explicit per-level XP (varies: 100, 150, 150, ...)
      return { level: i + 1, title: LEVEL_BOUNDS[i].title, icon: LEVEL_BOUNDS[i].icon, xpInLevel, xpForNext };
    }
    prev = ceiling;
  }
  const last = LEVEL_BOUNDS[LEVEL_BOUNDS.length - 1];
  return { level: LEVEL_BOUNDS.length, title: last.title, icon: last.icon, xpInLevel: 0, xpForNext: 0 };
}

export interface GamificationState {
  xp: number;
  totalCatchesLogged: number;
  totalTournamentsEntered: number;
  personalRecordsBroken: number;
}

export type PassportCategory = 'freshwater' | 'saltwater';

export type SpeciesRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_ORDER: SpeciesRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export interface PassportSpecies {
  id: string;
  name: string;
  category: PassportCategory;
  rarity: SpeciesRarity;
}

export interface PassportState {
  caughtSpeciesIds: Set<string>;
  lastNewSpeciesId: string | null;
}
