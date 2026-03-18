/** Tournament place (1st–5th get badges) */
export type TournamentPlace = 1 | 2 | 3 | 4 | 5;

/** Shape of a row from the tournament_results table */
export interface TournamentResult {
  id: string;
  tournament_id: string;
  tournament_name: string;
  user_id: string;
  place: TournamentPlace;
  catch_id?: string | null;
  fish_photo_url?: string | null;
  fish_species?: string | null;
  weight_lbs?: number | null;
  length_in?: number | null;
  unit: string;
  xp_awarded: number;
  created_at: string;
  seen_at?: string | null;
}

/** Place colour palette */
export const PLACE_PALETTE: Record<
  TournamentPlace,
  { label: string; medal: string; primary: string; glow: string; border: string; badge: string; text: string }
> = {
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
  4: {
    label: '4th Place',
    medal: '4',
    primary: '#7B68EE',
    glow: 'rgba(123,104,238,0.35)',
    border: 'rgba(123,104,238,0.65)',
    badge: '#5B4DB8',
    text: '#0f0a20',
  },
  5: {
    label: '5th Place',
    medal: '5',
    primary: '#8B7355',
    glow: 'rgba(139,115,85,0.35)',
    border: 'rgba(139,115,85,0.65)',
    badge: '#6B5344',
    text: '#1a1408',
  },
};

/** Get ordinal label for place (1st, 2nd, 3rd, 4th, 5th) */
export function getPlaceLabel(place: TournamentPlace): string {
  return place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : place === 4 ? '4th' : '5th';
}
