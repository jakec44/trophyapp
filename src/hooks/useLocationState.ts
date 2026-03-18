/**
 * Get user's state from device location (permission + geocode).
 * Used for Local leaderboard / tournaments.
 */

import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { toStateAbbreviation } from '@/src/lib/stateAbbreviations';

export type LocationStateStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'error';

export function useLocationState() {
  const [state, setState] = useState<string | null>(null);
  const [status, setStatus] = useState<LocationStateStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStateFromLocation = useCallback(async (): Promise<string | null> => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        setStatus('denied');
        Alert.alert(
          'Location Access',
          'Allow location access to see the local leaderboard for your area.',
          [{ text: 'OK' }]
        );
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = loc.coords;
      const geocode = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      if (geocode.length === 0) {
        setStatus('error');
        setErrorMessage('Could not determine your location');
        return null;
      }
      const address = geocode[0];
      const region = (address as { region?: string }).region;
      const abbr = toStateAbbreviation(region);
      if (abbr) {
        setState(abbr);
        setStatus('granted');
        return abbr;
      }
      setStatus('error');
      setErrorMessage('Could not determine your state');
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Location error';
      setStatus('error');
      setErrorMessage(msg);
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    setState(null);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return { state, status, errorMessage, fetchStateFromLocation, clear };
}
