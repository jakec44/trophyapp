/**
 * Daily Quests screen: 3 quests, completion state, XP rewards.
 * Tap completed quest to claim → +X XP animation, XP added to profile.
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { useDailyQuests, type QuestState } from '@/src/hooks/useDailyQuests';

const TEAL = colors.teal;
const GOLD = colors.gold;

function XpClaimBurst({ xp, onEnd }: { xp: number; onEnd: () => void }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -50,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start(() => onEnd());
  }, [translateY, opacity, onEnd]);

  return (
    <Animated.View
      style={[
        styles.xpBurst,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.xpBurstText}>+{xp} XP</Text>
    </Animated.View>
  );
}

function QuestRow({
  quest,
  onClaim,
}: {
  quest: QuestState;
  onClaim: (questId: string) => void;
}) {
  const completed = quest.complete;
  const claimable = completed && !quest.claimed;

  const Wrapper = claimable ? TouchableOpacity : View;
  const wrapperProps = claimable
    ? { onPress: () => onClaim(quest.id), activeOpacity: 0.8 }
    : {};

  return (
    <Wrapper style={[styles.questCard, completed && styles.questCardCompleted]} {...wrapperProps}>
      <View style={styles.questLeft}>
        {completed ? (
          <View style={styles.checkWrap}>
            <Ionicons
              name={quest.claimed ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={24}
              color={quest.claimed ? colors.green : colors.teal}
            />
          </View>
        ) : (
          <View style={styles.circleEmpty} />
        )}
        <View style={styles.questText}>
          <Text
            style={[styles.questTitle, completed && quest.claimed && styles.questTitleStrike]}
            numberOfLines={1}
          >
            {quest.title}
          </Text>
          {quest.target != null && quest.current != null && !completed && (
            <Text style={styles.progress}>
              {quest.current}/{quest.target}
            </Text>
          )}
          {claimable && (
            <Text style={styles.tapToClaim}>Tap to claim</Text>
          )}
        </View>
      </View>
      <View style={[styles.xpBadge, claimable && styles.xpBadgeClaimable]}>
        <Text style={[styles.xpText, completed && quest.claimed && styles.xpTextDim]}>+{quest.xp} XP</Text>
      </View>
    </Wrapper>
  );
}

export default function DailyQuestsScreen() {
  const router = useRouter();
  const { quests, loading, refresh, claimQuest, countdown } = useDailyQuests();
  const [burst, setBurst] = useState<{ xp: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleClaim = useCallback(
    async (questId: string) => {
      const xp = await claimQuest(questId);
      if (xp != null) {
        setBurst({ xp });
      }
    },
    [claimQuest]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {burst && (
        <View style={styles.burstOverlay} pointerEvents="none">
          <XpClaimBurst
            xp={burst.xp}
            onEnd={() => setBurst(null)}
          />
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.lightText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Quests</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color={TEAL} style={styles.loader} />
        ) : (
          <>
            <View style={styles.questList}>
              {quests.map((q) => (
                <QuestRow key={q.id} quest={q} onClaim={handleClaim} />
              ))}
            </View>
            <Text style={styles.footer}>
              Resets at 6 AM. Next reset in {countdown}. Complete quests to earn XP.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.lightText,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loader: {
    marginTop: 48,
  },
  questList: {
    gap: 10,
  },
  questCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.lightCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  questCardCompleted: {
    opacity: 0.85,
  },
  questLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  checkWrap: {
    width: 28,
    alignItems: 'center',
  },
  circleEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: TEAL,
  },
  questText: {
    flex: 1,
  },
  questTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.lightText,
  },
  questTitleStrike: {
    textDecorationLine: 'line-through',
    color: colors.lightSubtext,
  },
  progress: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  tapToClaim: {
    fontSize: 11,
    color: TEAL,
    marginTop: 2,
    fontWeight: '600',
  },
  xpBadge: {
    backgroundColor: 'rgba(255,200,69,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  xpBadgeClaimable: {
    backgroundColor: 'rgba(255,200,69,0.35)',
  },
  xpText: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
  },
  xpTextDim: {
    color: colors.lightSubtext,
  },
  footer: {
    fontSize: 12,
    color: colors.lightSubtext,
    textAlign: 'center',
    marginTop: 24,
  },
  burstOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  xpBurst: {
    backgroundColor: 'rgba(255,200,69,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  xpBurstText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0b1220',
  },
});
