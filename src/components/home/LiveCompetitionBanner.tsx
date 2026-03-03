import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { FishEntry } from '@/src/types/tournaments';
import { TournamentCountdown } from '@/src/components/gamification/TournamentCountdown';
import { LeaderboardRow } from './LeaderboardRow';

interface LiveCompetitionBannerProps {
  title: string;
  description: string;
  endsAt: string;
  topEntries: FishEntry[];
  entrantsCount: number;
  onVote?: (entryId: string, vote: 'UP' | 'DOWN' | null) => void;
  voteLoading?: string | null;
}

export function LiveCompetitionBanner({
  title,
  description,
  endsAt,
  topEntries,
  entrantsCount,
  onVote,
  voteLoading,
}: LiveCompetitionBannerProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <>
      <TouchableOpacity
        style={styles.banner}
        activeOpacity={0.85}
        onPress={() => setExpanded(true)}
      >
        <Animated.View
          style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]}
        />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.countdownWrap}>
          <TournamentCountdown endsAt={endsAt} compact />
        </View>
        <Text style={styles.entrants}>{entrantsCount} competing</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.lightSubtext} />
      </TouchableOpacity>

      <Modal
        visible={expanded}
        transparent
        animationType="slide"
        onRequestClose={() => setExpanded(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setExpanded(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity
                onPress={() => setExpanded(false)}
                hitSlop={12}
              >
                <Ionicons name="close" size={24} color={colors.lightText} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>{description}</Text>
            <View style={styles.podium}>
              {topEntries.length === 0 ? (
                <Text style={styles.empty}>Be the first to enter</Text>
              ) : (
                topEntries.slice(0, 5).map((entry, idx) => (
                  <LeaderboardRow
                    key={entry.id}
                    entry={entry}
                    rank={idx + 1}
                    metricType="WEIGHT_LBS"
                    onVote={onVote ?? (() => {})}
                    voteLoading={voteLoading}
                  />
                ))
              )}
            </View>
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => {
                setExpanded(false);
                router.push('/(tabs)/tournaments');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.viewAllText}>View full leaderboard</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.lightCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    gap: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.lightText,
    minWidth: 0,
  },
  countdownWrap: {
    flexShrink: 0,
  },
  entrants: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightSubtext,
    flexShrink: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.lightCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.lightBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.lightText,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.lightSubtext,
    paddingHorizontal: 20,
    marginBottom: 16,
    lineHeight: 20,
  },
  podium: {
    backgroundColor: colors.lightBackground,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  empty: {
    fontSize: 14,
    color: colors.lightSubtext,
    textAlign: 'center',
    paddingVertical: 16,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.brightBlue,
    borderRadius: 12,
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
