import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { LEVEL_ROADMAP } from '@/src/types/gamification';

interface LevelRoadmapModalProps {
  visible: boolean;
  onClose: () => void;
  /** Current user level (1–10); placeholder 3 if not yet wired */
  currentLevel?: number;
}

export function LevelRoadmapModal({
  visible,
  onClose,
  currentLevel = 3,
}: LevelRoadmapModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Level Roadmap</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color={colors.lightSubtext} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {LEVEL_ROADMAP.map(({ level, title, xpRequired }) => {
              const isCurrent = level === currentLevel;
              const isUnlocked = level <= currentLevel;
              return (
                <View
                  key={level}
                  style={[
                    styles.row,
                    isCurrent && styles.rowCurrent,
                  ]}
                >
                  <View style={[styles.levelBadge, isCurrent && styles.levelBadgeCurrent]}>
                    <Text style={[styles.levelText, isCurrent && styles.levelTextCurrent]}>
                      {level}
                    </Text>
                  </View>
                  <View style={styles.rowContent}>
                    <Text
                      style={[
                        styles.rowTitle,
                        isCurrent && styles.rowTitleCurrent,
                        !isUnlocked && styles.rowTitleLocked,
                      ]}
                    >
                      {title}
                    </Text>
                    <Text
                      style={[
                        styles.rowXp,
                        isCurrent && styles.rowXpCurrent,
                        !isUnlocked && styles.rowXpLocked,
                      ]}
                    >
                      {xpRequired === 0 ? '0 XP (start)' : `${xpRequired} XP`}
                    </Text>
                  </View>
                  {isCurrent && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youText}>You</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.lightBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 34,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lightBorder,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.lightText,
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  rowCurrent: {
    backgroundColor: colors.lightCardBlue,
    borderColor: colors.accentBlue,
  },
  levelBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  levelBadgeCurrent: {
    backgroundColor: colors.accentBlue,
  },
  levelText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.lightSubtext,
  },
  levelTextCurrent: {
    color: '#FFFFFF',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.lightText,
    marginBottom: 2,
  },
  rowTitleCurrent: {
    color: '#FFFFFF',
  },
  rowTitleLocked: {
    color: colors.lightSubtext,
  },
  rowXp: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  rowXpCurrent: {
    color: 'rgba(255,255,255,0.9)',
  },
  rowXpLocked: {
    color: colors.lightSubtext,
    opacity: 0.7,
  },
  youBadge: {
    backgroundColor: colors.accentBlue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  youText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
