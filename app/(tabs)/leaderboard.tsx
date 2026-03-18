import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { useAuthContext } from '@/src/context/AuthContext';
import { useGamificationContext } from '@/src/context/GamificationContext';
import { getAnglerLeaderboard, getAnglerRank, getLeaderboardProfileExtras, getProfileDisplayItemsBatch, getUserProfile, updateUserProfile, type AnglerLeaderboardRow } from '@/src/lib/supabase';
import { useSeason } from '@/src/hooks/useSeason';
import { useLocationState } from '@/src/hooks/useLocationState';
import { getPublicUrl, getAvatarUrlWithCacheBust } from '@/src/lib/supabase';
import { UserLink } from '@/src/components/profile/UserLink';
import { AnimatedTrophyBadge } from '@/src/components/profile/AnimatedTrophyBadge';
import { RarityBadge } from '@/src/components/profile/RarityBadge';
import { SpeciesBadgeImage } from '@/src/components/profile/SpeciesBadgeImage';
import { getInferredPlaceFromBadge } from '@/src/lib/supabase';
import { getLevelBadgeIcon, getLevelFromXp } from '@/src/types/gamification';
import { hasCustomSpeciesBadgeImage } from '@/src/constants/speciesBadgeImages';
import { colors } from '@/utils/colors';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';

const MEDIA_BUCKET = 'media';
const GOLD = '#FFC845';
const SILVER = '#a8c4d4';
const BRONZE = '#c87941';
const YELLOW = '#FFC845';
const BLUE_ACTIVE = '#3B82F6';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isNarrow = SCREEN_WIDTH < 420;

type ProfileDisplayItem = import('@/src/lib/supabase').ProfileDisplayItem;

const BADGE_SZ = 20;

/** Parse level from display items (level badge key e.g. "level-12-angler"). */
function getLevelFromDisplayItems(displayMap: Record<string, ProfileDisplayItem[]>, userId: string): string | null {
  const items = displayMap[userId] ?? [];
  for (const item of items) {
    if (item.type === 'badge' && item.badgeKey) {
      const m = item.badgeKey.match(/^level-(\d+)-/);
      if (m) return `Level ${m[1]}`;
    }
  }
  return null;
}

/** Level + prestige string for leaderboard (e.g. "Level 12 · P2" or "Level 5"). Falls back to XP-derived level when no badge. */
function getLevelPrestigeStr(
  displayMap: Record<string, ProfileDisplayItem[]>,
  profileExtras: Record<string, { total_xp: number; prestige: number }>,
  userId: string
): string {
  let levelStr = getLevelFromDisplayItems(displayMap, userId);
  if (!levelStr) {
    const extras = profileExtras[userId];
    levelStr = extras?.total_xp != null ? `Level ${getLevelFromXp(extras.total_xp).level}` : '—';
  }
  const prestige = profileExtras[userId]?.prestige ?? 0;
  if (prestige > 0) levelStr += ` · P${prestige}`;
  return levelStr;
}

/** Badge row for leaderboard (podium + list rows). */
function LeaderboardBadges({ items, size }: { items: ProfileDisplayItem[]; size?: number }) {
  if (!items?.length) return null;
  const sz = size ?? BADGE_SZ;
  return (
    <View style={badgeRowStyles.wrap}>
      {items.slice(0, 4).map((item) => {
        const levelSz = item.badgeKey?.startsWith('level-') ? Math.round(sz * 0.85) : sz;
        let el: React.ReactNode;
        if (item.type === 'trophy') {
          el = <AnimatedTrophyBadge place={item.place} size={sz} animated={false} />;
        } else {
          const place = getInferredPlaceFromBadge(item.badgeKey, item.label);
          const icon = item.badgeKey?.startsWith('level-') ? getLevelBadgeIcon(item.badgeKey!) : item.icon;
          if (place != null) {
            el = <AnimatedTrophyBadge place={place} size={sz} animated={false} />;
          } else if (item.type === 'badge' && hasCustomSpeciesBadgeImage(item.badgeKey!)) {
            el = <SpeciesBadgeImage badgeKey={item.badgeKey!} size={sz} scale={1.2} />;
          } else if (item.type === 'badge' && item.rarity) {
            el = <RarityBadge rarity={item.rarity} icon={icon} size={levelSz} animated={false} compact />;
          } else {
            el = <Text style={[badgeRowStyles.icon, { fontSize: sz }]}>{icon ?? '🏆'}</Text>;
          }
        }
        return <View key={item.id} style={badgeRowStyles.pill}>{el}</View>;
      })}
    </View>
  );
}

const badgeRowStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: {},
  icon: {},
});

/** Podium card for top 3: badges at top, rank | name | profile pic, then level/wins/AR. 1st uses larger avatar. */
function TopThreePodiumCard({
  r,
  rank,
  displayName,
  initials,
  avatarUrl,
  displayMap,
  profileExtrasMap,
  getRankStyle,
  isYou,
  onPress,
  isFirst,
}: {
  r: AnglerLeaderboardRow;
  rank: 1 | 2 | 3;
  displayName: (r: AnglerLeaderboardRow) => string;
  initials: (r: AnglerLeaderboardRow) => string;
  avatarUrl: (r: AnglerLeaderboardRow) => string | null;
  displayMap: Record<string, ProfileDisplayItem[]>;
  profileExtrasMap: Record<string, { total_xp: number; prestige: number }>;
  getRankStyle: (rank: number) => { bg: string; text: string };
  isYou: boolean;
  onPress: (id: string) => void;
  isFirst?: boolean;
}) {
  const style = getRankStyle(rank);
  const rankLabel = rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd';
  const borderCol = rank === 1 ? '#FFD700' : rank === 2 ? '#C8D8E8' : '#E8924A';
  const avBg = rank === 1 ? '#3d2600' : rank === 2 ? '#1a2530' : '#2a1500';
  const levelStr = getLevelPrestigeStr(displayMap, profileExtrasMap, r.id);
  const avatarSize = isFirst ? 72 : 40;
  const avatarRadius = avatarSize / 2;
  const name = displayName(r) || 'Angler';
  const displayItems = displayMap[r.id] ?? [];
  return (
    <TouchableOpacity
      style={[
        styles.podiumCardInner,
        { borderColor: borderCol, borderWidth: rank === 1 ? 5 : 1 },
        isFirst && styles.podiumCardInnerFirst,
        rank === 1 && styles.podiumCardInnerFirstGold,
        !isFirst && styles.podiumCardInnerCompact,
      ]}
      onPress={() => onPress(r.id)}
      activeOpacity={0.88}
    >
      <LinearGradient
        colors={['rgba(7,30,48,0.7)', 'rgba(2,11,20,0.95)']}
        style={StyleSheet.absoluteFill}
      />
      {isYou && (
        <View style={styles.podiumYouTag}>
          <Text style={styles.podiumYouTagText}>YOU</Text>
        </View>
      )}
      {/* Badges — bigger and brighter for 1st, small for 2nd/3rd */}
      {displayItems.length > 0 && (
        <View style={styles.podiumBadgesRow}>
          <LeaderboardBadges items={displayItems} size={isFirst ? 48 : 18} />
        </View>
      )}
      {/* Rank, name, profile pic — centered */}
      <View style={styles.podiumCenterBlock}>
        <View style={[styles.podiumRankBadge, { backgroundColor: style.bg }, isFirst && styles.podiumRankBadgeFirst]}>
          <Text style={[styles.podiumRankBadgeText, { color: style.text }, isFirst && styles.podiumRankBadgeTextFirst]}>{rankLabel}</Text>
        </View>
        <Text style={[styles.podiumName, isFirst && styles.podiumNameFirst]}>{name}</Text>
        <View style={[styles.podiumAvatarRow, !isFirst && styles.podiumAvatarRowCompact]}>
        {avatarUrl(r) ? (
          <Image
            source={{ uri: avatarUrl(r)! }}
            style={[styles.podiumAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarRadius }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.podiumAvatar, { backgroundColor: avBg, width: avatarSize, height: avatarSize, borderRadius: avatarRadius }]}>
            <Text style={[styles.podiumAvatarEmoji, isFirst && { fontSize: 36 }]}>🐟</Text>
          </View>
        )}
        </View>
      </View>
      <View style={[styles.podiumCardBody, !isFirst && styles.podiumCardBodyCompact]}>
        <Text style={[styles.podiumLevel, isFirst && styles.podiumLevelFirst, !isFirst && styles.podiumLevelCompact]} numberOfLines={1}>
          {[levelStr, r.state, `${r.wins} wins`].filter(Boolean).join(' • ')}
        </Text>
        <View style={styles.podiumTrophyRow}>
          <Ionicons name="trophy" size={isFirst ? 16 : 14} color={borderCol} />
          <Text style={[styles.podiumAR, { color: borderCol }, isFirst && styles.podiumARFirst, !isFirst && styles.podiumARCompact]}>{r.angler_rating}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Empty podium slot when local has 1 or 2 users. */
function PodiumPlaceholder({ rank }: { rank: 2 | 3 }) {
  const label = rank === 2 ? '2nd' : '3rd';
  const borderCol = rank === 2 ? '#C8D8E8' : '#E8924A';
  return (
    <View style={[styles.podiumCardInner, styles.podiumPlaceholder, { borderColor: borderCol, borderWidth: 1 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,30,48,0.5)' }]} />
      <Text style={styles.podiumPlaceholderText}>{label}</Text>
      <Text style={styles.podiumPlaceholderSub}>No angler yet</Text>
    </View>
  );
}

/** Alias for cache/stale-bundle compatibility; use TopThreePodiumCard. */
const AnglerHeroCard = TopThreePodiumCard;

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const topPadding = Math.max(4, insets.top - 4);
  const bottomPadding = useBottomSafePadding();

  const [scope, setScope] = useState<'global' | 'local'>('global');
  const [rows, setRows] = useState<AnglerLeaderboardRow[]>([]);
  const [avatarCacheBust, setAvatarCacheBust] = useState(0);
  const [displayMap, setDisplayMap] = useState<Record<string, import('@/src/lib/supabase').ProfileDisplayItem[]>>({});
  const [profileExtrasMap, setProfileExtrasMap] = useState<Record<string, { total_xp: number; prestige: number }>>({});
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<{ rank: number | null; angler_rating: number; wins: number; podiums: number } | null>(null);
  const [prestige, setPrestige] = useState<number>(0);
  const [localFallbackToGlobal, setLocalFallbackToGlobal] = useState(false);
  const { season } = useSeason();
  const gamification = useGamificationContext();
  const { state: locationState, status: locationStatus, fetchStateFromLocation } = useLocationState();

  const stateFilter = scope === 'local' ? (locationState ?? user?.state ?? null) : null;
  const userLocation = scope === 'local' && stateFilter ? stateFilter : ([user?.city, user?.state].filter(Boolean).join(', ') || user?.location || user?.state || null);

  const load = useCallback(async () => {
    setLoading(true);
    setLocalFallbackToGlobal(false);
    try {
      let list: AnglerLeaderboardRow[];
      let rankData: { rank: number | null; angler_rating: number; wins: number; podiums: number } | null = null;

      if (scope === 'local' && stateFilter) {
        const [localList, localRank, profile] = await Promise.all([
          getAnglerLeaderboard('local', stateFilter, 10000),
          user?.id ? getAnglerRank(user.id, 'local', stateFilter) : Promise.resolve(null),
          user?.id ? getUserProfile(user.id) : Promise.resolve(null),
        ]);
        const p = profile as { prestige?: number } | null;
        setPrestige(Math.min(3, Math.max(0, p?.prestige ?? 0)));

        if (localList.length === 0) {
          setLocalFallbackToGlobal(true);
          const [globalList, globalRank] = await Promise.all([
            getAnglerLeaderboard('global', null, 10000),
            user?.id ? getAnglerRank(user.id, 'global', null) : Promise.resolve(null),
          ]);
          list = globalList;
          rankData = globalRank;
        } else {
          list = localList;
          rankData = localRank;
        }
      } else {
        const effectiveScope = scope === 'local' && !stateFilter ? 'global' : scope;
        const effectiveState = scope === 'local' && !stateFilter ? null : stateFilter;
        const [fetchedList, fetchedRank, profile] = await Promise.all([
          getAnglerLeaderboard(effectiveScope, effectiveState, 10000),
          user?.id ? getAnglerRank(user.id, effectiveScope, effectiveState) : Promise.resolve(null),
          user?.id ? getUserProfile(user.id) : Promise.resolve(null),
        ]);
        list = fetchedList;
        rankData = fetchedRank;
        const p = profile as { prestige?: number } | null;
        setPrestige(Math.min(3, Math.max(0, p?.prestige ?? 0)));
      }

      let finalList = list;
      let finalMap: Record<string, import('@/src/lib/supabase').ProfileDisplayItem[]> = {};
      const userIds = [...new Set(list.map((r) => r.id))];
      const [displayItems, profileExtras] = await Promise.all([
        userIds.length > 0 ? getProfileDisplayItemsBatch(userIds) : Promise.resolve({}),
        userIds.length > 0 ? getLeaderboardProfileExtras(userIds) : Promise.resolve({}),
      ]);
      finalMap = displayItems;

      setRows(finalList);
      setAvatarCacheBust(Date.now());
      setMyRank(rankData ?? null);
      setDisplayMap(finalMap);
      setProfileExtrasMap(profileExtras);
    } catch (e) {
      console.error('[Leaderboard] load error', e);
      setRows([]);
      setMyRank(null);
    } finally {
      setLoading(false);
    }
  }, [scope, stateFilter, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const displayName = (r: AnglerLeaderboardRow) =>
    r.display_name?.trim() || r.username?.trim() || 'Angler';
  /** Two-letter initials for avatar placeholder (e.g. "GK", "JR") */
  const initials = (r: AnglerLeaderboardRow) => {
    const name = displayName(r);
    if (!name) return '?';
    const parts = name.replace(/_/g, ' ').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    return name.slice(0, 2).toUpperCase();
  };
  const avatarUrl = (r: AnglerLeaderboardRow) => {
    return getAvatarUrlWithCacheBust(r.avatar_url, avatarCacheBust) ?? null;
  };

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
        showsVerticalScrollIndicator={true}
        removeClippedSubviews={false}
      >
        {/* Header: back + LEADERBOARD + subtitle */}
          <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/tournaments'); }}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{scope === 'local' ? 'LOCAL RANKINGS' : 'GLOBAL RANKINGS'}</Text>
            <Text style={styles.subtitle}>
              ANGLER RATING • {season?.name ?? 'Season 1'}
              {season && season.days_remaining >= 0 ? ` • ${season.days_remaining} days left` : ''}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* GLOBAL / LOCAL toggle with icons */}
        <View style={styles.toggleWrap}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleSegment, scope === 'global' && styles.toggleSegmentActive]}
              onPress={() => setScope('global')}
              activeOpacity={0.8}
            >
              <Ionicons name="globe-outline" size={18} color={scope === 'global' ? '#fff' : colors.textFaint} />
              <Text numberOfLines={1} style={[styles.toggleText, scope === 'global' && styles.toggleTextActive]}>GLOBAL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleSegment, scope === 'local' && styles.toggleSegmentActive]}
              onPress={async () => {
                if (scope === 'global' && !locationState) {
                  const stateFromLoc = await fetchStateFromLocation();
                  if (stateFromLoc && user?.id) {
                    try {
                      await updateUserProfile(user.id, { state: stateFromLoc });
                    } catch (e) {
                      console.error('Failed to save state to profile:', e);
                    }
                  }
                }
                setScope('local');
              }}
              activeOpacity={0.8}
              disabled={locationStatus === 'loading'}
            >
              {locationStatus === 'loading' ? (
                <ActivityIndicator size="small" color={scope === 'local' ? '#fff' : colors.textFaint} />
              ) : (
                <Ionicons name="location-outline" size={18} color={scope === 'local' ? '#fff' : colors.textFaint} />
              )}
              <Text numberOfLines={1} style={[styles.toggleText, scope === 'local' && styles.toggleTextActive]}>LOCAL</Text>
            </TouchableOpacity>
          </View>
          {scope === 'local' && !stateFilter && (
            <Text style={styles.localHint}>Enable location to see local rankings</Text>
          )}
        </View>

        {/* YOUR RANKING card */}
        {user?.id && myRank != null && (
          <View style={styles.yourRankSection}>
            <Text style={styles.yourRankLabel}>YOUR RANKING</Text>
            <View style={styles.yourRankCard}>
              <View style={styles.yourRankIconWrap}>
                {user?.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl.startsWith('http') ? user.avatarUrl : getPublicUrl(MEDIA_BUCKET, user.avatarUrl) }}
                    style={styles.yourRankAvatar}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.yourRankIcon}>
                    {(user?.displayName || user?.username || 'You').slice(0, 2).toUpperCase() || '🎣'}
                  </Text>
                )}
              </View>
              <View style={styles.yourRankCenter}>
                <Text style={styles.yourRankUsername} numberOfLines={1}>
                  {user?.displayName || user?.username || 'You'}
                </Text>
                <Text style={styles.yourRankMeta}>
                  Level {gamification?.levelInfo?.level ?? '—'}
                  {prestige > 0 ? ` · P${prestige}` : ''}
                  {' · '}#{myRank.rank ?? '—'} {scope === 'global' || localFallbackToGlobal ? 'Global' : 'Local'}
                  {userLocation ? ` - ${userLocation}` : ''}
                </Text>
                {(() => {
                  const rank = myRank.rank ?? 0;
                  if (rank < 2) return null;
                  const personAbove = rows.find((r) => r.rank === rank - 1);
                  if (!personAbove) return null;
                  const gap = personAbove.angler_rating - myRank.angler_rating;
                  if (gap <= 0) return null;
                  return (
                    <Text style={styles.awayFromPassing}>
                      You are {gap} Trophies away from #{personAbove.rank}
                    </Text>
                  );
                })()}
              </View>
              <View style={styles.yourRankRight}>
                <View style={styles.yourRankTrophyRow}>
                  <Ionicons name="trophy" size={20} color={GOLD} />
                  <Text style={styles.yourRankAR}>{myRank.angler_rating}</Text>
                </View>
                <Text style={styles.yourRankARLabel}>TROPHIES</Text>
              </View>
            </View>
          </View>
        )}

        {scope === 'local' && localFallbackToGlobal && stateFilter && (
          <View style={styles.fallbackBanner}>
            <Text style={styles.fallbackBannerText}>
              No anglers in {stateFilter} yet — showing global rankings
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={YELLOW} />
          </View>
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>No anglers yet. Enter a tournament to get ranked.</Text>
        ) : (
          <>
            {/* Podium: 1st on top center; 2nd and 3rd below — same for global and local; use placeholders when <3 rows. */}
            {rows.length >= 1 ? (
              <View style={styles.leaderboardWrap}>
                <View style={styles.podiumTopRow}>
                  <View style={styles.podiumCardFirst}>
                    <TopThreePodiumCard
                      r={rows[0]}
                      rank={1}
                      displayName={displayName}
                      initials={initials}
                      avatarUrl={avatarUrl}
                      displayMap={displayMap}
                      profileExtrasMap={profileExtrasMap}
                      getRankStyle={getRankStyle}
                      isYou={user?.id === rows[0].id}
                      onPress={(id) => router.push(`/user/${id}`)}
                      isFirst
                    />
                  </View>
                </View>
                <View style={styles.podiumBottomRow}>
                  <View style={styles.podiumCardSecond}>
                    {rows[1] ? (
                      <TopThreePodiumCard
                        r={rows[1]}
                        rank={2}
                        displayName={displayName}
                        initials={initials}
                        avatarUrl={avatarUrl}
                        displayMap={displayMap}
                        profileExtrasMap={profileExtrasMap}
                        getRankStyle={getRankStyle}
                        isYou={user?.id === rows[1].id}
                        onPress={(id) => router.push(`/user/${id}`)}
                      />
                    ) : (
                      <PodiumPlaceholder rank={2} />
                    )}
                  </View>
                  <View style={styles.podiumCardThird}>
                    {rows[2] ? (
                      <TopThreePodiumCard
                        r={rows[2]}
                        rank={3}
                        displayName={displayName}
                        initials={initials}
                        avatarUrl={avatarUrl}
                        displayMap={displayMap}
                        profileExtrasMap={profileExtrasMap}
                        getRankStyle={getRankStyle}
                        isYou={user?.id === rows[2].id}
                        onPress={(id) => router.push(`/user/${id}`)}
                      />
                    ) : (
                      <PodiumPlaceholder rank={3} />
                    )}
                  </View>
                </View>
              </View>
            ) : null}

            {/* Rest of leaderboard: vertical list. minHeight forces layout on iOS so list is not 0-height. */}
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>Rest of leaderboard</Text>
              <View style={styles.listHeaderTrophyRow}>
                <Ionicons name="trophy" size={14} color={colors.textFaint} />
                <Text style={styles.listHeaderAR}>Trophies</Text>
              </View>
            </View>

            <View
              style={[
                styles.listWrap,
                {
                  minHeight: Math.max(0, rows.length - 3) * (isNarrow ? 60 : 68),
                },
              ]}
              collapsable={false}
            >
              {rows.slice(3).map((r, index) => {
                const displayRank = index + 4;
                const rankStyle = getRankStyle(displayRank);
                const isYou = user?.id === r.id;
                const levelStr = getLevelPrestigeStr(displayMap, profileExtrasMap, r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.row,
                      styles.rowCard,
                      isYou && styles.rowYou,
                    ]}
                    onPress={() => router.push(`/user/${r.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.rankBadge, { backgroundColor: rankStyle.bg }]}>
                      <Text style={[styles.rankBadgeText, { color: rankStyle.text }]}>{displayRank}</Text>
                    </View>
                    <View style={styles.avatarWrap}>
                      {avatarUrl(r) ? (
                        <Image source={{ uri: avatarUrl(r)! }} style={styles.avatar} resizeMode="cover" />
                      ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                          <Text style={styles.avatarPlaceholderEmoji}>🐟</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.info}>
                      <View style={styles.infoNameRow}>
                        <View style={styles.infoNameInner}>
                          <Text style={styles.username}>
                            {displayName(r) || 'Angler'}
                          </Text>
                        </View>
                        {isYou && (
                          <View style={styles.youTag}>
                            <Text style={styles.youTagText}>YOU</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.infoMetaRow}>
                        <View style={styles.infoMetaTextWrap}>
                          <Text style={styles.meta} numberOfLines={1}>
                            {[levelStr, `${r.wins} wins`].filter(Boolean).join(' • ')}
                          </Text>
                        </View>
                        <View style={styles.infoBadgesWrap}>
                          <LeaderboardBadges items={displayMap[r.id] ?? []} size={24} />
                        </View>
                      </View>
                    </View>
                    <View style={styles.arCol}>
                      <View style={styles.arColTrophyRow}>
                        <Ionicons name="trophy" size={14} color={YELLOW} />
                        <Text style={styles.arValue}>{r.angler_rating}</Text>
                      </View>
                      <Text style={styles.arChange}>—</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020b14',
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: isNarrow ? 12 : 16,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { width: 40 },
  title: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 26,
    fontWeight: '900',
    color: YELLOW,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  toggleWrap: { marginBottom: 16 },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  toggleSegmentActive: {
    backgroundColor: BLUE_ACTIVE,
    ...Platform.select({
      ios: { shadowColor: BLUE_ACTIVE, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textFaint,
    letterSpacing: 0.5,
  },
  toggleTextActive: { color: '#fff' },
  localHint: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 6,
  },

  yourRankSection: { marginBottom: 20 },
  yourRankLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: YELLOW,
    letterSpacing: 1,
    marginBottom: 8,
  },
  yourRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,200,69,0.08)',
    borderRadius: 14,
    padding: isNarrow ? 10 : 14,
    borderWidth: 1,
    borderColor: 'rgba(255,200,69,0.25)',
    gap: isNarrow ? 8 : 12,
    overflow: 'hidden',
  },
  yourRankIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,200,69,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  yourRankAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  yourRankIcon: { fontSize: 18, fontWeight: '800', color: colors.text },
  yourRankCenter: { flex: 1, minWidth: 0 },
  yourRankUsername: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  yourRankMeta: {
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 2,
  },
  yourRankRight: { alignItems: 'flex-end' },
  yourRankTrophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  yourRankAR: {
    fontSize: 28,
    fontWeight: '900',
    color: YELLOW,
  },
  yourRankARLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: YELLOW,
    opacity: 0.9,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  awayFromPassing: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal,
    marginTop: 6,
  },

  leaderboardWrap: {
    marginBottom: 16,
  },
  podiumTopRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  podiumBottomRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  podiumCardFirst: {
    width: '92%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  podiumCardSecond: {
    flex: 1,
    minWidth: 0,
  },
  podiumCardThird: {
    flex: 1,
    minWidth: 0,
  },
  podiumCardInner: {
    minHeight: 140,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    paddingVertical: 12,
    paddingHorizontal: 10,
    paddingTop: 28,
  },
  podiumCardInnerFirst: {
    minHeight: 200,
    paddingTop: 40,
    paddingBottom: 20,
    borderRadius: 16,
    ...Platform.select({
      ios: { shadowColor: '#FFD700', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  podiumCardInnerFirstGold: {
    borderColor: '#FFD700',
    borderWidth: 5,
    ...Platform.select({
      ios: { shadowColor: '#FFD700', shadowOpacity: 0.6, shadowRadius: 16 },
      android: { elevation: 12 },
    }),
  },
  podiumCardInnerCompact: {
    minHeight: 100,
    paddingTop: 20,
    paddingVertical: 8,
  },
  podiumPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumPlaceholderText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14,
    fontWeight: '700',
    color: colors.textFaint,
  },
  podiumPlaceholderSub: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 4,
    opacity: 0.8,
  },
  podiumBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  podiumCardContentCompact: {
    marginBottom: 4,
  },
  podiumAvatarRowCompact: {
    marginTop: 4,
  },
  podiumCardBodyCompact: {
    marginTop: 4,
  },
  podiumYouTag: {
    position: 'absolute',
    top: 6,
    right: 8,
    zIndex: 2,
    backgroundColor: colors.teal,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  podiumYouTagText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 9,
    fontWeight: '700',
    color: '#020b14',
    letterSpacing: 0.5,
  },
  podiumRankBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  podiumRankBadgeFirst: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  podiumRankBadgeText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 10,
    fontWeight: '800',
  },
  podiumRankBadgeTextFirst: {
    fontSize: 18,
    fontWeight: '900',
  },
  podiumCenterBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  podiumAvatarRow: {
    alignItems: 'center',
    marginTop: 8,
  },
  podiumAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  podiumAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  podiumAvatarEmoji: {
    fontSize: 22,
  },
  podiumCardBody: {
    alignItems: 'center',
    marginTop: 8,
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  podiumNameFirst: {
    fontSize: 18,
    letterSpacing: 0.5,
  },
  podiumLevel: {
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 2,
  },
  podiumLevelFirst: {
    fontSize: 11,
  },
  podiumAR: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  podiumARFirst: {
    fontSize: 20,
    marginTop: 4,
  },
  podiumLevelCompact: {
    fontSize: 9,
  },
  podiumARCompact: {
    fontSize: 12,
  },
  podiumTrophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },

  fallbackBanner: {
    backgroundColor: 'rgba(0,229,200,0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.3)',
  },
  fallbackBannerText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  listHeaderTrophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listHeaderAR: {
    fontSize: 11,
    color: YELLOW,
    fontWeight: '700',
  },

  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  empty: {
    fontSize: 15,
    color: colors.textFaint,
    textAlign: 'center',
    paddingVertical: 24,
  },

  list: { gap: 0 },
  listWrap: {
    width: '100%',
    flexDirection: 'column',
    flexShrink: 0,
    paddingBottom: 16,
  },
  row: {
    width: '100%',
    minHeight: isNarrow ? 60 : 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isNarrow ? 10 : 14,
    paddingHorizontal: isNarrow ? 8 : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: isNarrow ? 6 : 10,
    overflow: 'hidden',
  },
  rowCard: {
    borderRadius: 12,
    marginBottom: 8,
    borderBottomWidth: 0,
    paddingVertical: isNarrow ? 10 : 12,
    paddingHorizontal: isNarrow ? 10 : 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowYou: {
    backgroundColor: 'rgba(0,240,160,0.06)',
    borderRadius: 12,
    marginHorizontal: -4,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,240,160,0.35)',
  },
  rowFirst: {
    backgroundColor: 'rgba(255,200,69,0.04)',
    borderRadius: 12,
    marginHorizontal: -4,
    paddingHorizontal: 16,
  },
  rankBadge: {
    width: isNarrow ? 28 : 32,
    height: isNarrow ? 28 : 32,
    borderRadius: isNarrow ? 14 : 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadgeText: {
    fontSize: isNarrow ? 15 : 18,
    fontWeight: '900',
  },
  avatarWrap: {},
  avatar: {
    width: isNarrow ? 36 : 42,
    height: isNarrow ? 36 : 42,
    borderRadius: isNarrow ? 18 : 21,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.lightSubtext,
  },
  avatarPlaceholderEmoji: {
    fontSize: 24,
  },
  info: { flex: 1, minWidth: 0, overflow: 'hidden' },
  infoNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  infoNameInner: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  infoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    minWidth: 0,
  },
  infoMetaTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  infoBadgesWrap: {
    flexShrink: 0,
  },
  userLinkFill: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontSize: isNarrow ? 14 : 16,
    fontWeight: '700',
    color: colors.text,
    maxWidth: '100%',
  },
  youTag: {
    backgroundColor: colors.green,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#020b14',
    letterSpacing: 0.5,
  },
  meta: {
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 2,
  },
  arCol: { alignItems: 'flex-end' },
  arColTrophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arValue: {
    fontSize: 20,
    fontWeight: '900',
    color: YELLOW,
  },
  arChange: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 2,
  },
});
