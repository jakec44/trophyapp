import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { supabase } from '@/src/lib/supabase';
import { RAW_CATCHES } from '@/utils/feedMockData';

const TEAL = colors.teal;

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterMode = 'profiles' | 'fish';

type UserResult = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url?: string | null;
};

type SpeciesResult = {
  species: string;
  count: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const RECENTS_KEY = '@Snagged/search_recents';
const MAX_RECENTS = 8;
const DEBOUNCE_MS = 300;

const MOCK_USERS: UserResult[] = [
  { id: 'user-1',  username: 'BassMaster92',    display_name: 'Jake T.',    avatar_url: 'https://picsum.photos/seed/bm92/80/80' },
  { id: 'user-2',  username: 'CoastalFlyCo',    display_name: 'Carlos R.',  avatar_url: 'https://picsum.photos/seed/cfc/80/80' },
  { id: 'user-4',  username: 'GatorBaitMike',   display_name: 'Mike D.',    avatar_url: 'https://picsum.photos/seed/gbm/80/80' },
  { id: 'user-5',  username: 'KeysTarponKing',  display_name: 'Ryan K.',    avatar_url: 'https://picsum.photos/seed/ktk/80/80' },
  { id: 'user-6',  username: 'SnakeheadSlayer', display_name: 'Dee W.',     avatar_url: 'https://picsum.photos/seed/ssh/80/80' },
  { id: 'user-7',  username: 'GeorgiaBassPro',  display_name: 'Chris B.',   avatar_url: 'https://picsum.photos/seed/gbp/80/80' },
  { id: 'user-8',  username: 'AlabamaAngler',   display_name: 'Tom A.',     avatar_url: 'https://picsum.photos/seed/aa/80/80' },
  { id: 'user-9',  username: 'TXRedFishKing',   display_name: 'Luis G.',    avatar_url: 'https://picsum.photos/seed/txrfk/80/80' },
  { id: 'user-jc', username: 'jcamobell5332',   display_name: 'J. Campbell', avatar_url: null },
];

const POPULAR_SPECIES = [
  'Largemouth Bass', 'Smallmouth Bass', 'Tarpon', 'Snook', 'Red Drum',
  'Striped Bass', 'Flounder', 'Trout', 'Channel Catfish', 'Northern Snakehead',
  'Carp', 'Crappie', 'Walleye', 'Pike',
];

const SPECIES_EMOJI: Record<string, string> = {
  'Largemouth Bass': '🐟', 'Smallmouth Bass': '🐟', 'Striped Bass': '🐟',
  'Tarpon': '🐠', 'Snook': '🐡', 'Red Drum': '🎣',
  'Channel Catfish': '🐱', 'Northern Snakehead': '🐍',
  'Flounder': '🫓', 'Trout': '🐙',
};

// ─── AsyncStorage helpers ────────────────────────────────────────────────────

async function loadRecents(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

async function persistRecent(q: string, current: string[]): Promise<string[]> {
  const next = [q, ...current.filter((r) => r !== q)].slice(0, MAX_RECENTS);
  try { await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
  return next;
}

async function deleteRecent(q: string, current: string[]): Promise<string[]> {
  const next = current.filter((r) => r !== q);
  try { await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// ─── Search functions (pure, no state side-effects) ─────────────────────────

async function fetchProfiles(q: string): Promise<UserResult[]> {
  const pattern = `%${q}%`;
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .limit(30);

  const remote: UserResult[] = (data ?? []).map((u) => ({
    id: u.id,
    username: u.username ?? null,
    display_name: (u as { display_name?: string }).display_name ?? null,
    avatar_url: (u as any).avatar_url ?? null,
  }));

  // Merge mock users that match (dev fallback)
  const qLow = q.toLowerCase();
  const existingIds = new Set(remote.map((r) => r.id));
  const mocks = MOCK_USERS.filter(
    (u) =>
      (u.username ?? '').toLowerCase().includes(qLow) ||
      (u.display_name ?? '').toLowerCase().includes(qLow)
  );
  for (const m of mocks) {
    if (!existingIds.has(m.id)) remote.push(m);
  }
  return remote;
}

async function fetchSpecies(q: string): Promise<SpeciesResult[]> {
  const pattern = `%${q}%`;
  const { data } = await supabase
    .from('catches')
    .select('id, species')
    .ilike('species', pattern)
    .is('deleted_at', null)
    .limit(200);

  const groups: Record<string, number> = {};
  for (const c of data ?? []) {
    const sp = c.species ?? 'Unknown';
    groups[sp] = (groups[sp] ?? 0) + 1;
  }

  const remote: SpeciesResult[] = Object.entries(groups)
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => b.count - a.count);

  // Merge mock feed species
  const qLow = q.toLowerCase();
  const existingSpecies = new Set(remote.map((r) => r.species));
  const mockGroups: Record<string, number> = {};
  for (const post of RAW_CATCHES) {
    const sp = post.species ?? '';
    if (sp && sp.toLowerCase().includes(qLow)) {
      mockGroups[sp] = (mockGroups[sp] ?? 0) + 1;
    }
  }
  for (const [species, count] of Object.entries(mockGroups)) {
    if (!existingSpecies.has(species)) remote.push({ species, count });
  }

  return remote;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProfileRow({ item, onPress }: { item: UserResult; onPress: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const url = item.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.id}`;
  const isSvg = url.includes('.svg');
  const name = item.display_name ?? item.username ?? '?';
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.72}>
      <View style={styles.avatarWrap}>
        {!imgFailed && !isSvg ? (
          <Image source={{ uri: url }} style={styles.avatar} onError={() => setImgFailed(true)} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowPrimary} numberOfLines={1}>@{item.username ?? 'unknown'}</Text>
        {item.display_name ? (
          <Text style={styles.rowSecondary} numberOfLines={1}>{item.display_name}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.lightSubtext} />
    </TouchableOpacity>
  );
}

function SpeciesRow({ item, onPress }: { item: SpeciesResult; onPress: () => void }) {
  const emoji = SPECIES_EMOJI[item.species] ?? '🐟';
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.72}>
      <View style={styles.speciesIconWrap}>
        <Text style={styles.speciesEmoji}>{emoji}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowPrimary} numberOfLines={1}>{item.species}</Text>
        {item.count > 0 && (
          <Text style={styles.rowSecondary}>{item.count} {item.count === 1 ? 'catch' : 'catches'}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.lightSubtext} />
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('profiles');
  const [loading, setLoading] = useState(false);
  const [profileResults, setProfileResults] = useState<UserResult[]>([]);
  const [speciesResults, setSpeciesResults] = useState<SpeciesResult[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  // Store recents in a ref so search callbacks never go stale from it
  const recentsRef = useRef<string[]>([]);
  useEffect(() => { recentsRef.current = recents; }, [recents]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Incrementing id so we can ignore results from superseded searches
  const searchIdRef = useRef(0);

  useEffect(() => {
    loadRecents().then((r) => setRecents(r));
  }, []);

  // ── Core search — no state in deps, uses refs to avoid stale closures ──────
  const runSearch = useCallback(async (q: string, f: FilterMode) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    const id = ++searchIdRef.current;
    setLoading(true);

    try {
      if (f === 'profiles') {
        const res = await fetchProfiles(trimmed);
        if (id !== searchIdRef.current) return; // superseded
        setProfileResults(res);
        setSpeciesResults([]);
      } else {
        const res = await fetchSpecies(trimmed);
        if (id !== searchIdRef.current) return;
        setSpeciesResults(res);
        setProfileResults([]);
      }

      // Persist to recents using the ref (no closure over state)
      const updated = await persistRecent(trimmed, recentsRef.current);
      if (id === searchIdRef.current) setRecents(updated);
    } catch {
      if (id === searchIdRef.current) {
        setProfileResults([]);
        setSpeciesResults([]);
      }
    } finally {
      if (id === searchIdRef.current) setLoading(false);
    }
  }, []); // ← no state deps — completely stable reference

  // ── Debounce on query or filter change ────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setLoading(false);
      setProfileResults([]);
      setSpeciesResults([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => runSearch(query, filter), DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filter, runSearch]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDeleteRecent = useCallback(async (q: string) => {
    const updated = await deleteRecent(q, recentsRef.current);
    setRecents(updated);
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setProfileResults([]);
    setSpeciesResults([]);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isSearching = query.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  const renderContent = () => {
    // ── Empty query: show recents + hint ────────────────────────────────────
    if (!isSearching) {
      return (
        <>
          {recents.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent</Text>
              <View style={styles.card}>
                {recents.map((q, idx) => (
                  <View key={q}>
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => setQuery(q)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.recentIconWrap}>
                        <Ionicons name="time-outline" size={16} color={colors.lightSubtext} />
                      </View>
                      <Text style={[styles.rowInfo, styles.recentTxt]} numberOfLines={1}>{q}</Text>
                      <TouchableOpacity onPress={() => handleDeleteRecent(q)} hitSlop={12}>
                        <Ionicons name="close" size={16} color={colors.lightSubtext} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {idx < recents.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </View>
          )}

          {filter === 'fish' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Species</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsRow}
              >
                {POPULAR_SPECIES.map((sp) => (
                  <TouchableOpacity
                    key={sp}
                    style={styles.pill}
                    onPress={() => setQuery(sp)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.pillEmoji}>{SPECIES_EMOJI[sp] ?? '🐟'}</Text>
                    <Text style={styles.pillTxt}>{sp}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {filter === 'profiles' && (
            <View style={styles.hint}>
              <Ionicons name="person-outline" size={40} color={colors.lightBorder} />
              <Text style={styles.hintTitle}>Find anglers</Text>
              <Text style={styles.hintBody}>Search by username or name</Text>
            </View>
          )}
        </>
      );
    }

    // ── Loading ──────────────────────────────────────────────────────────────
    if (loading) {
      return (
        <View style={styles.hint}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.hintBody}>Searching…</Text>
        </View>
      );
    }

    // ── Profile results ──────────────────────────────────────────────────────
    if (filter === 'profiles') {
      if (profileResults.length === 0) {
        return (
          <View style={styles.hint}>
            <Ionicons name="search-outline" size={38} color={colors.lightBorder} />
            <Text style={styles.hintTitle}>No results</Text>
            <Text style={styles.hintBody}>Try searching by username or display name</Text>
          </View>
        );
      }
      return (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>People</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeTxt}>{profileResults.length}</Text>
            </View>
          </View>
          <View style={styles.card}>
            {profileResults.map((item, idx) => (
              <View key={item.id}>
                <ProfileRow item={item} onPress={() => router.push(`/user/${item.id}`)} />
                {idx < profileResults.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>
      );
    }

    // ── Species results ──────────────────────────────────────────────────────
    if (speciesResults.length === 0) {
      return (
        <View style={styles.hint}>
          <Ionicons name="search-outline" size={38} color={colors.lightBorder} />
          <Text style={styles.hintTitle}>No results</Text>
          <Text style={styles.hintBody}>Try a species like "Bass" or "Tarpon"</Text>
        </View>
      );
    }
    return (
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Species</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeTxt}>{speciesResults.length}</Text>
          </View>
        </View>
        <View style={styles.card}>
          {speciesResults.map((item, idx) => (
            <View key={item.species}>
              <SpeciesRow
                item={item}
                onPress={() => {
                  setQuery(item.species);
                  setFilter('fish');
                }}
              />
              {idx < speciesResults.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />

      {/* Search bar */}
      <View style={styles.header}>
        <SnaggedWordmark />
        <View style={styles.inputWrap}>
          <Ionicons name="search-outline" size={17} color={colors.lightSubtext} />
          <TextInput
            style={styles.input}
            placeholder={filter === 'profiles' ? 'Search anglers…' : 'Search species…'}
            placeholderTextColor={colors.lightSubtext}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {loading && (
            <ActivityIndicator size="small" color={TEAL} style={{ marginRight: 2 }} />
          )}
          {!loading && query.length > 0 && (
            <TouchableOpacity onPress={handleClear} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.lightSubtext} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['profiles', 'fish'] as FilterMode[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={f === 'profiles' ? 'person-outline' : 'fish-outline'}
              size={15}
              color={filter === f ? '#000' : colors.lightSubtext}
            />
            <Text style={[styles.filterTabTxt, filter === f && styles.filterTabTxtActive]}>
              {f === 'profiles' ? 'Profiles' : 'Fish'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
    backgroundColor: colors.lightCard + 'f0',
  },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 22,
    color: '#00e5c8',
    letterSpacing: 2,
    marginRight: 8,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightBackground,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 5,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.lightText,
    padding: 0,
  },

  // Filter tabs
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: colors.lightCard + 'cc',
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  filterTabActive: { backgroundColor: TEAL, borderColor: TEAL },
  filterTabTxt: { fontSize: 13, fontWeight: '600', color: colors.lightSubtext },
  filterTabTxtActive: { color: '#000', fontWeight: '700' },

  // Scroll content
  scrollContent: { paddingBottom: 48, paddingTop: 6 },

  // Section
  section: { paddingTop: 14 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 7,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.lightSubtext,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingBottom: 7,
  },
  countBadge: {
    backgroundColor: TEAL + '20',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeTxt: { fontSize: 11, fontWeight: '600', color: TEAL },

  // Card container
  card: {
    marginHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.lightBorder, marginLeft: 70 },

  // Shared row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowPrimary: { fontSize: 15, fontWeight: '700', color: colors.lightText },
  rowSecondary: { fontSize: 12, color: colors.lightSubtext, marginTop: 2 },

  // Avatar
  avatarWrap: { flexShrink: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lightBorder },
  avatarFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: TEAL + '30' },
  avatarInitials: { fontSize: 16, fontWeight: '800', color: TEAL },

  // Species icon
  speciesIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TEAL + '18',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  speciesEmoji: { fontSize: 22 },

  // Recents
  recentIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lightBackground,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  recentTxt: { fontSize: 14, color: colors.lightText, fontWeight: '500' },

  // Popular pills
  pillsRow: {
    paddingHorizontal: 14,
    paddingBottom: 4,
    gap: 8,
    flexDirection: 'row',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  pillEmoji: { fontSize: 15 },
  pillTxt: { fontSize: 13, fontWeight: '600', color: colors.lightText },

  // Hint / empty
  hint: {
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 32,
    gap: 10,
  },
  hintTitle: { fontSize: 17, fontWeight: '700', color: colors.lightText },
  hintBody: { fontSize: 13, color: colors.lightSubtext, textAlign: 'center', lineHeight: 19 },
});
