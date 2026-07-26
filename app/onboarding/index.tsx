import { Redirect } from 'expo-router';

/** Onboarding UI removed — Superwall will handle paywall/onboarding. */
export default function OnboardingIndex() {
  return <Redirect href="/(tabs)/leaderboard" />;
}
