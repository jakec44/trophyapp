/**
 * Daily quests: progress for today, completion state. XP awarded on claim (tap).
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuthContext } from '@/src/context/AuthContext';
import { useGamificationContext } from '@/src/context/GamificationContext';
import {
  getDailyProgress,
  markQuestXpAwarded,
  getTodayKey,
  getNextResetAt,
  formatCountdown,
  DAILY_QUESTS,
  isQuestComplete,
  type DailyQuestProgressRow,
} from '@/src/lib/dailyQuests';

export interface QuestState {
  id: string;
  title: string;
  xp: number;
  complete: boolean;
  claimed: boolean;
  current?: number;
  target?: number;
}

export function useDailyQuests() {
  const { user } = useAuthContext();
  const gamification = useGamificationContext();
  const userId = user?.id ?? null;

  const [progress, setProgress] = useState<DailyQuestProgressRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProgress(null);
      setLoading(false);
      return;
    }
    const today = getTodayKey();
    setLoading(true);
    try {
      const row = await getDailyProgress(userId, today);
      setProgress(row);
    } catch (e) {
      console.error('[useDailyQuests] refresh', e);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Claim a completed quest: awards XP and marks as claimed. Returns XP amount for animation. */
  const claimQuest = useCallback(
    async (questId: string): Promise<number | null> => {
      if (!userId || !gamification?.addXp) return null;
      const quest = DAILY_QUESTS.find((q) => q.id === questId);
      if (!quest) return null;
      const { complete } = isQuestComplete(progress, questId);
      if (!complete || progress?.xp_awarded_quest_ids.includes(questId)) return null;

      gamification.addXp(quest.xp);
      await markQuestXpAwarded(userId, questId, getTodayKey());
      await refresh();
      return quest.xp;
    },
    [userId, progress, gamification?.addXp, refresh]
  );

  const quests: QuestState[] = DAILY_QUESTS.map((q) => {
    const { complete, current, target } = isQuestComplete(progress, q.id);
    const claimed = progress?.xp_awarded_quest_ids.includes(q.id) ?? false;
    return {
      id: q.id,
      title: q.title,
      xp: q.xp,
      complete,
      claimed,
      current,
      target,
    };
  });

  const claimableCount = quests.filter((q) => q.complete && !q.claimed).length;
  const countdown = useDailyQuestCountdown();

  return {
    progress,
    quests,
    claimableCount,
    countdown,
    loading,
    refresh,
    claimQuest,
  };
}

/** Live countdown until next 6 AM reset. Updates every second. */
export function useDailyQuestCountdown(): string {
  const [countdown, setCountdown] = useState(() => {
    const next = getNextResetAt();
    return formatCountdown(next.getTime() - Date.now());
  });

  useEffect(() => {
    const tick = () => {
      const next = getNextResetAt();
      setCountdown(formatCountdown(next.getTime() - Date.now()));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return countdown;
}
