/**
 * Species chips for Rankings tab — driven by SPECIES_LEADERBOARD_OPTIONS.
 */

import { Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '@/utils/colors';
import {
  SPECIES_LEADERBOARD_OPTIONS,
  type SpeciesLeaderboardSpecies,
} from '@/src/lib/snaggedRank';

interface SpeciesCategoryTabsProps {
  value: SpeciesLeaderboardSpecies;
  onChange: (v: SpeciesLeaderboardSpecies) => void;
}

export function SpeciesCategoryTabs({ value, onChange }: SpeciesCategoryTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {SPECIES_LEADERBOARD_OPTIONS.map((cat) => {
        const active = value === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(cat.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(7,30,48,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textFaint,
  },
  chipTextActive: {
    color: '#020b14',
  },
});
