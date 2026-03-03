import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';

export function WelcomeBanner() {
  const router = useRouter();

  const handleLogFish = () => {
    router.push('/camera');
  };

  return (
    <View style={styles.banner}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.message}>
          Log your first fish and enter a competition.
        </Text>
        <TouchableOpacity style={styles.ctaBtn} onPress={handleLogFish} activeOpacity={0.9}>
          <Feather name="camera" size={14} color={colors.accentBlue} />
          <Text style={styles.ctaText}>Log a catch</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    borderLeftWidth: 4,
    borderLeftColor: colors.accentBlue,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accentBlue,
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.lightText,
    marginBottom: 8,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(74, 144, 226, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accentBlue,
  },
});
