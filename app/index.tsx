/**
 * Root index: always send to tabs. Signed-out users can browse;
 * sign-in is requested via AuthGateModal when they try to log fish, enter tournaments, etc.
 */

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)" />;
}
