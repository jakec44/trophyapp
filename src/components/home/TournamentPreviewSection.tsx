import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';
import type { Tournament } from '@/src/types/tournaments';
import { TournamentPreviewCard } from './TournamentPreviewCard';
interface TournamentPreviewSectionProps {
  tournaments: Tournament[];
  onVote: (entryId: string, vote: 'UP' | 'DOWN' | null) => void;
  voteLoading: string | null;
}

function LiveTitle() {
  return (
    <View style={liveStyles.header}>
      <Text style={liveStyles.titleText} numberOfLines={2}>
        🏆 Live Global /{'\n'}Local Tournaments
      </Text>
    </View>
  );
}

const liveStyles = StyleSheet.create({
  header: {
    marginBottom: 8,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brightBlue,
    lineHeight: 17,
  },
});

export function TournamentPreviewSection({
  tournaments,
  onVote,
  voteLoading,
}: TournamentPreviewSectionProps) {
  const router = useRouter();
  const [scope, setScope] = useState<'global' | 'local'>('global');
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = scope === 'global'
    ? tournaments.filter((t) => t.title.toLowerCase().includes('global'))
    : tournaments.filter((t) => !t.title.toLowerCase().includes('global'));
  const active = filtered[activeIndex] ?? filtered[0];

  return (
    <View style={styles.section}>
      <View style={styles.box}>
        <LiveTitle />

        {/* Global / Local filter */}
        <View style={styles.scopeTabs}>
          <TouchableOpacity
            style={[styles.scopeTab, scope === 'global' && styles.scopeTabActive]}
            onPress={() => { setScope('global'); setActiveIndex(0); }}
          >
            <Text numberOfLines={1} style={[styles.scopeTabText, scope === 'global' && styles.scopeTabTextActive]}>
              Global
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scopeTab, scope === 'local' && styles.scopeTabActive]}
            onPress={() => { setScope('local'); setActiveIndex(0); }}
          >
            <Text numberOfLines={1} style={[styles.scopeTabText, scope === 'local' && styles.scopeTabTextActive]}>
              Local
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabs to switch tournament */}
        <View style={styles.tabs}>
          {filtered.map((t, idx) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, activeIndex === idx && styles.tabActive]}
              onPress={() => setActiveIndex(idx)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeIndex === idx && styles.tabTextActive,
                ]}
                numberOfLines={1}
              >
                {t.title.replace('Global ', '').replace('Local ', '')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Single preview for active tournament */}
        {active && (
          <TournamentPreviewCard
            tournament={active}
            onVote={onVote}
            voteLoading={voteLoading}
            compact
          />
        )}

        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => router.push('/(tabs)/tournaments')}
        >
          <Text style={styles.viewAllText}>More competitions</Text>
          <Feather name="chevron-right" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  box: {
    backgroundColor: colors.lightCardBlue,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.2)',
  },
  scopeTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  scopeTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  scopeTabActive: {
    backgroundColor: colors.accentBlue,
  },
  scopeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.lightSubtext,
  },
  scopeTabTextActive: {
    color: '#FFFFFF',
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.accentBlue,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accentBlue,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
