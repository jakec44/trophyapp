import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/utils/colors';
import { getCatchById, getProfileDisplayName } from '@/src/lib/supabase';
import { isValidImageUri } from '@/src/lib/imageUri';
import { useLogbookPrefs } from '@/src/hooks/useLogbookPrefs';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';

const GOLD = colors.gold;
const ACCENT_BLUE = colors.accentBlue;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CatchDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isFavorite, toggleFavorite } = useLogbookPrefs();
  const [catchData, setCatchData] = useState<{
    id: string;
    species: string;
    weight_lb: number;
    length_in?: number;
    photo_url?: string;
    location?: string;
    taken_at?: string;
    notes?: string;
    user_id: string;
    profiles?: { name?: string; display_name?: string; avatar_url?: string; username?: string } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }
    const isUuid = UUID_REGEX.test(id);
    if (!isUuid) {
      setError(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    getCatchById(id).then((data) => {
      if (cancelled) return;
      setCatchData(data as typeof catchData);
      setError(!data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <SnaggedWordmark />
        </View>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={ACCENT_BLUE} />
          <Text style={styles.loadingText}>Loading catch...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !catchData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <SnaggedWordmark />
        </View>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Catch not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const profile =
    catchData.profiles && Array.isArray(catchData.profiles)
      ? catchData.profiles[0]
      : catchData.profiles;
  const displayName = getProfileDisplayName(profile);
  const avatarUrl = profile?.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${catchData.user_id}`;

  const weightStr = catchData.weight_lb > 0 ? `${catchData.weight_lb.toFixed(1)} lbs` : '';
  const lengthStr = (catchData.length_in ?? 0) > 0 ? `${catchData.length_in}"` : '';
  const metricStr = [weightStr, lengthStr].filter(Boolean).join(' · ') || '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <View style={styles.headerBar}>
        <Text style={styles.headerSnagged}>Snagged</Text>
        {id && (
          <TouchableOpacity
            onPress={() => toggleFavorite(id)}
            style={styles.favoriteBtn}
            hitSlop={12}
          >
            <Ionicons
              name={isFavorite(id) ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite(id) ? GOLD : colors.lightSubtext}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.imageWrap}>
          {isValidImageUri(catchData.photo_url) ? (
            <Image
              source={{ uri: catchData.photo_url }}
              style={styles.fishImage}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.fishImage, styles.fishPlaceholder]}>
              <Ionicons name="fish-outline" size={80} color={colors.lightSubtext} />
            </View>
          )}
        </View>

        <Text style={styles.species}>{catchData.species || 'Unknown'}</Text>
        <Text style={styles.metric}>{metricStr}</Text>
        {catchData.location && (
          <Text style={styles.location}>{catchData.location}</Text>
        )}
        {catchData.notes && (
          <Text style={styles.notes}>{catchData.notes}</Text>
        )}

        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push(`/user/${catchData.user_id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.profileRow}>
            {isValidImageUri(avatarUrl) ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.lightBorder, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={24} color={colors.lightSubtext} />
              </View>
            )}
            <View>
              <Text style={styles.username}>{displayName}</Text>
              <Text style={styles.tapHint}>Tap to view profile</Text>
            </View>
            <Feather name="chevron-right" size={22} color={colors.lightSubtext} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  favoriteBtn: {
    padding: 4,
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.lightSubtext,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1.2,
    maxHeight: 320,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  fishImage: {
    width: '100%',
    height: '100%',
  },
  fishPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  species: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.lightText,
    marginBottom: 6,
  },
  metric: {
    fontSize: 20,
    fontWeight: '800',
    color: GOLD,
    marginBottom: 6,
  },
  location: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginBottom: 12,
  },
  notes: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginBottom: 24,
    textAlign: 'center',
  },
  profileButton: {
    width: '100%',
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: colors.lightBorder,
  },
  username: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.lightText,
  },
  tapHint: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 2,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.lightSubtext,
  },
});
