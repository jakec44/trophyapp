/**
 * Profile tournaments section: "Global" label, "Ending soon" helper.
 * Shows global tournaments sorted by soonest end time.
 */

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import { fetchGlobalTournamentsEndingSoon } from '@/src/api/tournaments';
import type { Tournament } from '@/src/types/tournaments';
import { TournamentPreviewCard } from '@/src/components/home/TournamentPreviewCard';
import Feather from '@expo/vector-icons/Feather';

const GOLD = colors.gold;

export function ProfileTournamentsSection() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await fetchGlobalTournamentsEndingSoon(5);
      if (!cancelled) setTournaments(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleVote = async (_entryId: string, _vote: 'UP' | 'DOWN' | null) => {
    // Placeholder - profile tournaments are read-only preview
    setVoteLoading(_entryId);
    await new Promise((r) => setTimeout(r, 300));
    setVoteLoading(null);
  };

  if (loading) {
    return (
      <View style={styles.section}>
        <View style={styles.header}>
          <Text style={styles.label}>Global</Text>
          <Text style={styles.helper}>Ending soon</Text>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={GOLD} />
        </View>
      </View>
    );
  }

  if (tournaments.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.header}>
          <Text style={styles.label}>Global</Text>
          <Text style={styles.helper}>Ending soon</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No active tournaments</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.label}>Global</Text>
        <Text style={styles.helper}>Ending soon</Text>
      </View>

      <View style={styles.cards}>
        {tournaments.map((t) => (
          <View key={t.id} style={styles.cardWrap}>
            <TournamentPreviewCard
              tournament={t}
              onVote={handleVote}
              voteLoading={voteLoading}
              compact
            />
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.viewAllButton}
        onPress={() => router.push('/(tabs)/tournaments')}
      >
        <Text style={styles.viewAllText}>More competitions</Text>
        <Feather name="chevron-right" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  header: {
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.lightText,
  },
  helper: {
    fontSize: 13,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  emptyText: {
    fontSize: 14,
    color: colors.lightSubtext,
  },
  cards: {
  },
  cardWrap: {
    marginBottom: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accentBlue,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
