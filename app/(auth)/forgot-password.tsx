import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { colors } from '@/utils/colors';
import { resetPasswordForEmail } from '@/src/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 44) + 16;

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const handleSubmit = async () => {
    const trimEmail = email.trim();
    if (!trimEmail) {
      showAlert('Missing Email', 'Please enter your email address.');
      return;
    }
    if (!EMAIL_REGEX.test(trimEmail)) {
      showAlert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordForEmail(trimEmail);
      setSent(true);
      showAlert(
        'Check Your Email',
        'If an account exists for this email, you will receive a password reset link.'
      );
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? String(e);
      showAlert('Reset Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a link to reset your password.
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.lightSubtext}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!sent}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading || sent}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Sending...' : sent ? 'Email Sent' : 'Send Reset Link'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggle}>
            <Text style={styles.toggleText}>Remember your password? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity>
                <Text style={styles.toggleLink}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },
  keyboardWrap: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  header: { marginBottom: 32, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: colors.gold, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.lightSubtext, textAlign: 'center', paddingHorizontal: 16 },
  form: { marginBottom: 24, gap: 16 },
  input: {
    backgroundColor: colors.lightCard,
    borderColor: colors.lightBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.lightText,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  buttonDisabled: { opacity: 0.7 },
  toggle: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  toggleText: { color: colors.lightSubtext, fontSize: 14 },
  toggleLink: { color: colors.gold, fontSize: 14, fontWeight: '600' },
});
