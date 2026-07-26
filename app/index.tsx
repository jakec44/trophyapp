/**
 * Root index: land on Compete (full tournaments UI).
 */
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/tournaments" />;
}
