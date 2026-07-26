/**
 * Rankings tab — Global / Local species leaderboards.
 * Species: Bass, Tarpon, Snook, Bluegill, Jack Crevalle, Catfish.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { useAuthContext } from '@/src/context/AuthContext';
import {
  getSpeciesLeaderboard,
  getAvatarUrlWithCacheBust,
  updateUserProfile,
  type SpeciesLeaderboardRow,
} from '@/src/lib/supabase';
import { GlobalLocalScopeToggle, type RankingsScope } from '@/src/components/rankings/GlobalLocalScopeToggle';
import { SpeciesCategoryTabs } from '@/src/components/rankings/SpeciesCategoryTabs';
import {
  SPECIES_LEADERBOARD_OPTIONS,
  type SpeciesLeaderboardSpecies,
} from '@/src/lib/snaggedRank';
import { useLocationState } from '@/src/hooks/useLocationState';
import { colors } from '@/utils/colors';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';

const GOLD = '#FFC845';
const SILVER = '#a8c4d4';
const BRONZE = '#c87941';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isNarrow = SCREEN_WIDTH < 420;

export default function RankingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const topPadding = Math.max(4, insets.top - 4);
  const bottomPadding = useBottomSafePadding();

  const [scope, setScope] = useState<RankingsScope>('global');
  const [species, setSpecies] = useState<SpeciesLeaderboardSpecies>('bass');
  const [rows, setRows] = useState<SpeciesLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarCacheBust, setAvatarCacheBust] = useState(0);
  const { state: locationState, fetchStateFromLocation } = useLocationState();

  const stateFilter = scope === 'local' ? (locationState ?? user?.state ?? null) : null;
  const speciesMeta = SPECIES_LEADERBOARD_OPTIONS.find((s) => s.id === species);

  const handleScopeChange = useCallback(
    async (next: RankingsScope) => {
      if (next === 'local' && !locationState) {
        const stateFromLoc = await fetchStateFromLocation();
        if (stateFromLoc && user?.id) {
          try {
            await updateUserProfile(user.id, { state: stateFromLoc });
          } catch (e) {
            console.error('Failed to save state to profile:', e);
          }
        }
      }
      setScope(next);
    },
    [locationState, fetchStateFromLocation, user?.id]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const effectiveScope = scope === 'local' && !stateFilter ? 'global' : scope;
      const effectiveState = scope === 'local' ? stateFilter : null;
      const list = await getSpeciesLeaderboard(
        species,
        effectiveScope,
        effectiveState,
        user?.id ?? null,
        10000
      );
      setRows(list);
      setAvatarCacheBust(Date.now());
    } catch (e) {
      console.error('[Rankings] load error', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope, stateFilter, species, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: GOLD, text: '#1a1000' };
    if (rank === 2) return { bg: SILVER, text: '#0a1018' };
    if (rank === 3) return { bg: BRONZE, text: '#1a0a00' };
    return { bg: 'rgba(255,255,255,0.08)', text: colors.textFaint };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator
      >
        <View style={styles.header}>
          <Text style={styles.title}>RANKINGS</Text>
          <Text style={styles.subtitle}>
            Best {speciesMeta?.label ?? 'fish'} · {scope === 'local' ? 'Local' : 'Global'}
          </Text>
        </View>

        <GlobalLocalScopeToggle
          value={scope}
          onChange={handleScopeChange}
          localLabel={stateFilter ?? undefined}
        />
        {scope === 'local' && !stateFilter && (
          <Text style={styles.localHint}>Enable location to see local rankings</Text>
        )}

        <SpeciesCategoryTabs value={species} onChange={setSpecies} />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={GOLD} />
          </View>
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>
            No {speciesMeta?.label?.toLowerCase() ?? 'fish'} catches yet. Log one to take the lead!
          </Text>
        ) : (
          <View style={styles.listWrap}>
            {rows.map((r) => {
              const rankStyle = getRankStyle(r.rank);
              const isYou = user?.id === r.id;
              const name = r.display_name?.trim() || r.username?.trim() || 'Angler';
              const avUrl = getAvatarUrlWithCacheBust(r.avatar_url, avatarCacheBust);
              const fishUrl = r.photo_url?.trim() || null;
              return (
                <TouchableOpacity
                  key={`${r.id}-${r.catch_id ?? r.rank}`}
                  style={[styles.row, isYou && styles.rowYou]}
                  onPress={() => {
                    if (r.catch_id) router.push(`/catch/${r.catch_id}`);
                    else router.push(`/user/${r.id}`);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rankBadge, { backgroundColor: rankStyle.bg }]}>
                    <Text style={[styles.rankBadgeText, { color: rankStyle.text }]}>{r.rank}</Text>
                  </View>
                  <View style={styles.avatarWrap}>
                    {avUrl ? (
                      <Image source={{ uri: avUrl }} style={styles.avatar} resizeMode="cover" />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Ionicons name="person" size={16} color={colors.textFaint} />
                      </View>
                    )}
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.username} numberOfLines={1}>
                      {name}
                    </Text>
                    {r.state ? <Text style={styles.meta}>{r.state}</Text> : null}
                  </View>
                  <View style={styles.metricCol}>
                    {fishUrl ? (
                      <Image source={{ uri: fishUrl }} style={styles.fishThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.fishThumb, styles.fishThumbPlaceholder]}>
                        <Ionicons name="fish" size={22} color={colors.textFaint} />
                      </View>
                    )}
                    <Text style={styles.metricValue}>
                      {Number(r.metric_value).toFixed(1)} {r.metric_unit}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020b14' },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: isNarrow ? 12 : 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 26,
    color: GOLD,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 4,
    fontWeight: '600',
  },
  localHint: {
    fontSize: 12,
    color: colors.textFaint,
    textAlign: 'center',
    marginBottom: 10,
  },
  loadingWrap: { paddingVertical: 48, alignItems: 'center' },
  empty: {
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: 14,
    marginTop: 32,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  listWrap: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightCard,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    gap: 10,
  },
  rowYou: {
    borderColor: colors.teal,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  avatarWrap: {},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 2,
  },
  metricCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fishThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  fishThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: GOLD,
    minWidth: 58,
    textAlign: 'right',
  },
});
