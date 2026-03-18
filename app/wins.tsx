/**
 * Tournament Wins page — 2 wins per row, scrollable grid.
 * Tap a win to open full card modal with Share.
 */

import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Share,
  FlatList,
  Dimensions,
  useWindowDimensions,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import { useTournamentResults } from '@/src/hooks/useTournamentResults';
import { WinCard } from '@/src/components/profile/WinCard';
import type { TournamentResult } from '@/src/types/tournamentResults';
import { PLACE_PALETTE } from '@/src/types/tournamentResults';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAD = 16;
const GAP = 12;
const COLS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - PAD * 2 - GAP * (COLS - 1)) / COLS;

export default function WinsScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { allResults: results, refresh } = useTournamentResults(user?.id ?? null);
  const [selectedResult, setSelectedResult] = useState<TournamentResult | null>(null);
  const { height: winH } = useWindowDimensions();

  const shareInProgress = useRef(false);
  const handleShare = useCallback(() => {
    if (!selectedResult || shareInProgress.current) return;
    shareInProgress.current = true;
    const palette = PLACE_PALETTE[selectedResult.place];
    const metric =
      selectedResult.unit === 'lbs' && selectedResult.weight_lbs
        ? `${selectedResult.weight_lbs} lbs`
        : selectedResult.length_in
          ? `${selectedResult.length_in} in`
          : '';
    const msg = `🏆 I just placed ${palette.label} in the ${selectedResult.tournament_name} tournament on Snagged!${metric ? ` (${metric})` : ''} 🎣`;
    InteractionManager.runAfterInteractions(() => {
      Share.share({ message: msg }).catch(() => {}).finally(() => { shareInProgress.current = false; });
    });
  }, [selectedResult]);

  const renderItem = useCallback(
    ({ item }: { item: TournamentResult }) => (
      <TouchableOpacity
        style={styles.gridItem}
        activeOpacity={0.85}
        onPress={() => setSelectedResult(item)}
      >
        <WinCard result={item} compact />
      </TouchableOpacity>
    ),
    []
  );

  const keyExtractor = useCallback((item: TournamentResult) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.lightText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tournament Wins</Text>
        <View style={styles.headerRight} />
      </View>

      {results.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="trophy-outline" size={56} color={colors.lightSubtext} />
          <Text style={styles.emptyTitle}>No wins yet</Text>
          <Text style={styles.emptySub}>
            Place 1st–5th in a tournament to see your win cards here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={COLS}
          key="grid"
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={true}
          onRefresh={refresh}
          refreshing={false}
        />
      )}

      {/* Full win card modal with Share */}
      <Modal
        visible={!!selectedResult}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedResult(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCardWrap, { maxHeight: winH * 0.88 }]}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {selectedResult && (
                <WinCard result={selectedResult} onShare={handleShare} />
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setSelectedResult(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.closeModalText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.lightText,
  },
  headerRight: {
    width: 36,
  },
  gridContent: {
    padding: PAD,
    paddingBottom: 32,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  gridItem: {
    width: CARD_WIDTH,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
  },
  emptySub: {
    fontSize: 14,
    color: colors.lightSubtext,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: PAD,
  },
  modalCardWrap: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.lightBackground,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalScroll: {
    maxHeight: '100%',
  },
  modalScrollContent: {
    padding: PAD,
    paddingBottom: 8,
  },
  modalActions: {
    paddingHorizontal: PAD,
    paddingBottom: 24,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
  },
  closeModalBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeModalText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.lightText,
  },
});
