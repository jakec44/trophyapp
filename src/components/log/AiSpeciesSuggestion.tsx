/**
 * AiSpeciesSuggestion — AI: X% confident, top 3 pills, Change button
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '@/utils/colors';

const BRIGHT_BLUE = colors.brightBlue;

export interface AiSpeciesSuggestionProps {
  confidence: number;
  top3: { species: string; confidence: number }[];
  onShowPicker: () => void;
}

export function AiSpeciesSuggestion({
  confidence,
  top3,
  onShowPicker,
}: AiSpeciesSuggestionProps) {
  const pct = Math.round(confidence * 100);
  const hasPills = top3.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.confidenceText}>AI: {pct}% confident</Text>
        <TouchableOpacity onPress={onShowPicker} style={styles.changeBtn}>
          <Text style={styles.changeBtnText}>Change</Text>
        </TouchableOpacity>
      </View>
      {hasPills && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
        >
          {top3.map((t) => (
            <View key={t.species} style={styles.pill}>
              <Text style={styles.pillText} numberOfLines={1}>
                {t.species}
              </Text>
              <Text style={styles.pillSubtext}>
                {Math.round((t.confidence ?? 0) * 100)}%
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  confidenceText: {
    fontSize: 14,
    color: colors.lightSubtext,
    fontStyle: 'italic',
  },
  changeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  changeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRIGHT_BLUE,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.lightText,
  },
  pillSubtext: {
    fontSize: 11,
    color: colors.lightSubtext,
    marginTop: 2,
  },
});
