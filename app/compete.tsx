/**
 * Stack alias → Compete tab (App Store layout).
 */
import { Redirect } from 'expo-router';

export default function CompeteRedirect() {
  return <Redirect href="/(tabs)/tournaments" />;
}
