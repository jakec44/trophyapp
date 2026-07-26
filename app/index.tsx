/**
 * Root index: land on Home hub (first visible tab).
 */

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/index" />;
}
