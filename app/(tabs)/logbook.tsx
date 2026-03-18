import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  RefreshControl,
} from 'react-native';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/utils/colors';
import { type Catch } from '@/utils/mockData';
import { useAuthContext } from '@/src/context/AuthContext';
import { getUserCatches, getUserProfile, updateUserProfile } from '@/src/lib/supabase';
import { getPendingActions } from '@/src/lib/pendingActions';
import { useLogbookPrefs } from '@/src/hooks/useLogbookPrefs';
import { useGamificationContext } from '@/src/context/GamificationContext';
import { PASSPORT_SPECIES } from '@/utils/gamificationData';
import { findPassportSpeciesId } from '@/src/lib/speciesMapper';
import { CatchCard } from '@/src/components/logbook/CatchCard';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';

const GOLD = colors.gold;
const BRIGHT_BLUE = colors.brightBlue;

/** Map DB catch row to Catch type */
function mapDbCatchToCatch(row: {
  id: string;
  species: string;
  weight_lb: number;
  length_in?: number;
  location?: string;
  notes?: string;
  photo_url?: string;
  taken_at?: string;
  ai_status?: string;
  fish_nickname?: string | null;
  [key: string]: unknown;
}): Catch {
  return {
    id: row.id,
    species: row.species || 'Unknown',
    weight: row.weight_lb ?? 0,
    length: row.length_in ?? 0,
    location: row.location ?? '',
    date: row.taken_at ?? new Date().toISOString(),
    photo: row.photo_url ?? '',
    notes: row.notes,
    name: row.fish_nickname ?? undefined,
    ai_status: (row.ai_status as 'pending' | 'done' | 'failed') ?? 'done',
  };
}

function getSpeciesCategory(species: string): 'freshwater' | 'saltwater' {
  const pid = findPassportSpeciesId(species);
  if (pid) {
    const match = PASSPORT_SPECIES.find((s) => s.id === pid);
    if (match) return match.category as 'freshwater' | 'saltwater';
  }
  // Fallback: default to saltwater for unrecognised species
  return 'saltwater';
}

type FilterType = 'all' | 'freshwater' | 'saltwater';

type LogbookVisibility = 'public' | 'friends' | 'private';

export default function LogbookScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const gamification = useGamificationContext();
  const bottomPadding = useBottomSafePadding();
  const {
    logbookName,
    setLogbookName,
    toggleFavorite,
    isFavorite,
    favoritesFilterOn,
    setFavoritesFilterOn,
  } = useLogbookPrefs();

  const [catches, setCatches] = useState<Catch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCatches = useCallback(async () => {
    try {
      if (user?.id) {
        const { data } = await getUserCatches(user.id, 100, 0);
        setCatches(data.map(mapDbCatchToCatch));
      } else {
        const pending = await getPendingActions();
        const pendingCatches: Catch[] = pending
          .filter((a): a is { type: 'CREATE_CATCH'; id: string; payload: { species: string; weight_lb: number; length_in?: number; notes?: string; photoUri?: string; taken_at: string }; createdAt: string } => a.type === 'CREATE_CATCH')
          .map((a) => ({
            id: a.id,
            species: a.payload.species,
            weight: a.payload.weight_lb,
            length: a.payload.length_in ?? 0,
            location: '',
            date: a.payload.taken_at,
            photo: a.payload.photoUri ?? '',
            notes: a.payload.notes,
            ai_status: 'done' as const,
          }));
        setCatches(pendingCatches);
      }
    } catch (e) {
      console.error('Load catches error:', e);
      setCatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCatches();
    }, [loadCatches])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCatches();
  }, [loadCatches]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [editingLogbookName, setEditingLogbookName] = useState(false);
  const [tempLogbookName, setTempLogbookName] = useState(logbookName);
  const [visibility, setVisibility] = useState<LogbookVisibility>('public');
  const [visibilitySaving, setVisibilitySaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getUserProfile(user.id).then((profile) => {
      if (!profile) return;
      const priv = (profile as { logbook_private?: boolean }).logbook_private;
      const pub = (profile as { public?: boolean }).public;
      if (priv) setVisibility('private');
      else if (pub !== false) setVisibility('public');
      else setVisibility('friends');
    });
  }, [user?.id]);

  const setLogbookVisibility = useCallback(
    async (next: LogbookVisibility) => {
      if (!user?.id || next === visibility || visibilitySaving) return;
      setVisibilitySaving(true);
      try {
        await updateUserProfile(user.id, {
          logbook_private: next === 'private',
          public: next === 'public',
        });
        setVisibility(next);
      } catch (e) {
        console.error('Update logbook visibility:', e);
      } finally {
        setVisibilitySaving(false);
      }
    },
    [user?.id, visibility, visibilitySaving]
  );

  useEffect(() => {
    setTempLogbookName(logbookName);
  }, [logbookName]);

  const handleSaveLogbookName = () => {
    if (tempLogbookName.trim()) setLogbookName(tempLogbookName.trim());
    setEditingLogbookName(false);
  };

  const filteredAndSortedCatches = useMemo(() => {
    let list = catches;
    if (favoritesFilterOn) {
      list = list.filter((c) => isFavorite(c.id));
    } else {
      list = [...list].sort((a, b) => {
        const aFav = isFavorite(a.id) ? 1 : 0;
        const bFav = isFavorite(b.id) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }
    if (filter === 'freshwater') list = list.filter((c) => getSpeciesCategory(c.species) === 'freshwater');
    else if (filter === 'saltwater') list = list.filter((c) => getSpeciesCategory(c.species) === 'saltwater');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.name || c.species).toLowerCase().includes(q) ||
          c.species.toLowerCase().includes(q)
      );
    }
    return list;
  }, [catches, search, filter, favoritesFilterOn, isFavorite]);

  const speciesCount = useMemo(() => new Set(catches.map((c) => c.species)).size, [catches]);
  const favoritesCount = useMemo(() => catches.filter((c) => isFavorite(c.id)).length, [catches, isFavorite]);
  const passportCaught = gamification.caughtSpecies.size;
  const passportTotal = PASSPORT_SPECIES.length;
  const passportProgress = passportTotal > 0 ? passportCaught / passportTotal : 0;

  const filterPills: { label: string; value: FilterType; isFavorites?: boolean }[] = [
    { label: 'All', value: 'all' },
    { label: 'Favorites', value: 'all', isFavorites: true },
    { label: 'Freshwater', value: 'freshwater' },
    { label: 'Saltwater', value: 'saltwater' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <SnaggedWordmark />
            <View style={styles.visibilityWrap}>
              <Text style={styles.visibilityLabel}>Who can see your logbook?</Text>
              <View style={styles.visibilityRow}>
                {(['public', 'friends', 'private'] as LogbookVisibility[]).map((mode) => {
                const isActive = visibility === mode;
                const pillColor =
                  mode === 'public'
                    ? colors.teal
                    : mode === 'friends'
                      ? colors.blue
                      : colors.red;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.visibilityPill,
                      isActive && { backgroundColor: pillColor, borderColor: pillColor },
                    ]}
                    onPress={() => setLogbookVisibility(mode)}
                    disabled={visibilitySaving}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.visibilityPillLabel,
                        isActive && styles.visibilityPillLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {mode === 'public' ? 'Public' : mode === 'friends' ? 'Friends' : 'Private'}
                    </Text>
                    <Ionicons
                      name={
                        mode === 'public'
                          ? 'globe-outline'
                          : mode === 'friends'
                            ? 'people-outline'
                            : 'lock-closed-outline'
                      }
                      size={16}
                      color={isActive ? '#fff' : colors.lightSubtext}
                    />
                  </TouchableOpacity>
                );
                })}
              </View>
            </View>
          </View>
          {editingLogbookName ? (
            <View style={styles.titleRow}>
              <TextInput
                style={styles.titleInput}
                value={tempLogbookName}
                onChangeText={setTempLogbookName}
                autoFocus
                onSubmitEditing={handleSaveLogbookName}
                onBlur={handleSaveLogbookName}
              />
              <TouchableOpacity onPress={handleSaveLogbookName}>
                <Feather name="check" size={22} color={BRIGHT_BLUE} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.titleRow}
              onPress={() => {
                setTempLogbookName(logbookName);
                setEditingLogbookName(true);
              }}
            >
              <Text style={styles.title}>{logbookName}</Text>
              <Feather name="edit-2" size={18} color={colors.lightSubtext} style={styles.editIcon} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.passportBanner}
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/passport')}
        >
          <View style={styles.passportBannerContent}>
            <Feather name="map" size={22} color="#FFFFFF" />
            <View style={styles.passportBannerText}>
              <Text style={styles.passportBannerTitle}>Fishing Passport</Text>
              <View style={styles.passportBannerRow}>
                <Text style={styles.passportBannerSubtext}>
                  {passportCaught} of {passportTotal} species
                </Text>
                <Text style={styles.passportBannerPct}>{Math.round(passportProgress * 100)}%</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.9)" />
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, passportProgress * 100)}%` }]} />
          </View>
        </TouchableOpacity>

        <FlatList
          data={filteredAndSortedCatches}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[styles.gridContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.gold]} />
          }
          ListHeaderComponent={
            <>
              {/* Stats row — scrolls with content */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Ionicons name="fish-outline" size={22} color={BRIGHT_BLUE} />
                  <Text style={styles.statValue}>{catches.length}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={[styles.statCard, favoritesFilterOn && styles.statCardActive]}>
                  <Ionicons name="heart" size={22} color={favoritesFilterOn ? GOLD : BRIGHT_BLUE} />
                  <Text style={styles.statValue}>{favoritesCount}</Text>
                  <Text style={styles.statLabel}>Favorites</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="fish-outline" size={22} color={BRIGHT_BLUE} />
                  <Text style={styles.statValue}>{speciesCount}</Text>
                  <Text style={styles.statLabel}>Species</Text>
                </View>
              </View>

              {/* Search + filter pills — scrolls with content */}
              <View style={styles.searchAndFilters}>
                <View style={styles.searchBar}>
                  <Feather name="search" size={20} color={colors.lightSubtext} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or species..."
                    placeholderTextColor={colors.lightSubtext}
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterPillsScroll}
                  contentContainerStyle={styles.filterPillsRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {filterPills.map((pill) => {
                    const isActive = pill.isFavorites ? favoritesFilterOn : (!favoritesFilterOn && filter === pill.value);
                    const onPress = pill.isFavorites
                      ? () => { setFavoritesFilterOn(!favoritesFilterOn); setFilter('all'); }
                      : () => { setFilter(pill.value); setFavoritesFilterOn(false); };
                    return (
                      <TouchableOpacity
                        key={pill.label}
                        style={[styles.filterPill, isActive && styles.filterPillActive]}
                        onPress={onPress}
                      >
                        <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                          {pill.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <CatchCard
              catchItem={item}
              isFavorite={isFavorite(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
              onUpdate={() => loadCatches()}
              onDelete={async () => {
                // Remove from UI immediately
                setCatches((prev) => prev.filter((c) => c.id !== item.id));
                // Deduct XP + update passport species counters
                const { XP_PER_CATCH } = await import('@/src/types/gamification');
                const { findPassportSpeciesId } = await import('@/src/lib/speciesMapper');
                const speciesId = findPassportSpeciesId(item.species ?? '');
                await gamification.removeCatch(speciesId ?? null, XP_PER_CATCH);
                // Refetch from server so list stays in sync (handles any caching/soft-delete)
                await loadCatches();
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {loading
                  ? 'Loading...'
                  : favoritesFilterOn
                    ? 'No favorites yet'
                    : !user?.id
                      ? 'Sign in to view your logbook'
                      : 'No catches yet. Log your first catch!'}
              </Text>
              {!loading && user?.id && !favoritesFilterOn && (
                <TouchableOpacity
                  style={styles.emptyCta}
                  onPress={() => router.push('/(tabs)/log')}
                >
                  <Text style={styles.emptyCtaText}>Log your first catch</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  android: { elevation: 3 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },
  keyboardWrap: { flex: 1 },
  header: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  visibilityWrap: {
    alignItems: 'flex-end',
  },
  visibilityLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.lightSubtext,
    marginBottom: 6,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  visibilityPill: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.lightBorder,
    minWidth: 72,
  },
  visibilityPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.lightSubtext,
  },
  visibilityPillLabelActive: {
    color: '#fff',
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
    marginRight: 12,
  },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  title: { fontSize: 18, fontWeight: '700', color: colors.lightText },
  titleInput: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.lightText, paddingVertical: 4 },
  editIcon: { marginLeft: 8 },

  passportBanner: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1E5F8C',
    ...Platform.select({
      ios: { shadowColor: '#1E5F8C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  passportBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  passportBannerText: { flex: 1, flexShrink: 1, minWidth: 0, marginLeft: 12 },
  passportBannerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  passportBannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  passportBannerSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  passportBannerPct: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  progressBarBg: {
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 3 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(74, 144, 226, 0.08)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.15)',
    ...cardShadow,
  },
  statCardActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: GOLD,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: BRIGHT_BLUE, marginTop: 8 },
  statLabel: { fontSize: 12, color: colors.lightSubtext, marginTop: 4 },

  searchAndFilters: { marginHorizontal: 16, marginBottom: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 2,
    borderColor: colors.lightBorder,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.lightText, padding: 0 },
  filterPillsScroll: { flexGrow: 0, flexShrink: 0 },
  filterPillsRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 16, gap: 8 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  filterPillActive: { backgroundColor: BRIGHT_BLUE, borderColor: BRIGHT_BLUE },
  filterPillText: { fontSize: 12, fontWeight: '600', color: colors.lightSubtext },
  filterPillTextActive: { color: '#FFFFFF' },

  gridRow: { paddingHorizontal: 16 },
  gridContent: { paddingBottom: 40 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  empty: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 15, color: colors.lightSubtext, textAlign: 'center' },
  emptyCta: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: BRIGHT_BLUE,
    borderRadius: 12,
  },
  emptyCtaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  modalContainer: { flex: 1, backgroundColor: colors.lightBackground },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalIconBtn: { padding: 8 },
  modalScroll: { flex: 1 },
  modalContent: { paddingHorizontal: 16, paddingBottom: 40 },
});
