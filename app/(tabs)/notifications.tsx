import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <View style={styles.header}>
        <SnaggedWordmark />
        <Text style={styles.title}>Notifications</Text>
      </View>

      <View style={styles.empty}>
        <Ionicons name="notifications-off-outline" size={48} color={colors.lightSubtext} />
        <Text style={styles.emptyText}>No notifications yet</Text>
        <Text style={styles.emptySubtext}>
          Activity and updates will appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
    marginRight: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.lightText,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.lightText,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 17,
    color: colors.lightSubtext,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 24,
  },
});
