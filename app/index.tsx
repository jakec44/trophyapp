/**
 * Root index: land on Compete (App Store first tab).
 */

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/tournaments" />;
}
