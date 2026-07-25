/**
 * Global | Local segmented control for Rankings tab.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';

export type RankingsScope = 'global' | 'local';

interface GlobalLocalScopeToggleProps {
  value: RankingsScope;
  onChange: (v: RankingsScope) => void;
  localLabel?: string | null;
}

const SEGMENTS: { id: RankingsScope; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'local', label: 'Local' },
];

export function GlobalLocalScopeToggle({ value, onChange, localLabel }: GlobalLocalScopeToggleProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.container}>
        {SEGMENTS.map((seg) => {
          const active = value === seg.id;
          return (
            <TouchableOpacity
              key={seg.id}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => onChange(seg.id)}
              activeOpacity={0.8}
            >
              {active && (
                <LinearGradient
                  colors={['rgba(0,229,200,0.25)', 'rgba(0,207,255,0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
                {seg.label}
              </Text>
              {seg.id === 'local' && localLabel ? (
                <Text style={[styles.localSub, active && styles.localSubActive]} numberOfLines={1}>
                  {localLabel}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  container: {
    flexDirection: 'row',
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.15)',
    padding: 4,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minHeight: 44,
  },
  segmentActive: {
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.35)',
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textFaint,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  textActive: {
    color: colors.teal,
  },
  localSub: {
    fontSize: 9,
    color: colors.textFaint,
    marginTop: 2,
    opacity: 0.7,
  },
  localSubActive: {
    color: colors.teal,
    opacity: 0.85,
  },
});
