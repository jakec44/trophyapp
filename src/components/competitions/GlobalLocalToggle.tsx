/**
 * Prominent segmented control for Global / Local mode switch.
 * Primary control — larger than filter chips, full-width, clear active state.
 */

import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';

interface GlobalLocalToggleProps {
  value: 'global' | 'local';
  onChange: (v: 'global' | 'local') => void;
  /** Dark tournament style per cursor-prompt */
  dark?: boolean;
}

export function GlobalLocalToggle({ value, onChange, dark = false }: GlobalLocalToggleProps) {
  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <TouchableOpacity
        style={[styles.segment, value === 'global' && styles.segmentActive, dark && value === 'global' && styles.segmentActiveDark]}
        onPress={() => onChange('global')}
        activeOpacity={0.8}
      >
        {dark && value === 'global' && (
          <LinearGradient
            colors={['rgba(0,229,200,0.2)', 'rgba(0,207,255,0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Text
          numberOfLines={1}
          style={[
            styles.text,
            value === 'global' && styles.textActive,
            dark && styles.textDark,
            dark && value === 'global' && styles.textActiveDark,
            dark && value !== 'global' && styles.textFaintDark,
          ]}
        >
          GLOBAL
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segment, value === 'local' && styles.segmentActive, dark && value === 'local' && styles.segmentActiveDark]}
        onPress={() => onChange('local')}
        activeOpacity={0.8}
      >
        {dark && value === 'local' && (
          <LinearGradient
            colors={['rgba(0,229,200,0.2)', 'rgba(0,207,255,0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Text
          numberOfLines={1}
          style={[
            styles.text,
            value === 'local' && styles.textActive,
            dark && styles.textDark,
            dark && value === 'local' && styles.textActiveDark,
            dark && value !== 'local' && styles.textFaintDark,
          ]}
        >
          LOCAL
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.lightCard,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  segment: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: colors.accentBlue,
    ...Platform.select({
      ios: {
        shadowColor: colors.accentBlue,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  text: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.lightSubtext,
  },
  textActive: {
    color: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: 'rgba(0,229,200,0.04)',
    borderColor: 'rgba(0,229,200,0.1)',
    borderRadius: 10,
    padding: 3,
  },
  segmentActiveDark: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.3)',
    overflow: 'hidden',
    position: 'relative',
  },
  textDark: {
    color: colors.text,
  },
  textActiveDark: {
    color: colors.teal,
    fontWeight: '700',
    textShadowColor: 'rgba(0,229,200,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  textFaintDark: {
    color: colors.textFaint,
  },
});
