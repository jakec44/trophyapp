import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';
import { signInWithApple } from '@/src/lib/supabase';

export type AuthGateAction =
  | 'log_catch'
  | 'enter_tournament'
  | 'hype_comment'
  | 'view_rank'
  | 'view_profile'
  | 'onboarding_first_catch';

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
  view_profile: {
    title: 'Sign in to view your profile',
    message: 'Sign in to set up your profile, see your stats, and edit your username and photo.',
  },
  onboarding_first_catch: {
    title: 'Save Your Catch',
    message: 'Sign in to save your fish and start your profile.',
  },
};

interface AuthGateModalProps {
  visible: boolean;
  onClose: () => void;
  action: AuthGateAction;
}

export function AuthGateModal({ visible, onClose, action }: AuthGateModalProps) {
  const router = useRouter();
  const [appleLoading, setAppleLoading] = useState(false);
  const { title, message } = MESSAGES[action];
  const blocking = action === 'onboarding_first_catch';

  const handleAppleSignIn = async () => {
    const available = Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
    if (!available) {
      router.push('/(auth)/login');
      onClose();
      return;
    }
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { identityToken, fullName } = credential;
      if (!identityToken) {
        Alert.alert('Sign In Failed', 'No identity token received from Apple.');
        return;
      }
      await signInWithApple(identityToken, fullName ?? undefined);
      onClose();
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      const msg = (e as { message?: string })?.message ?? '';
      const isProviderDisabled = msg.includes('not enabled') || msg.includes('Provider');
      Alert.alert(
        'Sign In Failed',
        isProviderDisabled
          ? 'Apple Sign-In is not configured. Use email sign-in below.'
          : 'Apple Sign-In failed. Please try again or use email.'
      );
      if (!isProviderDisabled) console.error('Apple Sign-In error:', e);
    } finally {
      setAppleLoading(false);
    }
  };

  const handleEmailSignIn = () => {
    onClose();
    router.push('/(auth)/login');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={blocking ? undefined : onClose}
    >
      <Pressable style={styles.backdrop} onPress={blocking ? undefined : onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close"
          >
            <Feather name="x" size={24} color={colors.lightSubtext} />
          </TouchableOpacity>
          <View style={styles.iconWrap}>
            <Feather name="log-in" size={32} color={colors.accentBlue} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            {Platform.OS === 'ios' && (
              <>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={styles.appleButton}
                  onPress={handleAppleSignIn}
                  disabled={appleLoading}
                />
                {appleLoading && (
                  <ActivityIndicator size="small" color={colors.accentBlue} style={styles.loader} />
                )}
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleEmailSignIn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryBtnText}>Sign in with email</Text>
                </TouchableOpacity>
              </>
            )}
            {Platform.OS !== 'ios' && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleEmailSignIn}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Sign in with email</Text>
              </TouchableOpacity>
            )}
            {!blocking && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryBtnText}>Maybe Later</Text>
              </TouchableOpacity>
            )}
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
    position: 'relative',
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
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
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
  appleButton: {
    width: '100%',
    height: 50,
  },
  loader: {
    marginVertical: 4,
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
