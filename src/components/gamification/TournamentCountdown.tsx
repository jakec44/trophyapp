import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/utils/colors';
import { useTournamentTimer, formatTournamentCountdown } from '@/src/hooks/useTournamentTimer';

const TEAL = colors.teal;

interface TournamentCountdownProps {
  endsAt: string; // ISO string
  compact?: boolean;
  /** Use light text/pill for dark backgrounds (e.g. blue Live card) */
  onDark?: boolean;
  /** Called once when the countdown reaches zero (so winner check can run immediately). */
  onEnded?: () => void;
}

export function TournamentCountdown({ endsAt, compact = false, onDark = false, onEnded }: TournamentCountdownProps) {
  const remaining = useTournamentTimer(endsAt);
  const didFireEnded = useRef(false);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  // Fire once when countdown reaches zero; immediate + one short retry (server may be slightly behind)
  useEffect(() => {
    if (!remaining.ended) {
      didFireEnded.current = false;
      return;
    }
    if (didFireEnded.current) return;
    const fn = onEndedRef.current;
    if (!fn) return;
    didFireEnded.current = true;
    fn();
    const t = setTimeout(fn, 800);
    return () => clearTimeout(t);
  }, [remaining.ended]);

  const hoursLeft = remaining.totalHours;
  const isUnder24h = hoursLeft < 24 && hoursLeft >= 0;

  if (remaining.ended) {
    return <Text style={[styles.ended, onDark && styles.endedOnDark]}>Ended</Text>;
  }

  const countdownStr = formatTournamentCountdown(remaining);

  const textEl = (
    <Text
      style={[
        styles.countdown,
        compact && styles.countdownCompact,
        isUnder24h && !onDark && styles.countdownTeal,
        onDark && styles.countdownOnDark,
        onDark && isUnder24h && styles.countdownOnDarkTeal,
      ]}
    >
      {countdownStr}
    </Text>
  );

  return (
    <View style={[styles.wrap, styles.countdownPill, onDark && styles.countdownPillOnDark]}>
      {textEl}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countdownPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(107, 114, 128, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.2)',
    alignSelf: 'flex-start',
  },
  countdown: {
    fontSize: 13,
    fontWeight: '700',
    color: TEAL,
  },
  countdownCompact: {
    fontSize: 12,
  },
  countdownTeal: {
    color: TEAL,
  },
  countdownOnDark: {
    color: 'rgba(255,255,255,0.95)',
  },
  countdownOnDarkTeal: {
    color: TEAL,
  },
  countdownPillOnDark: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  countdownRed: {
    color: '#DC2626',
    fontWeight: '800',
  },
  ended: {
    fontSize: 12,
    color: colors.lightSubtext,
    fontStyle: 'italic',
  },
  endedOnDark: {
    color: 'rgba(255,255,255,0.9)',
  },
});
