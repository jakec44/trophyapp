import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '@/utils/colors';
const GOLD = colors.gold;
const ACCENT_BLUE = colors.accentBlue;

export interface XPProgressBarLevelInfo {
  level: number;
  title: string;
  xpInLevel: number;
  xpForNext: number;
}

const FIERY_GOLD = '#FF8C00';
const FIERY_ORANGE = '#FF6B00';

interface XPProgressBarProps {
  levelInfo: XPProgressBarLevelInfo;
  compact?: boolean;
  thick?: boolean;
  /** Prestige level (0–3). Shown as " · P1" etc next to level when > 0. */
  prestige?: number;
  /** When true, prestige label uses fiery gold styling. */
  prestigeFiery?: boolean;
}

export function XPProgressBar({ levelInfo, compact = false, thick = false, prestige, prestigeFiery = false }: XPProgressBarProps) {
  const { level, title, xpInLevel, xpForNext } = levelInfo;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progress = xpForNext > 0 ? xpInLevel / xpForNext : 1;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const widthInterp = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const levelLabel = prestige && prestige > 0 ? `Lv ${level} · P${prestige}` : `Lv ${level}`;
  const levelLabelLong = prestige && prestige > 0 ? `Level ${level} · P${prestige}` : `Level ${level}`;

  const prestigeLabel = prestige && prestige > 0 ? ` · P${prestige}` : '';

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <View style={styles.compactBadge}>
          <Text style={styles.compactLevel}>
            {prestigeFiery && prestigeLabel ? (
              <>
                {`Lv ${level}`}
                <Text style={styles.prestigeFiery}>{prestigeLabel}</Text>
              </>
            ) : (
              levelLabel
            )}
          </Text>
          <Text style={styles.compactTitle}>{title}</Text>
        </View>
        <View style={styles.compactBarBg}>
          <Animated.View style={[styles.compactBarFill, { width: widthInterp }]} />
        </View>
        {xpForNext > 0 && (
          <Text style={styles.compactXp}>{xpInLevel}/{xpForNext} XP</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.levelText}>
            {prestigeFiery && prestigeLabel ? (
              <>
                {`Level ${level}`}
                <Text style={styles.prestigeFiery}>{prestigeLabel}</Text>
              </>
            ) : (
              levelLabelLong
            )}
          </Text>
          <Text style={styles.titleText}>{title}</Text>
        </View>
        {xpForNext > 0 && (
          <Text style={styles.xpText}>
            {xpInLevel} / {xpForNext} XP
          </Text>
        )}
      </View>
      <View style={[styles.barBg, thick && styles.barBgThick]}>
        <Animated.View style={[styles.barFill, thick && styles.barFillThick, { width: widthInterp }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '700',
    color: GOLD,
  },
  prestigeFiery: {
    color: FIERY_GOLD,
    fontWeight: '800',
    textShadowColor: FIERY_ORANGE,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.lightText,
  },
  xpText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  barBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(212,175,55,0.25)',
    overflow: 'hidden',
  },
  barBgThick: {
    height: 16,
    borderRadius: 8,
  },
  barFill: {
    height: '100%',
    backgroundColor: GOLD,
    borderRadius: 5,
  },
  barFillThick: {
    borderRadius: 8,
  },
  compactWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactLevel: {
    fontSize: 12,
    fontWeight: '800',
    color: GOLD,
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.lightText,
  },
  compactBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.lightCardBlue,
    overflow: 'hidden',
  },
  compactBarFill: {
    height: '100%',
    backgroundColor: GOLD,
    borderRadius: 3,
  },
  compactXp: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
});
