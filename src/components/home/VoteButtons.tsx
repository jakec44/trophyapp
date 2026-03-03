import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors } from '@/utils/colors';
import type { UserVote } from '@/src/types/tournaments';

// Tweakable sizing — compact to prevent overflow on narrow screens
const BUTTON_GAP = 6;
const BUTTON_PADDING_V = 2;
const BUTTON_PADDING_H = 6;
const SCALE_DURATION = 70; // ms each phase (1 -> 1.08 -> 1 ≈ 140ms total)

interface VoteButtonsProps {
  upVotes: number;
  downVotes: number;
  userVote: UserVote | null | undefined;
  onVote: (vote: UserVote) => void;
  disabled?: boolean;
  loading?: boolean;
  /** Dark theme: green/teal up, red down, progress bar */
  dark?: boolean;
  /** Full-width bar layout: [👍] [bar] [👎] below image */
  fullWidthBar?: boolean;
  /** Compact: no bar, tighter padding — for narrow hero cards */
  compact?: boolean;
}

export function VoteButtons({
  upVotes,
  downVotes,
  userVote,
  onVote,
  disabled = false,
  loading = false,
  dark = false,
  fullWidthBar = false,
  compact = false,
}: VoteButtonsProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const upCountScale = useRef(new Animated.Value(1)).current;
  const prevUpVotes = useRef(upVotes);

  useEffect(() => {
    if (prevUpVotes.current !== upVotes) {
      prevUpVotes.current = upVotes;
      upCountScale.setValue(1.12);
      Animated.timing(upCountScale, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    }
  }, [upVotes]);

  const runThumbsUpScale = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.08, duration: SCALE_DURATION, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: SCALE_DURATION, useNativeDriver: true }),
    ]).start();
  };

  const handleUp = () => {
    if (disabled || loading) return;
    runThumbsUpScale();
    onVote(userVote === 'UP' ? null : 'UP');
  };

  const handleDown = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onVote(userVote === 'DOWN' ? null : 'DOWN');
  };

  const total = upVotes + downVotes;
  const ratio = total > 0 ? upVotes / total : 1;

  const btnStyle = compact ? styles.buttonCompact : styles.button;
  const emojiStyle = compact ? styles.emojiCompact : styles.emoji;
  const countStyle = compact ? styles.countCompact : styles.count;

  return (
    <View style={[styles.container, fullWidthBar && styles.containerFullBar]}>
      <TouchableOpacity
        style={[
          btnStyle,
          dark ? styles.buttonUpDark : styles.buttonUp,
          userVote === 'UP' && (dark ? styles.buttonUpActiveDark : styles.buttonUpActive),
        ]}
        onPress={handleUp}
        disabled={disabled || loading}
        activeOpacity={0.8}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Animated.View style={[styles.buttonInner, { transform: [{ scale: scaleAnim }] }]}>
          {loading ? (
            <ActivityIndicator size="small" color={userVote === 'UP' ? '#FFF' : dark ? colors.green : colors.accentBlue} />
          ) : (
            <>
              <Text style={emojiStyle}>👍</Text>
              <Animated.View style={{ transform: [{ scale: upCountScale }] }}>
                <Text style={[countStyle, userVote === 'UP' && styles.countUpActive]}>
                  {upVotes}
                </Text>
              </Animated.View>
            </>
          )}
        </Animated.View>
      </TouchableOpacity>
      {dark && !compact && (
        <View style={styles.progressBar}>
          {/* Red base = down-votes */}
          <LinearGradient
            colors={['rgba(255,60,80,0.55)', 'rgba(200,20,40,0.7)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Green fill over the left portion = up-votes */}
          <View style={[styles.progressFill, { width: `${ratio * 100}%` }]}>
            <LinearGradient
              colors={[colors.teal, colors.green]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </View>
      )}
      <TouchableOpacity
        style={[
          btnStyle,
          dark ? styles.buttonDownDark : styles.buttonDown,
          userVote === 'DOWN' && (dark ? styles.buttonDownActiveDark : styles.buttonDownActive),
        ]}
        onPress={handleDown}
        disabled={disabled || loading}
        activeOpacity={0.8}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={emojiStyle}>👎</Text>
        <Text style={[countStyle, userVote === 'DOWN' && styles.countDownActive]}>
          {downVotes}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BUTTON_GAP,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: BUTTON_PADDING_V,
    paddingHorizontal: BUTTON_PADDING_H,
    borderRadius: 8,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonUp: {
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  buttonUpActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  buttonUpDark: {
    backgroundColor: 'rgba(0,240,160,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,240,160,0.35)',
  },
  buttonUpActiveDark: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  buttonDown: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  buttonDownActive: {
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.06)',
  },
  buttonDownDark: {
    backgroundColor: 'rgba(255,77,109,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.3)',
  },
  buttonDownActiveDark: {
    borderColor: colors.red,
    backgroundColor: 'rgba(255,77,109,0.2)',
  },
  containerFullBar: {
    flex: 1,
    width: '100%',
    minWidth: 0,
  },
  progressBar: {
    flex: 1,
    minWidth: 20,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  emoji: {
    fontSize: 12,
    marginRight: 2,
  },
  emojiCompact: {
    fontSize: 11,
    marginRight: 1,
  },
  count: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  countCompact: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.lightSubtext,
  },
  buttonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 7,
    flexShrink: 0,
  },
  countUpActive: {
    color: '#FFF',
  },
  countDownActive: {
    color: '#DC2626',
  },
});
