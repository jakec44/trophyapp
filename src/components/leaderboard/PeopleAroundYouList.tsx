import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { UserLink } from '@/src/components/profile/UserLink';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';
import { formatLeaderboardMetric } from '@/src/constants/competitions';
import type { LeaderboardEntryWithMovement } from '@/src/utils/competitiveRankData';

const RANK_UP = '#22C55E';
const RANK_DOWN = '#DC2626';

interface PeopleAroundYouListProps {
  entries: LeaderboardEntryWithMovement[];
  onFishPress?: (userId: string, rank: number) => void;
}

export function PeopleAroundYouList({ entries, onFishPress }: PeopleAroundYouListProps) {
  const router = useRouter();

  const handleFish = (userId: string, rank: number) => {
    onFishPress?.(userId, rank);
    if (userId !== 'current-user') {
      router.push(`/catch/${userId}__${rank}`);
    }
  };

  return (
    <View style={styles.list}>
      {entries.map((item) => {
        const metric = formatLeaderboardMetric(
          item.species || '',
          item.weight ?? 0,
          item.length
        );
        const rankChange = item.rankChange ?? 0;
        const isUp = rankChange > 0;
        const isDown = rankChange < 0;

        return (
          <View
            key={item.userId}
            style={[
              styles.card,
              item.isCurrentUser && styles.cardCurrentUser,
              item.isDangerZone && !item.isCurrentUser && styles.cardDangerZone,
            ]}
          >
            <View style={styles.left}>
              <View style={styles.rankCol}>
                <Text style={styles.rankText}>#{item.rank}</Text>
                {rankChange !== 0 && (
                  <View
                    style={[
                      styles.rankChangeBadge,
                      isUp && styles.rankChangeUp,
                      isDown && styles.rankChangeDown,
                    ]}
                  >
                    <Ionicons
                      name={isUp ? 'arrow-up' : 'arrow-down'}
                      size={10}
                      color="#FFF"
                    />
                    <Text style={styles.rankChangeText}>{Math.abs(rankChange)}</Text>
                  </View>
                )}
              </View>

              <UserLink
                userId={item.userId}
                username={item.username}
                avatarUrl={item.avatar}
                variant="avatar-only"
                avatarSize={44}
              >
                {isValidImageUri(item.avatar) ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.lightBorder, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 10, color: colors.lightSubtext }}>{(item.username || '?').slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
              </UserLink>

              <View style={styles.info}>
                <UserLink
                  userId={item.userId}
                  username={item.username}
                  variant="text-only"
                  textStyle={styles.username}
                />
                <Text style={styles.species} numberOfLines={1}>
                  {item.species}
                </Text>
                {item.voteGap !== undefined && !item.isCurrentUser && (
                  <Text
                    style={[
                      styles.voteGap,
                      item.voteGap > 0 ? styles.voteGapAbove : styles.voteGapBelow,
                    ]}
                  >
                    {item.voteGap > 0
                      ? `${item.voteGap} votes ahead`
                      : `${Math.abs(item.voteGap)} votes behind`}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.right}>
              {isValidImageUri(item.fishImageUrl) ? (
                <TouchableOpacity
                  onPress={() => handleFish(item.userId, item.rank)}
                >
                  <Image
                    source={{ uri: item.fishImageUrl }}
                    style={styles.fishImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ) : (
                <View style={[styles.fishImage, styles.fishPlaceholder]}>
                  <Ionicons name="fish-outline" size={24} color={colors.lightSubtext} />
                </View>
              )}
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricUnit}>{metric.unit}</Text>
              </View>
            </View>

            {item.isDangerZone && !item.isCurrentUser && (
              <View style={styles.dangerBadge}>
                <Ionicons name="alert-circle" size={12} color="#DC2626" />
                <Text style={styles.dangerText}>Close</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    position: 'relative',
  },
  cardCurrentUser: {
    borderColor: colors.brightBlue,
    borderWidth: 2,
    backgroundColor: 'rgba(0, 102, 255, 0.04)',
  },
  cardDangerZone: {
    borderColor: 'rgba(220, 38, 38, 0.5)',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankCol: {
    alignItems: 'center',
    minWidth: 36,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.lightText,
  },
  rankChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 1,
  },
  rankChangeUp: {
    backgroundColor: RANK_UP,
  },
  rankChangeDown: {
    backgroundColor: RANK_DOWN,
  },
  rankChangeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightBorder,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.lightText,
  },
  species: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  voteGap: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  voteGapAbove: {
    color: '#DC2626',
  },
  voteGapBelow: {
    color: '#22C55E',
  },
  right: {
    alignItems: 'flex-end',
  },
  fishImage: {
    width: 56,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#0A0A0A',
    marginBottom: 4,
  },
  fishPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricBox: {
    alignItems: 'flex-end',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.gold,
  },
  metricUnit: {
    fontSize: 11,
    color: colors.lightSubtext,
  },
  dangerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dangerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
});
