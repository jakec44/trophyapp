import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';

export type AuthGateAction =
  | 'log_catch'
  | 'enter_tournament'
  | 'hype_comment'
  | 'view_rank';

const MESSAGES: Record<AuthGateAction, { title: string; message: string }> = {
  log_catch: {
    title: 'Create account to log your catch',
    message: 'Join the leaderboard and start competing. Sign in to save your catches.',
  },
  enter_tournament: {
    title: 'Create account to compete',
    message: 'Enter tournaments and climb the leaderboard. Sign in to join.',
  },
  hype_comment: {
    title: 'Create account to interact',
    message: 'Hype catches and join the community. Sign in to participate.',
  },
  view_rank: {
    title: 'Create account to get your ranking',
    message: 'See where you stand and track your progress. Sign in to view your rank.',
  },
};

interface AuthGateModalProps {
  visible: boolean;
  onClose: () => void;
  action: AuthGateAction;
}

export function AuthGateModal({ visible, onClose, action }: AuthGateModalProps) {
  const router = useRouter();
  const { title, message } = MESSAGES[action];

  const handleCreateAccount = () => {
    onClose();
    router.push('/(auth)/login');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Feather name="log-in" size={32} color={colors.accentBlue} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleCreateAccount}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.lightCard,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lightBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.accentBlue}18`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.lightText,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: colors.lightSubtext,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: colors.brightBlue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
});
