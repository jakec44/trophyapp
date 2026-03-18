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
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signInWithApple, signUp, signIn, isSupabaseConfigured } from '@/src/lib/supabase';
import { isDev } from '@/src/lib/env';

export default function LoginScreen() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [appleLoading, setAppleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 44) + 16;

  const handleSubmit = async () => {
    const trimEmail = email.trim();
    const trimPass = password.trim();

    if (!trimEmail || !trimPass) {
      Alert.alert('Missing Info', 'Please enter email and password.');
      return;
    }
    if (trimPass.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setEmailLoading(true);
    try {
      if (isSignUp) {
        const result = await signUp({
          email: trimEmail,
          password: trimPass,
          displayName: username.trim() || trimEmail.split('@')[0],
        });
        // If session exists (Confirm email off), user is already signed in
        if (result.session) {
          router.replace('/(tabs)');
        } else {
          Alert.alert('Account Created', 'Sign in with your email and password.');
          setIsSignUp(false);
        }
      } else {
        await signIn(trimEmail, trimPass);
        router.replace('/(tabs)');
      }
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? String(e);
      setError(msg);
      Alert.alert(isSignUp ? 'Sign Up Failed' : 'Sign In Failed', msg);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      Alert.alert('Not Available', 'Sign in with Apple is not available on this device.');
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
      router.replace('/(tabs)');
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      const msg = (e as { message?: string })?.message ?? '';
      const isProviderDisabled = msg.includes('not enabled') || msg.includes('Provider');
      const userMessage = isProviderDisabled
        ? 'Apple Sign-In is not configured for this app yet. Please use email sign-in, or try again later.'
        : 'Apple Sign-In was not successful. Please try again.';
      Alert.alert('Sign In Failed', userMessage);
      if (!isProviderDisabled) console.error('Apple Sign-In error:', e);
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Snagged</Text>
          <Text style={styles.subtitle}>The App for Anglers</Text>
          {isDev && (
            <Text style={styles.devBanner}>
              [DEV build from Metro] {isSupabaseConfigured ? 'Supabase: connected' : 'Supabase: not configured — use npm run start:clean'}
            </Text>
          )}
        </View>

        {/* Easy Sign-In: Apple (iOS) */}
        {Platform.OS === 'ios' && (
          <View style={styles.socialSection}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
              disabled={appleLoading}
            />
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>
        )}

        <View style={styles.form}>
          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.lightSubtext}
              value={username}
              onChangeText={setUsername}
              editable
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.lightSubtext}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.lightSubtext}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, emailLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={emailLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {emailLoading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In with Email'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toggle}>
          <Text style={styles.toggleText}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          </Text>
          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
            <Text style={styles.toggleLink}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  keyboardWrap: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 48,
    color: '#00e5c8',
    marginBottom: 8,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.lightSubtext,
  },
  devBanner: {
    marginTop: 12,
    fontSize: 12,
    color: colors.lightSubtext,
  },
  socialSection: {
    marginBottom: 24,
  },
  appleButton: {
    width: '100%',
    height: 50,
    marginBottom: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.lightBorder,
  },
  dividerText: {
    marginHorizontal: 16,
    color: colors.lightSubtext,
    fontSize: 14,
  },
  form: {
    marginBottom: 24,
    gap: 16,
  },
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
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    color: colors.lightSubtext,
    fontSize: 14,
  },
  toggleLink: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
});
