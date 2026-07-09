/**
 * Simple modal explaining how tournaments work. Shown from Compete tab "About" button.
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '@/utils/colors';

interface TournamentsAboutModalProps {
  visible: boolean;
  onClose: () => void;
}

const BULLET = '\u2022';

export function TournamentsAboutModal({ visible, onClose }: TournamentsAboutModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.modalContent}>
          <View style={styles.card}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
            >
              <Text style={styles.title}>How tournaments work</Text>
              <Text style={styles.paragraph}>
                {BULLET} Enter one fish per tournament. Your entry is your single catch for that competition.
              </Text>
              <Text style={styles.paragraph}>
                {BULLET} Entries are public. Other anglers can see your catch and verify it.
              </Text>
              <Text style={styles.paragraph}>
                {BULLET} Users vote to verify fish. Suspicious or fake entries can be downvoted; 50%+ downvotes may remove an entry.
              </Text>
              <Text style={styles.paragraph}>
                {BULLET} Obviously fake entries can be removed and may result in a ban from tournaments.
              </Text>
              <Text style={styles.paragraph}>
                {BULLET} Log catches to build your Snagged rank. Rankings use your best fish by species and your overall trophy score.
              </Text>
              <Text style={styles.paragraph}>
                {BULLET} Global shows everyone; Local filters by your region/state so you can compete with nearby anglers.
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    height: '80%',
    maxWidth: 400,
    width: '100%',
  },
  card: {
    flex: 1,
    backgroundColor: colors.lightCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 14,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.lightSubtext,
    marginBottom: 12,
  },
  closeBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.accentBlue,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
