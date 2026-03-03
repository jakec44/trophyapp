import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';
import type { RivalEntry } from '@/src/utils/competitiveRankData';

interface RivalsSectionProps {
  rivals: RivalEntry[];
}

export function RivalsSection({ rivals }: RivalsSectionProps) {
  const router = useRouter();

  if (rivals.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Ionicons name="people" size={18} color={colors.lightSubtext} />
        <Text style={styles.title}>Rivals</Text>
      </View>
      <View style={styles.cards}>
        {rivals.slice(0, 2).map((r) => (
          <TouchableOpacity
            key={r.userId}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => router.push(`/user/${r.userId}`)}
          >
            {isValidImageUri(r.avatar) ? (
              <Image source={{ uri: r.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.lightBorder, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 12, color: colors.lightSubtext }}>{(r.username || '?').slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.username} numberOfLines={1}>
                {r.username}
              </Text>
              <Text style={styles.rank}>#{r.rank}</Text>
              <Text
                style={[
                  styles.gap,
                  r.isAbove ? styles.gapAbove : styles.gapBelow,
                ]}
              >
                {r.isAbove
                  ? `${Math.abs(r.rankGap)} votes ahead`
                  : `${r.rankGap} votes behind you`}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.lightSubtext,
  },
  cards: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightCard,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightBorder,
  },
  info: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.lightText,
  },
  rank: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightSubtext,
    marginTop: 2,
  },
  gap: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  gapAbove: {
    color: '#DC2626',
  },
  gapBelow: {
    color: '#22C55E',
  },
});
