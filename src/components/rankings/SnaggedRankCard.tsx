/**
 * Snagged Rank summary card — tier, trophies, global/local ranks.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { CARD_RADIUS_LG } from '@/src/constants/styles';
import { getSnaggedRankTier, getTierColor } from '@/src/lib/snaggedRank';

interface SnaggedRankCardProps {
  trophies: number;
  globalRank?: number | null;
  localRank?: number | null;
  onViewLeaderboards?: () => void;
  showLeaderboardButton?: boolean;
}

export function SnaggedRankCard({
  trophies,
  globalRank,
  localRank,
  onViewLeaderboards,
  showLeaderboardButton = true,
}: SnaggedRankCardProps) {
  const tier = getSnaggedRankTier(trophies);
  const tierColor = getTierColor(tier.tierName);

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { borderColor: `${tierColor}44` }]}>
        <LinearGradient
          colors={[`${tierColor}18`, 'rgba(7,30,48,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topRow}>
          <View style={styles.trophyCol}>
            <Ionicons name="trophy" size={20} color={colors.gold} />
            <Text style={styles.trophyCount}>{tier.trophies}</Text>
            <Text style={styles.trophyLabel}>YOUR TROPHIES</Text>
          </View>
          <View style={styles.tierCol}>
            <View style={[styles.shield, { borderColor: tierColor }]}>
              <Ionicons name="shield" size={28} color={tierColor} />
            </View>
            <Text style={[styles.tierLabel, { color: tierColor }]}>{tier.label}</Text>
          </View>
        </View>

        <View style={styles.rankRow}>
          <View style={styles.rankBox}>
            <Text style={styles.rankNum}>{globalRank != null ? `#${globalRank}` : '—'}</Text>
            <Text style={styles.rankLabel}>GLOBAL RANK</Text>
          </View>
          <View style={styles.rankDivider} />
          <View style={styles.rankBox}>
            <Text style={styles.rankNum}>{localRank != null ? `#${localRank}` : '—'}</Text>
            <Text style={styles.rankLabel}>LOCAL RANK</Text>
          </View>
        </View>

        {tier.nextTierLabel && tier.trophiesToNext > 0 ? (
          <Text style={styles.progressText}>
            {tier.trophiesToNext} trophies to {tier.nextTierLabel.split(' ')[0]}
          </Text>
        ) : null}
      </View>

      {showLeaderboardButton && onViewLeaderboards ? (
        <TouchableOpacity style={styles.lbBtn} onPress={onViewLeaderboards} activeOpacity={0.85}>
          <Ionicons name="bar-chart" size={18} color="#020b14" />
          <Text style={styles.lbBtnText}>View Leaderboards</Text>
          <Ionicons name="chevron-forward" size={18} color="#020b14" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function RankStandingsLockedCard() {
  return (
    <View style={styles.lockedCard}>
      <Text style={styles.lockedTitle}>Rank Standings</Text>
      <Text style={styles.lockedSub}>Complete your placements to get your global position!</Text>
      <Ionicons name="leaf" size={32} color={colors.green} style={styles.lockedIcon} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  card: {
    borderRadius: CARD_RADIUS_LG,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: colors.lightCard,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  trophyCol: {
    alignItems: 'flex-start',
  },
  trophyCount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  trophyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.lightSubtext,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  tierCol: {
    alignItems: 'center',
  },
  shield: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  tierLabel: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  rankRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rankBox: {
    flex: 1,
    alignItems: 'center',
  },
  rankDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 8,
  },
  rankNum: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.gold,
  },
  rankLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.lightSubtext,
    letterSpacing: 0.6,
    marginTop: 4,
  },
  progressText: {
    fontSize: 12,
    color: colors.lightSubtext,
    textAlign: 'center',
  },
  lbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff8c2a',
    borderRadius: 12,
    paddingVertical: 14,
  },
  lbBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#020b14',
    flex: 1,
    textAlign: 'center',
  },
  lockedCard: {
    borderRadius: CARD_RADIUS_LG,
    padding: 16,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  lockedSub: {
    fontSize: 13,
    color: colors.lightSubtext,
    lineHeight: 18,
    paddingRight: 48,
  },
  lockedIcon: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    opacity: 0.6,
  },
});
