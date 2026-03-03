/**
 * Deep link entry: Snagged://invite?token=XYZ
 * Redirects to invite-accept with token
 */

import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function InviteRedirect() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  useEffect(() => {
    router.replace({
      pathname: '/invite-accept',
      params: token ? { token } : {},
    });
  }, [router, token]);

  return null;
}
