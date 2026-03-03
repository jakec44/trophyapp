import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/** Redirect to tournaments — leaderboard and tournaments are the same screen. */
export default function LeaderboardScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)/tournaments');
  }, [router]);
  return null;
}
