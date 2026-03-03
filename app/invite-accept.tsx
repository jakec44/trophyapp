/**
 * Deep link: Snagged://invite?token=XYZ
 * Accept Friend Invite screen — when invited user opens app via link
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/utils/colors';

const INVITER_PLACEHOLDER = 'A fellow angler';

export default function InviteAcceptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token;
  const [inviterName, setInviterName] = useState(INVITER_PLACEHOLDER);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: Fetch inviter name from Supabase using token
    if (token) {
      setInviterName(INVITER_PLACEHOLDER);
    }
  }, [token]);

  const handleAccept = () => {
    setLoading(true);
    // TODO: Create friendship in Supabase
    setTimeout(() => {
      setLoading(false);
      router.replace('/(tabs)');
    }, 600);
  };

  const handleDecline = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconEmoji}>🤝</Text>
        </View>
        <Text style={styles.title}>{inviterName} wants to add you</Text>
        <Text style={styles.subtitle}>
          Connect as friends to share catches and compete in challenges.
        </Text>

        <View style={styles.actions}>
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
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={handleDecline}
            disabled={loading}
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
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
