/**
 * Compact tournament pill for Live Now row — name, time, participants
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';

export interface TournamentPillProps {
  id: string;
  title: string;
  endsAt?: string;
  participantsCount: number;
  onPress: () => void;
}

function formatShortTitle(title: string): string {
  if (title.length <= 18) return title;
  return title.slice(0, 15) + '…';
}

function useTimeRemaining(endsAt?: string): string {
  const [str, setStr] = useState('');
  useEffect(() => {
    if (!endsAt) return;
    const update = () => {
      const end = new Date(endsAt).getTime();
      const diff = Math.max(0, end - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (d > 0) setStr(`${d}d ${h}h`);
      else if (h > 0) setStr(`${h}h ${m}m`);
      else setStr(`${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [endsAt]);
  return str;
}

export function TournamentPill({
  id,
  title,
  endsAt,
  participantsCount,
  onPress,
}: TournamentPillProps) {
  const timeRemaining = useTimeRemaining(endsAt);
  return (
    <TouchableOpacity
      style={styles.pill}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.title} numberOfLines={1}>{formatShortTitle(title)}</Text>
      <View style={styles.meta}>
        <Feather name="clock" size={10} color={colors.lightSubtext} />
        <Text style={styles.time}>{timeRemaining}</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.count}>{participantsCount} in</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.lightCard,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    minWidth: 140,
    maxWidth: 180,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.lightText,
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  dot: {
    fontSize: 10,
    color: colors.lightSubtext,
  },
  count: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentBlue,
  },
});
