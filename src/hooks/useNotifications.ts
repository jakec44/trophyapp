/**
 * Notifications - tournament "could place" alerts etc.
 * TODO: Wire to backend when available
 */

import { useCallback } from 'react';
import type { CouldPlaceAlert } from './useHomeTournaments';

export interface AppNotification {
  id: string;
  type: 'could_place';
  title: string;
  body: string;
  tournamentId?: string;
  read: boolean;
  createdAt: string;
}

export function notificationsFromCouldPlace(
  couldPlace: CouldPlaceAlert | null
): AppNotification[] {
  if (!couldPlace) return [];
  return [
    {
      id: `could-place-${couldPlace.tournamentId}`,
      type: 'could_place',
      title: `You could place #${couldPlace.predictedRank}!`,
      body: `Your ${couldPlace.userFishMetricDisplay} beats current 3rd (${couldPlace.currentThirdPlaceMetric}) in ${couldPlace.tournamentTitle}`,
      tournamentId: couldPlace.tournamentId,
      read: false,
      createdAt: new Date().toISOString(),
    },
  ];
}
