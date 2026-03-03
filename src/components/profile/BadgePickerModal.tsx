/**
 * Modal to choose which badges to display on profile (max 5).
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { EarnedBadgeItem } from './ProfileHeader';

const MAX_DISPLAY = 5;

interface Props {
  visible: boolean;
  earnedBadges: EarnedBadgeItem[];
  displayedIds: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}

export function BadgePickerModal({
  visible,
  earnedBadges,
  displayedIds,
  onSave,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (visible) setSelected([...displayedIds]);
  }, [visible, displayedIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_DISPLAY) return prev;
      return [...prev, id];
    });
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Display badges</Text>
            <Text style={styles.subtitle}>Choose up to {MAX_DISPLAY} to show on your profile</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.lightSubtext} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {earnedBadges.length === 0 ? (
              <Text style={styles.empty}>No badges earned yet. Level up or place in tournaments!</Text>
            ) : (
              earnedBadges.map((b) => {
                const isSelected = selected.includes(b.id);
                const atMax = selected.length >= MAX_DISPLAY && !isSelected;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.row, atMax && styles.rowDisabled]}
                    onPress={() => !atMax && toggle(b.id)}
                    activeOpacity={0.7}
                    disabled={atMax}
                  >
                    <Text style={styles.rowIcon}>{b.icon}</Text>
                    <Text style={styles.rowLabel} numberOfLines={1}>{b.label}</Text>
                    <View style={[styles.check, isSelected && styles.checkSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#000" />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.lightCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingHorizontal: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lightBorder,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.lightText,
  },
  subtitle: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
  },
  list: {
    maxHeight: 320,
  },
  empty: {
    fontSize: 14,
    color: colors.lightSubtext,
    textAlign: 'center',
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.lightText,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.lightBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  saveBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.teal,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
});
