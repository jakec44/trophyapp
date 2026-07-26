/**
 * Hidden tab route — Compete UI lives on the stack screen `/compete`
 * (exact App Store 1.2.2 layout). Keep this redirect so old links still work.
 */
import { Redirect } from 'expo-router';

export default function TournamentsTabRedirect() {
  return <Redirect href="/compete" />;
}
