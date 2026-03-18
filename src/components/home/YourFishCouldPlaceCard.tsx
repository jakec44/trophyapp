import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import Feather from '@expo/vector-icons/Feather';

interface YourFishCouldPlaceCardProps {
  tournamentId: string;
  tournamentTitle: string;
  predictedRank: number;
  userFishMetric: string;
  currentThirdPlaceMetric: string;
  userFishId?: string;
}

export function YourFishCouldPlaceCard({
  tournamentId,
  tournamentTitle,
  predictedRank,
  userFishMetric,
  currentThirdPlaceMetric,
  userFishId,
}: YourFishCouldPlaceCardProps) {
  const router = useRouter();

  const handleEnter = () => {
    router.push(`/tournament/${tournamentId}`);
  };

  const rankEmoji = predictedRank === 1 ? '🥇' : predictedRank === 2 ? '🥈' : '🥉';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🔥</Text>
        <Text style={styles.title}>
          You might place {rankEmoji} #{predictedRank} in {tournamentTitle}
        </Text>
      </View>
      <Text style={styles.subtext}>
        Your {userFishMetric} beats current 3rd place ({currentThirdPlaceMetric})
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleEnter}>
        <Text style={styles.buttonText}>Enter Tournament</Text>
        <Feather name="arrow-right" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  emoji: {
    fontSize: 20,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.lightText,
  },
  subtext: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginBottom: 14,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});
