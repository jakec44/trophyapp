/**
 * Loading screen: dark theme (abyss) with Snagged trophy + fish icon.
 * Shown while checking auth session on app launch.
 */

import { View, Image, StyleSheet } from 'react-native';
import { colors } from '@/utils/colors';

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/loading-trophy.png')}
        style={styles.icon}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 200,
    height: 200,
  },
});
