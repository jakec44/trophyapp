/**
 * Overall | Bass | Redfish | Tarpon | Snook category chips.
 */

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '@/utils/colors';
import type { LeaderboardCategory } from '@/src/lib/snaggedRank';

const CATEGORIES: { id: LeaderboardCategory; label: string }[] = [
  { id: 'overall', label: 'Overall' },
  { id: 'bass', label: 'Bass' },
  { id: 'redfish', label: 'Redfish' },
  { id: 'tarpon', label: 'Tarpon' },
  { id: 'snook', label: 'Snook' },
];

interface SpeciesCategoryTabsProps {
  value: LeaderboardCategory;
  onChange: (v: LeaderboardCategory) => void;
}

export function SpeciesCategoryTabs({ value, onChange }: SpeciesCategoryTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {CATEGORIES.map((cat) => {
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
