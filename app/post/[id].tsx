import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/utils/colors';
import {
  getFeedPostById,
  getPublicUrl,
  getProfileDisplayName,
  getAvatarUrlWithCacheBust,
  MEDIA_BUCKET,
  type FeedPostWithProfile,
} from '@/src/lib/supabase';
import { getLevelFromXp } from '@/src/types/gamification';
import type { FeedPost } from '@/utils/feedMockData';
import { FeedPostCard } from '@/src/components/home/FeedPostCard';
import { Ionicons } from '@expo/vector-icons';

function isPro(p: { subscription_plan?: string | null; pro_expires_at?: string | null } | null): boolean {
  if (!p) return false;
  if (p.subscription_plan !== 'pro') return false;
  if (p.pro_expires_at && new Date(p.pro_expires_at) <= new Date()) return false;
  return true;
}

function rowToFeedPost(row: FeedPostWithProfile): FeedPost {
  const p = row.profiles;
  const username = getProfileDisplayName(p);
  const rawAvatar = p?.avatar_url;
  const updatedAt = (p as { updated_at?: string } | null)?.updated_at;
  const avatar = rawAvatar
    ? getAvatarUrlWithCacheBust(rawAvatar, updatedAt) ?? (rawAvatar.startsWith('http') ? rawAvatar : getPublicUrl(MEDIA_BUCKET, rawAvatar))
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.user_id}`;
  const mediaPaths = (row as { media_paths?: string[] | null }).media_paths ?? null;
  const photoUrl = row.photo_path
    ? getPublicUrl(MEDIA_BUCKET, row.photo_path)
    : (row.photo_url ?? '');
  const mediaUrls =
    mediaPaths && mediaPaths.length > 0
      ? mediaPaths.map((path) => getPublicUrl(MEDIA_BUCKET, path))
      : undefined;
  return {
    id: row.id,
    userId: row.user_id,
    username,
    avatar,
    postedAt: row.created_at,
    photoUrl: mediaUrls?.[0] ?? photoUrl,
    mediaUrls,
    caption: row.caption ?? undefined,
    species: row.species ?? '',
    weight: row.weight_lb ?? 0,
    length: row.length_in ?? undefined,
    location: row.location ?? '',
    locationLabel: '',
    feedSource: 'friend',
    hypeCount: row.hype_count ?? 0,
    commentCount: row.comment_count ?? 0,
    shareCount: row.share_count ?? 0,
    isHyped: false,
    comments: [],
    proVerified: isPro(p),
    authorLevel: p?.total_xp != null ? getLevelFromXp(p.total_xp).level : undefined,
    authorAnglerRating: p?.angler_rating ?? undefined,
  };
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    getFeedPostById(id)
      .then((row) => {
        if (cancelled) return;
        setPost(row ? rowToFeedPost(row) : null);
        setError(!row);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </TouchableOpacity>
          <SnaggedWordmark />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accentBlue} />
          <Text style={styles.loadingText}>Loading post...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.ink} />
          </TouchableOpacity>
          <SnaggedWordmark />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Post not found</Text>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <SnaggedWordmark />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { minWidth: screenWidth }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardWrap}>
          <FeedPostCard
            post={post}
            isScreenFocused
            shouldPlayVideo
            onHype={() => {}}
            onAddComment={() => {}}
            onShare={() => {}}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
    backgroundColor: colors.lightBackground,
  },
  backBtn: { marginRight: 8, padding: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 16, color: colors.subtext },
  errorText: { fontSize: 16, color: colors.subtext },
  backLink: { marginTop: 16 },
  backLinkText: { fontSize: 16, color: colors.accentBlue },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  cardWrap: { width: '100%' },
});
