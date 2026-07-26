/**
 * Stack alias — App Store Compete UI lives on the Compete tab.
 */
import { Redirect } from 'expo-router';

export default function CompeteRedirect() {
  return <Redirect href="/(tabs)/tournaments" />;
}
