/**
 * Friends | Global | Local segmented control (Liftoff-style).
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
import type { LeaderboardScope } from '@/src/lib/snaggedRank';

interface ScopeToggleProps {
  value: LeaderboardScope;
  onChange: (v: LeaderboardScope) => void;
  localLabel?: string | null;
}

const SEGMENTS: { id: LeaderboardScope; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'global', label: 'Global' },
  { id: 'local', label: 'Local' },
];

export function ScopeToggle({ value, onChange, localLabel }: ScopeToggleProps) {
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
  wrap: {
    marginBottom: 12,
  },
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
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minHeight: 40,
  },
  segmentActive: {
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.35)',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textFaint,
    letterSpacing: 0.3,
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
