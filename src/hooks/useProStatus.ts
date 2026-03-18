import { useAuthContext } from '@/src/context/AuthContext';

/**
 * Returns whether the current user has an active Pro subscription.
 * Pro status comes from the profile (synced from RevenueCat after purchase/restore).
 */
export function useProStatus(): { isPro: boolean } {
  const { user } = useAuthContext();
  const isPro = user?.subscriptionPlan === 'pro';
  return { isPro };
}
