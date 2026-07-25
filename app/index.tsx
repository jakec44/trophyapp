/**
 * Root index: land on Trophy Board (first visible tab).
 * Home is hidden from the tab bar; redirecting to /(tabs) alone can freeze Expo Router.
 */

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/leaderboard" />;
}
