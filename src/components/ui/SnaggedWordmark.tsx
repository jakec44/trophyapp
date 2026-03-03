import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * Tappable "Snagged" wordmark — navigates to the home tab from any screen.
 * Drop this in wherever the app title appears in a header.
 */
export function SnaggedWordmark() {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.replace('/(tabs)')} activeOpacity={0.7} hitSlop={8}>
      <Text style={styles.text}>Snagged</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
});
