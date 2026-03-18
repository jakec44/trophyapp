/**
 * Tries RevenueCat's native paywall (react-native-purchases-ui) when ready;
 * otherwise falls back to the app's custom /paywall screen.
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/src/context/AuthContext';
import { isRevenueCatReady } from '@/src/lib/revenueCat';

export function usePresentPaywall(): { presentPaywall: () => Promise<boolean> } {
  const router = useRouter();
  const { refreshProfile } = useAuthContext();

  const presentPaywall = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      router.push('/paywall');
      return false;
    }
    if (!isRevenueCatReady()) {
      router.push('/paywall');
      return false;
    }
    try {
      const RNU = require('react-native-purchases-ui');
      const result = await RNU.default.presentPaywall();
      const PR = RNU.PAYWALL_RESULT;
      if (PR && (result === PR.PURCHASED || result === PR.RESTORED)) {
        await refreshProfile();
      }
      if (PR && (result === PR.ERROR || result === PR.NOT_PRESENTED)) {
        router.push('/paywall');
        return false;
      }
      return true;
    } catch {
      router.push('/paywall');
      return false;
    }
  }, [router, refreshProfile]);

  return { presentPaywall };
}
