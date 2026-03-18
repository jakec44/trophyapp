/**
 * Web-specific login screen - avoids expo-apple-authentication which doesn't support web.
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 44) + 16;

  const handleSubmit = () => {
    // Web login: wire to signIn/signUp when ready. Do not log credentials.
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardWrap} behavior="padding">
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: topPadding }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Snagged</Text>
            <Text style={styles.subtitle}>The App for Anglers</Text>
          </View>

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

            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
              <Text style={styles.buttonText}>
                {isSignUp ? 'Create Account' : 'Sign In with Email'}
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
