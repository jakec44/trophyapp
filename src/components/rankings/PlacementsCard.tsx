/**
 * Liftoff-style placements card — log 5 fish to unlock Snagged Rank.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { CARD_RADIUS_LG } from '@/src/constants/styles';
import { PLACEMENTS_REQUIRED, placementsRemaining } from '@/src/lib/snaggedRank';

interface PlacementsCardProps {
  catchCount: number;
  onLogFish?: () => void;
}

function HexSlot({ filled }: { filled: boolean }) {
  return (
    <View style={[styles.hex, filled && styles.hexFilled]}>
      {filled ? (
        <Ionicons name="fish" size={14} color="#020b14" />
      ) : (
        <View style={styles.hexEmpty} />
      )}
    </View>
  );
}

export function PlacementsCard({ catchCount, onLogFish }: PlacementsCardProps) {
  const remaining = placementsRemaining(catchCount);
  const filled = Math.min(catchCount, PLACEMENTS_REQUIRED);

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['rgba(0,84,130,0.2)', 'rgba(7,30,48,0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.borderGlow} />
      <Text style={styles.title}>Placements</Text>
      <Text style={styles.subtitle}>
        {remaining > 0
          ? `Log ${remaining} more fish to get your Snagged rank!`
          : 'Almost there — keep logging!'}
      </Text>
      <View style={styles.hexRow}>
        {Array.from({ length: PLACEMENTS_REQUIRED }, (_, i) => (
          <HexSlot key={i} filled={i < filled} />
        ))}
      </View>
      {onLogFish ? (
        <TouchableOpacity style={styles.cta} onPress={onLogFish} activeOpacity={0.85}>
          <Text style={styles.ctaText}>LOG FISH</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS_LG,
    padding: 18,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.2)',
    backgroundColor: colors.lightCard,
  },
  borderGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS_LG,
    borderWidth: 1,
    borderColor: 'rgba(88,193,245,0.15)',
    pointerEvents: 'none',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginBottom: 16,
    lineHeight: 20,
  },
  hexRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  hex: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(2,11,20,0.6)',
    transform: [{ rotate: '0deg' }],
  },
  hexFilled: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  hexEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cta: {
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#020b14',
    letterSpacing: 1,
  },
});
