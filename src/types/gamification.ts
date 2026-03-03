/**
 * Gamification types: XP, levels, passport
 */

export const XP_PER_CATCH = 15; // base (common) — rarity multiplies this
export const XP_PER_TOURNAMENT_ENTRY = 50;
export const XP_PER_PERSONAL_RECORD = 200;
/** XP awarded for placing in a tournament (1st/2nd/3rd) */
export const XP_TOURNAMENT_WIN: Record<1 | 2 | 3, number> = { 1: 500, 2: 300, 3: 150 };

/**
 * Level roadmap — 15 levels.
 * XP to next level per tier:
 * L1→2: 100  L2→3: 150  L3→4: 200  L4→5: 300  L5→6: 400
 * L6→7: 600  L7→8: 800  L8→9: 1000  L9→10: 1200
 * L10→11: 1600  L11→12: 2000
 * L12→13: 2700  L13→14: 3400  L14→15: 4100
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
  { level: 5,  title: 'Angler',              xpRequired: 750,   icon: '🐟' },
  { level: 6,  title: 'Rod Bender',          xpRequired: 1150,  icon: '🌊' },
  { level: 7,  title: 'Keeper',              xpRequired: 1750,  icon: '🏆' },
  { level: 8,  title: 'Deckhand',            xpRequired: 2550,  icon: '⚓' },
  { level: 9,  title: 'Dockmaster',          xpRequired: 3550,  icon: '🚢' },
  { level: 10, title: 'Reel Hunter',         xpRequired: 4750,  icon: '🎯' },
  { level: 11, title: 'Trophy Chaser',       xpRequired: 6350,  icon: '🥇' },
  { level: 12, title: 'Tidewalker',          xpRequired: 8350,  icon: '🦀' },
  { level: 13, title: 'Saltblood',           xpRequired: 11050, icon: '🔱' },
  { level: 14, title: 'Grand Slam',          xpRequired: 14450, icon: '💎' },
  { level: 15, title: 'Legend of the Water', xpRequired: 18550, icon: '⚡' },
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

/** Derived for getLevelFromXp: ceiling XP to complete each level */
export const LEVEL_BOUNDS: { maxXp: number; title: string; icon: string }[] = LEVEL_ROADMAP.map((r, i) => ({
  maxXp: r.level === MAX_LEVEL ? Infinity : (LEVEL_ROADMAP[i + 1]?.xpRequired ?? Infinity),
  title: r.title,
  icon:  r.icon,
}));

export function getLevelFromXp(xp: number): {
  level: number;
  title: string;
  icon: string;
  xpInLevel: number;
  xpForNext: number;
} {
  let acc = 0;
  for (let i = 0; i < LEVEL_BOUNDS.length; i++) {
    const prev  = acc;
    const bound = LEVEL_BOUNDS[i].maxXp;
    acc = bound === Infinity ? 999999 : bound;
    if (xp < acc) {
      const xpInLevel = xp - prev;
      const xpForNext = bound === Infinity ? 0 : bound - prev;
      return { level: i + 1, title: LEVEL_BOUNDS[i].title, icon: LEVEL_BOUNDS[i].icon, xpInLevel, xpForNext };
    }
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
