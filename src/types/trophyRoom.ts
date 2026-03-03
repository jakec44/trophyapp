export type ThemeType = 'fish-cabin' | 'duck-lodge' | 'underwater';

export interface TrophyTheme {
  id: string;
  name: string;
  themeType: ThemeType;
  isPublic: boolean;
  sortOrder: number;
}

export interface MountedFish {
  id: string;
  themeId: string;
  catchId: string;
  /** 0-5 slot index (wood themes); undefined = legacy */
  slotIndex?: number;
  /** 0-1 position on wall X */
  positionX: number;
  /** 0-1 position on wall Y */
  positionY: number;
  /** 0.5 - 2 */
  scale: number;
  /** 0 = right, 180 = left (degrees) */
  rotation: number;
}
