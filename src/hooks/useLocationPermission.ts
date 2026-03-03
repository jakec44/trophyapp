import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied' | 'loading';

export function useLocationPermission() {
  const [status, setStatus] = useState<LocationPermissionStatus>('undetermined');

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setStatus('loading');
    try {
      const { status: foreground } = await Location.requestForegroundPermissionsAsync();
      const granted = foreground === 'granted';
      setStatus(granted ? 'granted' : 'denied');
      if (!granted) {
        Alert.alert(
          'Location Access',
          'Allow location access to see local tournaments near you. You can change this in Settings.',
          [{ text: 'OK' }]
        );
      }
      return granted;
    } catch (e) {
      setStatus('denied');
      return false;
    }
  }, []);

  const checkPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status: foreground } = await Location.getForegroundPermissionsAsync();
      const granted = foreground === 'granted';
      setStatus(granted ? 'granted' : foreground === 'denied' ? 'denied' : 'undetermined');
      return granted;
    } catch {
      setStatus('denied');
      return false;
    }
  }, []);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const has = await checkPermission();
    if (has) return true;
    return requestPermission();
  }, [checkPermission, requestPermission]);

  return { status, requestPermission, checkPermission, ensurePermission };
}
