/**
 * ScreenHeader — shows "Snagged" title on every screen.
 * Tapping the wordmark navigates to the home tab so users never get stuck.
 */

import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';

interface ScreenHeaderProps {
  /** Optional content to render on the right (icons, buttons) */
  rightContent?: React.ReactNode;
  /** Optional subtitle or extra text below Snagged */
  subtitle?: string;
  style?: ViewStyle;
}

export function ScreenHeader({ rightContent, subtitle, style }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity style={styles.left} onPress={() => router.replace('/(tabs)')} activeOpacity={0.7}>
        <Text style={styles.title}>Snagged</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </TouchableOpacity>
      {rightContent ? <View style={styles.right}>{rightContent}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
    backgroundColor: colors.lightCard,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
