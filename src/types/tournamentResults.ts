/** Shape of a row from the tournament_results table */
export interface TournamentResult {
  id: string;
  tournament_id: string;
  tournament_name: string;
  user_id: string;
  place: 1 | 2 | 3;
  catch_id?: string | null;
  fish_photo_url?: string | null;
  fish_species?: string | null;
  weight_lbs?: number | null;
  length_in?: number | null;
  unit: string;
  xp_awarded: number;
  coins_awarded?: number;
  created_at: string;
  seen_at?: string | null;
}

/** Place colour palette */
export const PLACE_PALETTE = {
  1: {
    label: '1st Place',
    medal: '🥇',
    primary: '#FFB800',
    glow: 'rgba(255,184,0,0.45)',
    border: 'rgba(255,184,0,0.7)',
    badge: '#b8860b',
    text: '#1a1000',
  },
  2: {
    label: '2nd Place',
    medal: '🥈',
    primary: '#C0C8D4',
    glow: 'rgba(192,200,212,0.35)',
    border: 'rgba(192,200,212,0.65)',
    badge: '#8a9bb0',
    text: '#0a1018',
  },
  3: {
    label: '3rd Place',
    medal: '🥉',
    primary: '#E07D3A',
    glow: 'rgba(224,125,58,0.38)',
    border: 'rgba(224,125,58,0.65)',
    badge: '#a0521a',
    text: '#1a0a00',
  },
} as const;
