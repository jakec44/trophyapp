/**
 * Profile Wins sheet — scrollable list of tournament win cards.
 * Each card shows: place, tournament name, and the fish entered (photo, species, weight/length).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { TournamentResult } from '@/src/types/tournamentResults';
import { WinCard } from '@/src/components/profile/WinCard';

const { width: SW } = Dimensions.get('window');
const CARD_PADDING = 16;
const CARD_WIDTH = SW - CARD_PADDING * 2;

export interface ProfileWinsSheetProps {
  visible: boolean;
  results: TournamentResult[];
  onClose: () => void;
}

export function ProfileWinsSheet({ visible, results, onClose }: ProfileWinsSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.sheet, { maxHeight: winH * 0.85 }]}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
            <Text style={styles.title}>Tournament Wins</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.lightText} />
            </TouchableOpacity>
          </View>

          {results.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={56} color={colors.lightSubtext} />
              <Text style={styles.emptyTitle}>No wins yet</Text>
              <Text style={styles.emptySub}>Place 1st–5th in a tournament to see your win cards here.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={true}
            >
              {results.map((r) => (
                <View key={r.id} style={styles.cardWrap}>
                  <WinCard result={r} />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.lightBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  handle: {
    position: 'absolute',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lightBorder,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.lightText,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 12,
    padding: 4,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: CARD_PADDING,
    paddingTop: 20,
    gap: 16,
  },
  cardWrap: {
    width: CARD_WIDTH,
    alignSelf: 'center',
  },
  empty: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
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
});
