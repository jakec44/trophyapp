import { Redirect } from 'expo-router';

/** Onboarding UI removed — Superwall will handle paywall/onboarding. */
export default function OnboardingStep2() {
  return <Redirect href="/(tabs)/leaderboard" />;
}
