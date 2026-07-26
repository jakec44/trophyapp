/**
 * Recover from unmatched deep links / bad hrefs during development.
 */
import { Redirect } from 'expo-router';

export default function NotFound() {
  return <Redirect href="/(tabs)/tournaments" />;
}
