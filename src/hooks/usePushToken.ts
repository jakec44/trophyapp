/**
 * Register for push notifications and save Expo push token to Supabase (profiles.push_token).
 * Used so we can send notifications to TestFlight and production builds.
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { updateUserProfile } from '@/src/lib/supabase';

const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

export function usePushToken(userId: string | null) {
  const registered = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !userId || !PROJECT_ID) return;
    if (registered.current) return;

    let cancelled = false;

    (async () => {
      try {
        if (!Device.isDevice) return;
        const { status: existing } = await Notifications.getPermissionsAsync();
        let final = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          final = status;
        }
        if (final !== 'granted' || cancelled) return;

        const tokenResult = await Notifications.getExpoPushTokenAsync({
          projectId: PROJECT_ID,
        });
        const token = tokenResult?.data?.trim();
        if (!token || cancelled) return;

        await updateUserProfile(userId, { push_token: token });
        registered.current = true;
      } catch (e) {
        console.warn('[usePushToken] Register failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
