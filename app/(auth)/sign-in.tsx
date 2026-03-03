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
import { signIn } from '@/src/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 44) + 16;

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const validate = (): boolean => {
    const trimEmail = email.trim();
    const trimPass = password.trim();
    if (!trimEmail || !trimPass) {
      setError('Please enter email and password.');
      showAlert('Missing Info', 'Please enter email and password.');
      return false;
    }
    if (!EMAIL_REGEX.test(trimEmail)) {
      setError('Please enter a valid email address.');
      showAlert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }
    if (trimPass.length < 6) {
      setError('Password must be at least 6 characters.');
      showAlert('Invalid Password', 'Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password.trim());
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? String(e);
      const isInvalidCreds =
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('credentials') ||
        msg.toLowerCase().includes('email') ||
        msg.toLowerCase().includes('password');
      const userMsg = isInvalidCreds ? 'Invalid email or password. Please try again.' : msg;
      setError(userMsg);
      showAlert('Sign In Failed', userMsg);
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
            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.subtitle}>Welcome back to Snagged</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.lightSubtext}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(null); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.lightSubtext}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }}
              secureTextEntry
              autoComplete="password"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.forgotLinkText}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={styles.toggle}>
            <Text style={styles.toggleText}>Don't have an account? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity>
                <Text style={styles.toggleLink}>Sign Up</Text>
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
  subtitle: { fontSize: 16, color: colors.lightSubtext },
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
  errorText: { fontSize: 14, color: '#ff6b6b', marginBottom: 8 },
  forgotLink: { alignSelf: 'center', marginBottom: 24 },
  forgotLinkText: { fontSize: 14, color: colors.gold, fontWeight: '600' },
  toggle: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  toggleText: { color: colors.lightSubtext, fontSize: 14 },
  toggleLink: { color: colors.gold, fontSize: 14, fontWeight: '600' },
});
