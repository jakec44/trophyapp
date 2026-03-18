/**
 * Deep link: Snagged://invite?token=XYZ
 * Accept Friend Invite screen — token is the invite code.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/utils/colors';
import { useAuthContext } from '@/src/context/AuthContext';
import { redeemInviteCode } from '@/src/lib/supabase';

export default function InviteAcceptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = (params.token as string | undefined)?.trim();
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!token) {
      Alert.alert('Invalid invite', 'This invite link is invalid or expired.');
      return;
    }
    if (!user?.id) {
      router.replace('/(auth)/sign-in');
      return;
    }
    setLoading(true);
    try {
      await redeemInviteCode(token, user.id);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Could not accept', (e as Error).message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    router.back();
  };

  const handleSignIn = () => {
    router.replace('/(auth)/sign-in');
  };

  const needsSignIn = !user?.id;
  const invalidInvite = !token;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconEmoji}>🤝</Text>
        </View>
        {invalidInvite ? (
          <Text style={styles.title}>Invalid invite link</Text>
        ) : (
          <Text style={styles.title}>A fellow angler wants to add you</Text>
        )}
        <Text style={styles.subtitle}>
          {invalidInvite
            ? 'This link may be expired or incorrect.'
            : needsSignIn
              ? 'Sign in to accept and connect as friends.'
              : 'Connect as friends to share catches and compete in challenges.'}
        </Text>

        <View style={styles.actions}>
          {invalidInvite ? (
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
              <Text style={styles.declineBtnText}>Go back</Text>
            </TouchableOpacity>
          ) : needsSignIn ? (
            <TouchableOpacity
              style={[styles.acceptBtn, loading && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              <Text style={styles.acceptBtnText}>Sign in</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.acceptBtn, loading && styles.btnDisabled]}
              onPress={handleAccept}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.acceptBtnText}>Accept</Text>
              )}
            </TouchableOpacity>
          )}
          {!invalidInvite && (
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={handleDecline}
              disabled={loading}
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accentBlue + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.lightText,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: colors.lightSubtext,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  acceptBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  declineBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightSubtext,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
