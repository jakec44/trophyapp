import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { colors } from '@/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';

const GOLD = colors.gold;

interface TournamentCelebrationModalProps {
  visible: boolean;
  place: 1 | 2 | 3;
  tournamentName: string;
  onDismiss: () => void;
}

const PLACE_EMOJI = { 1: '🥇', 2: '🥈', 3: '🥉' };
const PLACE_LABEL = { 1: '1st Place', 2: '2nd Place', 3: '3rd Place' };

export function TournamentCelebrationModal({
  visible,
  place,
  tournamentName,
  onDismiss,
}: TournamentCelebrationModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, scaleAnim]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.emoji}>{PLACE_EMOJI[place]}</Text>
          <Text style={styles.title}>{PLACE_LABEL[place]}!</Text>
          <Text style={styles.tournamentName}>{tournamentName}</Text>
          <Text style={styles.subtitle}>Congratulations on your podium finish!</Text>
          <TouchableOpacity style={styles.button} onPress={onDismiss} activeOpacity={0.9}>
            <Ionicons name="trophy" size={22} color="#1A1A1A" />
            <Text style={styles.buttonText}>Celebrate</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: colors.lightCard,
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    marginHorizontal: 24,
    borderWidth: 3,
    borderColor: GOLD,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: GOLD,
    marginBottom: 8,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightText,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});
