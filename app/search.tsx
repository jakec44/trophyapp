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
  Dimensions,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { supabase } from '@/src/lib/supabase';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useAuthContext } from '@/src/context/AuthContext';
import { useFeedContext } from '@/src/context/FeedContext';
import { FeedPostCard } from '@/src/components/home/FeedPostCard';
import type { FeedPost } from '@/utils/feedMockData';

function isVideoUrl(url: string | number): boolean {
  if (typeof url !== 'string') return false;
  try {
    const path = url.split('?')[0].toLowerCase();
    return /\.(mp4|webm|mov)(\?|$)/i.test(path) || path.includes('/video/');
  } catch {
    return false;
  }
}

const TEAL = colors.teal;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAD = 14;
const GAP = 10;
const TILE_WIDTH = (SCREEN_WIDTH - PAD * 2 - GAP) / 2;

// ─── Types ───────────────────────────────────────────────────────────────────

type ResultFilter = 'posts' | 'accounts';

type UserResult = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url?: string | null;
};

type SpeciesResult = { species: string; count: number };

/** General suggestion: species or hashtag - shown first, tap shows posts + accounts */
type Suggestion = { type: 'species'; label: string; species: string } | { type: 'hashtag'; label: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const RECENTS_KEY = '@Snagged/search_recents';
const MAX_RECENTS = 5;
const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 6;

const POPULAR_SPECIES = [
  'Largemouth Bass', 'Smallmouth Bass', 'Tarpon', 'Snook', 'Red Drum',
  'Striped Bass', 'Trout', 'Channel Catfish', 'Northern Snakehead',
];

const SPECIES_EMOJI: Record<string, string> = {
  'Largemouth Bass': '🐟', 'Smallmouth Bass': '🐟', 'Striped Bass': '🐟',
  'Tarpon': '🐠', 'Snook': '🐡', 'Red Drum': '🎣',
  'Channel Catfish': '🐱', 'Northern Snakehead': '🐍', 'Trout': '🐙',
};

// ─── AsyncStorage ─────────────────────────────────────────────────────────────

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

// ─── Search API ──────────────────────────────────────────────────────────────

async function fetchProfiles(q: string): Promise<UserResult[]> {
  const pattern = `%${q}%`;
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .limit(30);
  return (data ?? []).map((u) => ({
    id: u.id,
    username: u.username ?? null,
    display_name: (u as { display_name?: string }).display_name ?? null,
    avatar_url: (u as { avatar_url?: string | null }).avatar_url ?? null,
  }));
}

async function fetchSpecies(q: string): Promise<SpeciesResult[]> {
  const pattern = `%${q}%`;
  const { data } = await supabase
    .from('feed_posts')
    .select('id, species')
    .ilike('species', pattern)
    .not('species', 'is', null)
    .limit(500);
  const groups: Record<string, number> = {};
  for (const row of data ?? []) {
    const sp = (row.species ?? '').trim() || 'Unknown';
    if (sp === 'Unknown') continue;
    groups[sp] = (groups[sp] ?? 0) + 1;
  }
  return Object.entries(groups)
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => b.count - a.count);
}

/** Extract hashtags from captions that contain the query (e.g. "tar" → #tarpon). */
async function fetchHashtagSuggestions(q: string): Promise<string[]> {
  const pattern = `%${q}%`;
  const { data } = await supabase
    .from('feed_posts')
    .select('caption')
    .ilike('caption', pattern)
    .not('caption', 'is', null)
    .limit(100);
  const tags = new Set<string>();
  const hashRegex = /#(\w+)/g;
  const lower = q.toLowerCase();
  for (const row of data ?? []) {
    const cap = (row.caption ?? '') as string;
    let m: RegExpExecArray | null;
    hashRegex.lastIndex = 0;
    while ((m = hashRegex.exec(cap)) !== null) {
      const tag = '#' + m[1];
      if (m[1].toLowerCase().includes(lower)) tags.add(tag);
    }
  }
  return [...tags].slice(0, 5);
}

/** General suggestions: species + hashtags close to query (first 5–6). */
async function fetchSuggestions(q: string): Promise<Suggestion[]> {
  const [species, hashtags] = await Promise.all([
    fetchSpecies(q),
    fetchHashtagSuggestions(q),
  ]);
  const list: Suggestion[] = [
    ...species.slice(0, 4).map((s) => ({ type: 'species' as const, label: s.species, species: s.species })),
    ...hashtags.slice(0, 3).map((h) => ({ type: 'hashtag' as const, label: h })),
  ];
  return list.slice(0, MAX_SUGGESTIONS);
}

// ─── Grid tile components (2 per row) ──────────────────────────────────────────

function ProfileTile({ item, onPress }: { item: UserResult; onPress: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const url = item.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.id}`;
  const isSvg = url.includes('.svg');
  const name = item.display_name ?? item.username ?? '?';
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity style={[styles.tile, { width: TILE_WIDTH }]} onPress={onPress} activeOpacity={0.72}>
      {!imgFailed && !isSvg ? (
        <Image source={{ uri: url }} style={styles.tileAvatar} onError={() => setImgFailed(true)} />
      ) : (
        <View style={[styles.tileAvatar, styles.tileAvatarFallback]}>
          <Text style={styles.tileAvatarInitials}>{initials}</Text>
        </View>
      )}
      <Text style={styles.tilePrimary} numberOfLines={1}>@{item.username ?? 'unknown'}</Text>
      {item.display_name ? (
        <Text style={styles.tileSecondary} numberOfLines={1}>{item.display_name}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function SuggestionTile({ item, onPress }: { item: Suggestion; onPress: () => void }) {
  const icon = item.type === 'species' ? (SPECIES_EMOJI[item.species] ?? '🐟') : item.label;
  return (
    <TouchableOpacity style={[styles.tile, styles.suggestionTile, { width: TILE_WIDTH }]} onPress={onPress} activeOpacity={0.72}>
      <View style={styles.suggestionIconWrap}>
        <Text style={styles.suggestionIcon} numberOfLines={1}>{icon}</Text>
      </View>
      <Text style={styles.tilePrimary} numberOfLines={1}>{item.label}</Text>
      <Text style={styles.tileSecondary}>{item.type === 'species' ? 'Species' : 'Hashtag'}</Text>
    </TouchableOpacity>
  );
}

function PostTile({ post, onPress }: { post: FeedPost; onPress: () => void }) {
  const photoUrl = typeof post.photoUrl === 'string' ? post.photoUrl : undefined;
  const isVideo = photoUrl != null && isVideoUrl(photoUrl);
  const [videoThumbnailUri, setVideoThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    if (!isVideo || !photoUrl) return;
    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(photoUrl, { time: 0 })
      .then(({ uri }) => {
        if (!cancelled) setVideoThumbnailUri(uri);
      })
      .catch(() => {
        if (!cancelled) setVideoThumbnailUri(null);
      });
    return () => { cancelled = true; };
  }, [isVideo, photoUrl]);

  const imageUri = isVideo ? (videoThumbnailUri ?? undefined) : photoUrl;
  const showPlaceholder = !imageUri;

  return (
    <TouchableOpacity style={[styles.tile, styles.postTile, { width: TILE_WIDTH }]} onPress={onPress} activeOpacity={0.85}>
      {imageUri && !showPlaceholder ? (
        <Image source={{ uri: imageUri }} style={styles.postTileImage} resizeMode="cover" />
      ) : (
        <View style={[styles.postTileImage, styles.postTileImagePlaceholder]}>
          {isVideo ? (
            <Ionicons name="videocam-outline" size={28} color={colors.lightSubtext} />
          ) : (
            <Ionicons name="image-outline" size={28} color={colors.lightSubtext} />
          )}
        </View>
      )}
      <View style={styles.postTileOverlay}>
        <Text style={styles.postTileUser} numberOfLines={1}>{post.username}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { searchFeedPosts, handlePostHype, handleAddComment, loadComments, handleShare } = useFeedContext();

  const [query, setQuery] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('posts');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [profileResults, setProfileResults] = useState<UserResult[]>([]);
  const [postResults, setPostResults] = useState<FeedPost[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);

  const recentsRef = useRef<string[]>([]);
  useEffect(() => { recentsRef.current = recents; }, [recents]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchIdRef = useRef(0);

  useEffect(() => {
    loadRecents().then((r) => setRecents(r));
  }, []);

  /** Unified search while typing: suggestions (species/hashtags) + profiles. No filter. */
  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSuggestions([]);
      setProfileResults([]);
      return;
    }

    const id = ++searchIdRef.current;
    setLoading(true);

    try {
      const [sug, prof] = await Promise.all([fetchSuggestions(trimmed), fetchProfiles(trimmed)]);
      if (id !== searchIdRef.current) return;
      setSuggestions(sug);
      setProfileResults(prof);
      const updated = await persistRecent(trimmed, recentsRef.current);
      if (id === searchIdRef.current) setRecents(updated);
    } catch {
      if (id === searchIdRef.current) {
        setSuggestions([]);
        setProfileResults([]);
      }
    } finally {
      if (id === searchIdRef.current) setLoading(false);
    }
  }, []);

  /** After user selects a suggestion or submits: load posts for that term. */
  const loadResultsForTerm = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const posts = await searchFeedPosts(term, 50);
      setPostResults(posts);
      const prof = await fetchProfiles(term);
      setProfileResults(prof);
    } catch {
      setPostResults([]);
      setProfileResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchFeedPosts]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setLoading(false);
      setSuggestions([]);
      setProfileResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  const handleDeleteRecent = useCallback(async (q: string) => {
    const updated = await deleteRecent(q, recentsRef.current);
    setRecents(updated);
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setSelectedTerm(null);
    setSuggestions([]);
    setProfileResults([]);
    setPostResults([]);
  }, []);

  const onSelectSuggestion = useCallback((term: string) => {
    setSelectedTerm(term);
    loadResultsForTerm(term);
  }, [loadResultsForTerm]);

  const onSubmitSearch = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed) {
      setSelectedTerm(trimmed);
      loadResultsForTerm(trimmed);
    }
  }, [query, loadResultsForTerm]);

  const isSearching = query.trim().length > 0;
  const showFilterTabs = selectedTerm != null;

  const renderContent = () => {
    if (!isSearching && !selectedTerm) {
      return (
        <>
          {recents.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent</Text>
              <View style={styles.card}>
                {recents.map((q, idx) => (
                  <View key={q}>
                    <TouchableOpacity style={styles.row} onPress={() => setQuery(q)} activeOpacity={0.7}>
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Popular</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
              {POPULAR_SPECIES.map((sp) => (
                <TouchableOpacity key={sp} style={styles.pill} onPress={() => { setQuery(sp); onSelectSuggestion(sp); }} activeOpacity={0.75}>
                  <Text style={styles.pillEmoji}>{SPECIES_EMOJI[sp] ?? '🐟'}</Text>
                  <Text style={styles.pillTxt}>{sp}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={styles.hint}>
            <Ionicons name="search-outline" size={40} color={colors.lightBorder} />
            <Text style={styles.hintTitle}>Search species, #hashtags, or people</Text>
            <Text style={styles.hintBody}>First results match what you type — tap to see posts and accounts</Text>
          </View>
        </>
      );
    }

    if (showFilterTabs) {
      if (loading) {
        return (
          <View style={styles.hint}>
            <ActivityIndicator size="large" color={TEAL} />
            <Text style={styles.hintBody}>Loading…</Text>
          </View>
        );
      }
      if (resultFilter === 'posts') {
        if (postResults.length === 0) {
          return (
            <View style={styles.hint}>
              <Ionicons name="image-outline" size={38} color={colors.lightBorder} />
              <Text style={styles.hintTitle}>No posts</Text>
              <Text style={styles.hintBody}>No posts for "{selectedTerm}"</Text>
            </View>
          );
        }
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Posts for "{selectedTerm}"</Text>
            <View style={styles.grid}>
              {postResults.map((post) => (
                <PostTile
                  key={post.id}
                  post={post}
                  onPress={() => setSelectedPost(post)}
                />
              ))}
            </View>
          </View>
        );
      }
      if (profileResults.length === 0) {
        return (
          <View style={styles.hint}>
            <Ionicons name="person-outline" size={38} color={colors.lightBorder} />
            <Text style={styles.hintTitle}>No accounts</Text>
            <Text style={styles.hintBody}>No profiles matching "{selectedTerm}"</Text>
          </View>
        );
      }
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accounts</Text>
          <View style={styles.grid}>
            {profileResults.map((item) => (
              <ProfileTile key={item.id} item={item} onPress={() => router.push(`/user/${item.id}`)} />
            ))}
          </View>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.hint}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.hintBody}>Searching…</Text>
        </View>
      );
    }

    return (
      <>
        {suggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suggestions — tap to see posts</Text>
            <View style={styles.grid}>
              {suggestions.map((item) => (
                <SuggestionTile
                  key={item.type + item.label}
                  item={item}
                  onPress={() => onSelectSuggestion(item.type === 'hashtag' ? item.label : item.label)}
                />
              ))}
            </View>
          </View>
        )}
        {profileResults.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>People</Text>
            <View style={styles.grid}>
              {profileResults.map((item) => (
                <ProfileTile key={item.id} item={item} onPress={() => router.push(`/user/${item.id}`)} />
              ))}
            </View>
          </View>
        )}
        {!loading && suggestions.length === 0 && profileResults.length === 0 && isSearching && (
          <View style={styles.hint}>
            <Ionicons name="search-outline" size={38} color={colors.lightBorder} />
            <Text style={styles.hintTitle}>No results</Text>
            <Text style={styles.hintBody}>Try species, #hashtags, or a username</Text>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ParticleBackground />

      <View style={styles.header}>
        <SnaggedWordmark />
        <View style={styles.inputWrap}>
          <Ionicons name="search-outline" size={17} color={colors.lightSubtext} />
          <TextInput
            style={styles.input}
            placeholder="Search species, #hashtags, people…"
            placeholderTextColor={colors.lightSubtext}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
          />
          {loading && <ActivityIndicator size="small" color={TEAL} style={{ marginRight: 2 }} />}
          {!loading && query.length > 0 && (
            <TouchableOpacity onPress={handleClear} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.lightSubtext} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showFilterTabs && (
        <View style={styles.filterRow}>
          {(['posts', 'accounts'] as ResultFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, resultFilter === f && styles.filterTabActive]}
              onPress={() => setResultFilter(f)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={f === 'posts' ? 'image-outline' : 'person-outline'}
                size={15}
                color={resultFilter === f ? '#000' : colors.lightSubtext}
              />
              <Text style={[styles.filterTabTxt, resultFilter === f && styles.filterTabTxtActive]}>
                {f === 'posts' ? 'Posts' : 'Accounts'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      {/* Full-screen post view (same as home feed) */}
      <Modal
        visible={selectedPost != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPost(null)}
      >
        <View style={styles.postModalRoot}>
          <View style={styles.postModalHeader}>
            <TouchableOpacity onPress={() => setSelectedPost(null)} style={styles.postModalClose} hitSlop={12}>
              <Ionicons name="close" size={28} color={colors.lightText} />
            </TouchableOpacity>
          </View>
          {selectedPost && (
            <ScrollView
              style={styles.postModalScroll}
              contentContainerStyle={styles.postModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <FeedPostCard
                post={selectedPost}
                isScreenFocused={true}
                onHype={(postId, hyped) => {
                  if (!user?.id) { router.replace('/(tabs)/profile'); return; }
                  handlePostHype(postId, hyped);
                }}
                onAddComment={(postId, text, replyMeta) => {
                  if (!user?.id) { router.replace('/(tabs)/profile'); return; }
                  handleAddComment(postId, text, replyMeta);
                }}
                onShare={(postId) => {
                  if (!user?.id) { router.replace('/(tabs)/profile'); return; }
                  handleShare(postId);
                }}
                loadComments={loadComments}
              />
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBackground },

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
  input: { flex: 1, fontSize: 15, color: colors.lightText, padding: 0 },

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

  scrollContent: { paddingBottom: 48, paddingTop: 6 },

  section: { paddingTop: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.lightSubtext,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingBottom: 7,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: PAD,
    gap: GAP,
  },

  tile: {
    backgroundColor: colors.lightCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    padding: 12,
    alignItems: 'center',
  },
  tilePrimary: { fontSize: 13, fontWeight: '700', color: colors.lightText },
  tileSecondary: { fontSize: 11, color: colors.lightSubtext, marginTop: 2 },

  tileAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.lightBorder, marginBottom: 6 },
  tileAvatarFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: TEAL + '30' },
  tileAvatarInitials: { fontSize: 18, fontWeight: '800', color: TEAL },

  suggestionTile: { paddingVertical: 14 },
  suggestionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: TEAL + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  suggestionIcon: { fontSize: 20 },

  postTile: { padding: 0, overflow: 'hidden' },
  postTileImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.lightBorder },
  postTileImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  postTileOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  postTileUser: { fontSize: 11, fontWeight: '600', color: '#fff' },

  card: {
    marginHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.lightBorder, marginLeft: 70 },

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

  avatarWrap: { flexShrink: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lightBorder },
  avatarFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: TEAL + '30' },
  avatarInitials: { fontSize: 16, fontWeight: '800', color: TEAL },

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

  pillsRow: { paddingHorizontal: 14, paddingBottom: 4, gap: 8, flexDirection: 'row' },
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

  hint: { alignItems: 'center', paddingTop: 52, paddingHorizontal: 32, gap: 10 },
  hintTitle: { fontSize: 17, fontWeight: '700', color: colors.lightText },
  hintBody: { fontSize: 13, color: colors.lightSubtext, textAlign: 'center', lineHeight: 19 },

  postModalRoot: { flex: 1, backgroundColor: colors.lightBackground },
  postModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
    backgroundColor: colors.lightCard + 'f0',
  },
  postModalClose: { padding: 4 },
  postModalScroll: { flex: 1 },
  postModalScrollContent: { paddingBottom: 48 },
});
