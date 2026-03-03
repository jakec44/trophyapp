import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserLink } from '@/src/components/profile/UserLink';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';
import type { FishEntry, MetricType } from '@/src/types/tournaments';
import { formatMetric, getEntryMetricValue, getMetricUnitShort } from '@/src/types/tournaments';
import { VoteButtons } from './VoteButtons';
import { PodiumBadge } from '@/src/components/competitions/PodiumBadge';
import {
  ENTRY_IMAGE_WIDTH,
  ENTRY_IMAGE_HEIGHT,
  ENTRY_IMAGE_RADIUS,
  AVATAR_SIZE_COMPETITION,
  cardShadow,
  ROW_PADDING_V,
  ROW_GAP,
  RANK_COL_WIDTH,
  VOTE_BUTTONS_MIN_WIDTH,
  ENTRY_IMAGE_WIDTH_COMPACT,
  ENTRY_IMAGE_HEIGHT_COMPACT,
  AVATAR_SIZE_COMPACT,
  ENTRY_IMAGE_WIDTH_HERO,
  ENTRY_IMAGE_HEIGHT_HERO,
  AVATAR_SIZE_HERO,
  ENTRY_IMAGE_WIDTH_MICRO,
  ENTRY_IMAGE_HEIGHT_MICRO,
  AVATAR_SIZE_MICRO,
} from '@/src/constants/styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AVATAR_COLORS = ['#4A90E2', '#D4AF37', '#4CAF50', '#9C27B0', '#E91E63'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || '??';
}

function getColorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash += key.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getRankBorderColor(rank: number): string {
  if (rank === 1) return 'rgba(255,200,69,0.3)';
  if (rank === 2) return 'rgba(168,196,212,0.2)';
  if (rank === 3) return 'rgba(200,121,65,0.2)';
  return 'rgba(0,229,200,0.15)';
}

function getRankAvatarBorder(rank: number): string {
  if (rank === 1) return colors.gold;
  if (rank === 2) return colors.silver;
  if (rank === 3) return colors.bronze;
  return colors.teal;
}

const CARD_BG = '#071e30';
const CARD_BG_HOVER = '#0a2840';

function getTournamentCardBorder(rank: number): string {
  if (rank === 1) return 'rgba(255,200,69,0.5)';
  if (rank === 2) return 'rgba(168,196,212,0.4)';
  if (rank === 3) return 'rgba(200,121,65,0.4)';
  return 'rgba(0,0,0,0.3)';
}

function getWeightBadgeColor(rank: number): string {
  if (rank === 1) return colors.gold;
  return '#FFFFFF';
}

interface LeaderboardRowProps {
  entry: FishEntry;
  rank: number;
  metricType: MetricType;
  onVote: (entryId: string, vote: 'UP' | 'DOWN' | null) => void;
  voteLoading?: string | null;
  /** When true, use PodiumBadge for ranks 1-3 (default: true) */
  usePodiumBadge?: boolean;
  /** Compact mode for 2nd/3rd podium tiles (horizontal layout) */
  compact?: boolean;
  /** Hero = large cards; micro = dense list; tournamentCard = voting card; restCard = rest-of-leaderboard layout */
  variant?: 'default' | 'hero' | 'micro' | 'tournamentCard' | 'restCard';
  /** Show "YOU" label - for current user's position card */
  isYou?: boolean;
  /** Disable vote buttons (e.g. self-vote prevention) */
  disableVote?: boolean;
  /** Stagger delay (ms) for entrance animation */
  animationDelay?: number;
}

export function LeaderboardRow({
  entry,
  rank,
  metricType,
  onVote,
  voteLoading,
  usePodiumBadge = true,
  compact = false,
  variant = 'default',
  isYou = false,
  disableVote = false,
  animationDelay = 0,
}: LeaderboardRowProps) {
  const router = useRouter();
  const [avatarError, setAvatarError] = useState(false);
  // True aspect ratio of the submitted fish photo (width / height)
  const [fishAspectRatio, setFishAspectRatio] = useState<number | null>(null);
  const value = getEntryMetricValue(entry, metricType);
  const display = formatMetric(value, metricType);
  const displayLabel = (entry.displayName ?? entry.username).trim() || entry.username;
  const initials = getInitials(displayLabel);
  const avatarColor = getColorForKey(entry.userId);

  const [catchModalVisible, setCatchModalVisible] = useState(false);

  const handleProfilePress = () => {
    router.push(`/user/${entry.userId}`);
  };

  const handleFishThumbPress = () => {
    setCatchModalVisible(true);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60_000);
    const h = Math.floor(diff / 3600_000);
    const d = Math.floor(diff / 86400_000);
    if (m < 1) return 'Entered just now';
    if (m < 60) return `Entered ${m}m ago`;
    if (h < 24) return `Entered ${h}h ago`;
    if (d < 7) return `Entered ${d}d ago`;
    return formatDate(iso);
  };

  const isHero = variant === 'hero';
  const isMicro = variant === 'micro';
  const isTournamentCard = variant === 'tournamentCard';
  const isRestCard = variant === 'restCard';

  const entranceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isTournamentCard) return;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(entranceAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    }, animationDelay);
    return () => clearTimeout(timer);
  }, [isTournamentCard, animationDelay, entranceAnim]);

  // Pulse the whole hero rank badge (no circular glow)
  const heroPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isHero || rank > 3) return;
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroPulse, { toValue: 1.07, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(heroPulse, { toValue: 1,    duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(1400),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [isHero, rank]);
  const effectiveCompact = compact || isMicro;
  const avatarSize = isHero || isTournamentCard ? AVATAR_SIZE_HERO : isRestCard ? 28 : effectiveCompact ? AVATAR_SIZE_MICRO : AVATAR_SIZE_COMPETITION;
  const avatarBorderColor = (isHero || isTournamentCard) && rank <= 3 ? getRankAvatarBorder(rank) : undefined;
  const AvatarOrPlaceholder = (
    isValidImageUri(entry.avatarUrl) && !avatarError ? (
      <View style={[
        styles.avatarWrap,
        { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
        (isHero || isTournamentCard) && avatarBorderColor && { borderColor: avatarBorderColor, borderWidth: 2 },
      ]}>
        <Image
          source={{ uri: entry.avatarUrl }}
          style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
          onError={() => setAvatarError(true)}
        />
      </View>
    ) : (
      <View style={[
        styles.avatar,
        styles.avatarPlaceholder,
        { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: avatarColor },
        (isHero || isTournamentCard) && avatarBorderColor && { borderWidth: 2, borderColor: avatarBorderColor },
      ]}>
        <Text style={[styles.initials, effectiveCompact && { fontSize: 9 }, isMicro && { fontSize: 8 }]}>{initials}</Text>
      </View>
    )
  );

  const RankDisplay =
    usePodiumBadge && rank <= 3 ? (
      <PodiumBadge place={rank as 1 | 2 | 3} />
    ) : (
      <Text style={styles.rankText}>#{rank}</Text>
    );

  const fishPhotoUrl = entry.imageUrl;
  const hasFishPhoto = isValidImageUri(fishPhotoUrl);

  const imgW = isHero ? ENTRY_IMAGE_WIDTH_HERO : effectiveCompact ? ENTRY_IMAGE_WIDTH_MICRO : ENTRY_IMAGE_WIDTH;
  const imgH = isHero ? ENTRY_IMAGE_HEIGHT_HERO : effectiveCompact ? ENTRY_IMAGE_HEIGHT_MICRO : ENTRY_IMAGE_HEIGHT;
  const weightBadgeColor = rank === 1 ? colors.gold : colors.teal;
  const weightDisplay = value != null ? (typeof value === 'number' ? value.toFixed(1) : String(value)) : '—';

  const FISH_WIDTH_CARD = 120;
  const FISH_HEIGHT_CARD = 120;
  const weightColorCard = getWeightBadgeColor(rank);
  const metricUnit = getMetricUnitShort(metricType);

  const FishThumbnail = (
    <TouchableOpacity onPress={handleFishThumbPress} activeOpacity={0.8} style={[styles.fishThumbWrap, (compact || isMicro || isHero) && { width: imgW, height: imgH }, isTournamentCard && { width: FISH_WIDTH_CARD, height: FISH_HEIGHT_CARD, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, marginLeft: 0 }]}>
      {hasFishPhoto ? (
        <View style={[styles.fishThumb, { width: imgW, height: imgH }, isTournamentCard && { width: FISH_WIDTH_CARD, height: FISH_HEIGHT_CARD, ...StyleSheet.absoluteFillObject }]}>
          <Image source={{ uri: fishPhotoUrl }} style={[isTournamentCard ? { width: FISH_WIDTH_CARD, height: FISH_HEIGHT_CARD } : { width: imgW, height: imgH }]} resizeMode="cover" />
          {(isHero || isTournamentCard) && (
            <>
              <LinearGradient
                colors={['transparent', 'rgba(0,20,40,0.7)']}
                locations={[0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.weightBadge, { borderColor: isTournamentCard ? weightColorCard : weightBadgeColor }]}>
                <Text style={[styles.weightBadgeNum, { color: isTournamentCard ? weightColorCard : weightBadgeColor }]}>{weightDisplay}</Text>
                <Text style={[styles.weightBadgeUnit, isTournamentCard && { fontSize: 9 }]}>{metricUnit}</Text>
              </View>
            </>
          )}
        </View>
      ) : (
        <View style={[styles.fishThumb, styles.fishThumbPlaceholder, { width: imgW, height: imgH, backgroundColor: avatarColor }, isTournamentCard && { width: FISH_WIDTH_CARD, height: FISH_HEIGHT_CARD, ...StyleSheet.absoluteFillObject }]}>
          <Text style={styles.fishEmoji}>🐟</Text>
          {(isHero || isTournamentCard) && (
            <View style={[styles.weightBadge, styles.weightBadgeBottom, { borderColor: isTournamentCard ? weightColorCard : weightBadgeColor }]}>
              <Text style={[styles.weightBadgeNum, { color: isTournamentCard ? weightColorCard : weightBadgeColor }]}>{weightDisplay}</Text>
              <Text style={[styles.weightBadgeUnit, isTournamentCard && { fontSize: 9 }]}>{metricUnit}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  if (isTournamentCard) {
    const cardOpacity = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const cardTranslateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

    return (
      <>
        <Animated.View
          style={[
            styles.tournamentCard,
            {
              backgroundColor: CARD_BG,
              borderColor: getTournamentCardBorder(rank),
              borderWidth: 1,
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
            rank === 1 && styles.tournamentCardFirst,
          ]}
        >
          <Pressable
            style={({ pressed }) => [pressed && styles.tournamentCardPressed]}
            onPress={() => setCatchModalVisible(true)}
          >
            <View style={styles.tournamentCardInner}>
              <View style={styles.tournamentCardLeft}>
                {FishThumbnail}
              </View>
              <View style={styles.tournamentCardRight}>
                <View style={styles.tournamentCardTop}>
                  <TouchableOpacity
                    style={styles.tournamentCardUserArea}
                    onPress={handleProfilePress}
                    activeOpacity={0.8}
                  >
                    <View style={styles.tournamentCardAvatarWrap}>
                      {AvatarOrPlaceholder}
                    </View>
                    <View style={styles.tournamentCardUserText}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.tournamentCardUsername} numberOfLines={1}>{displayLabel}</Text>
                        {entry.proVerified && <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />}
                      </View>
                      <Text style={styles.tournamentCardEntryTime}>{formatRelativeTime(entry.createdAt)}</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.tournamentCardRankWrap}>
                    {RankDisplay}
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
          <View style={styles.tournamentCardBottom} pointerEvents="box-none">
            <VoteButtons
              upVotes={entry.upVotes}
              downVotes={entry.downVotes}
              userVote={entry.userVote ?? null}
              onVote={(v) => onVote(entry.id, v)}
              loading={voteLoading === entry.id}
              disabled={disableVote}
              dark
              fullWidthBar
            />
          </View>
        </Animated.View>

        <Modal
          visible={catchModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCatchModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setCatchModalVisible(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <TouchableOpacity style={styles.modalClose} onPress={() => setCatchModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={28} color={colors.lightText} />
              </TouchableOpacity>
              {hasFishPhoto ? (
                <Image source={{ uri: fishPhotoUrl }} style={styles.modalPhoto} resizeMode="contain" />
              ) : (
                <View style={[styles.modalPhotoPlaceholder, { backgroundColor: avatarColor }]}>
                  <Text style={styles.modalFishEmoji}>🐟</Text>
                </View>
              )}
              <View style={styles.modalDetails}>
                <Text style={styles.modalSpecies}>{entry.species ?? 'Fish'}</Text>
                <Text style={styles.modalMeta}>
                  {entry.weightLbs != null && `${entry.weightLbs.toFixed(1)} lbs`}
                  {entry.weightLbs != null && ' • '}
                  {entry.lengthIn != null ? `${entry.lengthIn}"` : '—'} in
                </Text>
                <Text style={styles.modalDate}>Caught {formatDate(entry.createdAt)}</Text>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </>
    );
  }

  if (isRestCard) {
    const REST_AVATAR_SIZE = 28;
    return (
      <>
        <View style={styles.restCard}>
          <Pressable
            style={({ pressed }) => [styles.restCardPressable, pressed && styles.restCardPressed]}
            onPress={() => setCatchModalVisible(true)}
          >
            {/* Top row: avatar · username/time · rank — all on one horizontal line, never vertical */}
            <View style={styles.restCardTop}>
              <TouchableOpacity
                style={styles.restCardUserArea}
                onPress={handleProfilePress}
                activeOpacity={0.8}
              >
                {isValidImageUri(entry.avatarUrl) && !avatarError ? (
                  <Image
                    source={{ uri: entry.avatarUrl }}
                    style={{ width: REST_AVATAR_SIZE, height: REST_AVATAR_SIZE, borderRadius: REST_AVATAR_SIZE / 2, flexShrink: 0 }}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <View style={{ width: REST_AVATAR_SIZE, height: REST_AVATAR_SIZE, borderRadius: REST_AVATAR_SIZE / 2, backgroundColor: avatarColor, flexShrink: 0, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={styles.initials}>{initials}</Text>
                  </View>
                )}
                <View style={styles.restCardUserText}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.restCardUsername} numberOfLines={1} ellipsizeMode="tail">{displayLabel}</Text>
                    {entry.proVerified && <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />}
                  </View>
                  <Text style={styles.restCardEntryTime} numberOfLines={1}>{formatRelativeTime(entry.createdAt)}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.restCardRankWrap}>
                {RankDisplay}
              </View>
            </View>

            {/* Fish photo — compact 4:5 for smaller cards */}
            <View style={[styles.restCardFishWrap, { aspectRatio: 3 / 4 }]}>
              {hasFishPhoto ? (
                <View style={styles.restCardFish}>
                  <Image
                    source={{ uri: fishPhotoUrl }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,20,40,0.7)']}
                    locations={[0.5, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[styles.restCardWeightBadge, { borderColor: colors.teal }]}>
                    <Text style={[styles.restCardWeightNum, { color: colors.teal }]}>{weightDisplay}</Text>
                    <Text style={styles.restCardWeightUnit}>{metricUnit}</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.restCardFish, styles.restCardFishPlaceholder, { backgroundColor: avatarColor }]}>
                  <Text style={styles.fishEmoji}>🐟</Text>
                  <View style={[styles.restCardWeightBadge, { borderColor: colors.teal }]}>
                    <Text style={[styles.restCardWeightNum, { color: colors.teal }]}>{weightDisplay}</Text>
                    <Text style={styles.restCardWeightUnit}>{metricUnit}</Text>
                  </View>
                </View>
              )}
            </View>
          </Pressable>
          <View style={styles.restCardVoteRow} pointerEvents="box-none">
            <VoteButtons
              upVotes={entry.upVotes}
              downVotes={entry.downVotes}
              userVote={entry.userVote ?? null}
              onVote={(v) => onVote(entry.id, v)}
              loading={voteLoading === entry.id}
              disabled={disableVote}
              dark
              compact
            />
          </View>
        </View>
        <Modal
          visible={catchModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCatchModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setCatchModalVisible(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <TouchableOpacity style={styles.modalClose} onPress={() => setCatchModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={28} color={colors.lightText} />
              </TouchableOpacity>
              {hasFishPhoto ? (
                <Image source={{ uri: fishPhotoUrl }} style={styles.modalPhoto} resizeMode="contain" />
              ) : (
                <View style={[styles.modalPhotoPlaceholder, { backgroundColor: avatarColor }]}>
                  <Text style={styles.modalFishEmoji}>🐟</Text>
                </View>
              )}
              <View style={styles.modalDetails}>
                <Text style={styles.modalSpecies}>{entry.species ?? 'Fish'}</Text>
                <Text style={styles.modalMeta}>
                  {entry.weightLbs != null && `${entry.weightLbs.toFixed(1)} lbs`}
                  {entry.weightLbs != null && ' • '}
                  {entry.lengthIn != null ? `${entry.lengthIn}"` : '—'} in
                </Text>
                <Text style={styles.modalDate}>Caught {formatDate(entry.createdAt)}</Text>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </>
    );
  }

  if (isHero) {

    // Gold / Silver / Bronze palette
    const borderCol    = rank === 1 ? '#FFD700'                    : rank === 2 ? '#C8D8E8'                    : '#E8924A';
    const glowCol      = rank === 1 ? 'rgba(255,215,0,0.45)'       : rank === 2 ? 'rgba(180,210,240,0.32)'     : 'rgba(220,130,60,0.38)';
    const rankTxtCol   = rank === 1 ? '#FFD700'                    : rank === 2 ? '#C8D8E8'                    : '#E8924A';
    const rankBadgeBg  = rank === 1 ? 'rgba(28,18,0,0.88)'         : rank === 2 ? 'rgba(8,16,28,0.88)'         : 'rgba(22,8,0,0.88)';
    const rankBadgeBd  = rank === 1 ? 'rgba(255,215,0,0.65)'       : rank === 2 ? 'rgba(180,210,240,0.55)'     : 'rgba(220,130,60,0.55)';
    const wtCol        = rank === 1 ? '#FFD700'                    : rank === 2 ? '#C8D8E8'                    : '#E8924A';
    const avBg         = rank === 1 ? '#3d2600'                    : rank === 2 ? '#1a2530'                    : '#2a1500';
    const avBd         = rank === 1 ? 'rgba(255,215,0,0.55)'       : rank === 2 ? 'rgba(180,210,240,0.45)'     : 'rgba(220,130,60,0.4)';
    const trophyColor  = rank === 1 ? '#FFD700'                    : rank === 2 ? '#C8D8E8'                    : '#E8924A';
    const rankLabel    = rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd';
    const trophySize   = rank === 1 ? 16 : 14;
    const avSz         = rank === 1 ? 26 : 22;

    return (
      <>
        <View
          style={[
            styles.heroCard,
            {
              aspectRatio: 9 / 16,
              borderColor: borderCol,
              borderWidth: rank === 1 ? 2 : 1.5,
            },
            Platform.select({
              ios: {
                shadowColor: borderCol,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.55,
                shadowRadius: rank === 1 ? 14 : 10,
              },
              android: { elevation: rank === 1 ? 8 : 5 },
            }),
          ]}
        >
          {isYou && (
            <View style={styles.youPill}>
              <Text style={styles.youPillText}>YOU</Text>
            </View>
          )}

          {/* Fish photo — fills card but leaves bottom bar uncovered so VoteButtons receive touches */}
          <TouchableOpacity
            onPress={handleFishThumbPress}
            activeOpacity={0.88}
            style={[StyleSheet.absoluteFill, { bottom: 72 }]}
          >
            {hasFishPhoto ? (
              <Image
                source={{ uri: fishPhotoUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#091a3a', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: rank === 1 ? 52 : 40 }}>🐟</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Dark gradient — transparent at top, black at bottom */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.92)']}
            locations={[0.28, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* UI layer: rank badge top-left + user/votes bottom */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Trophy badge — whole pill pulses */}
            <Animated.View
              style={[
                styles.heroPodRank,
                { backgroundColor: rankBadgeBg, borderColor: rankBadgeBd, transform: [{ scale: heroPulse }] },
              ]}
            >
              <Ionicons name="trophy" size={trophySize} color={trophyColor} />
              <Text style={[styles.heroPodRankTxt, { color: rankTxtCol }]}>
                {rankLabel}
              </Text>
            </Animated.View>

            {/* Bottom: user info + votes */}
            <View style={styles.heroPodBottom} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.heroPodUser}
                onPress={handleProfilePress}
                activeOpacity={0.8}
              >
                {isValidImageUri(entry.avatarUrl) && !avatarError ? (
                  <Image
                    source={{ uri: entry.avatarUrl }}
                    style={[styles.heroPodAvatar, { width: avSz, height: avSz, borderRadius: avSz / 2, borderColor: avBd }]}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <View style={[styles.heroPodAvatar, { width: avSz, height: avSz, borderRadius: avSz / 2, backgroundColor: avBg, borderColor: avBd }]}>
                    <Text style={[styles.heroPodAvatarTxt, { color: rankTxtCol, fontSize: avSz < 24 ? 7 : 8 }]}>
                      {initials.slice(0, 2)}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.heroPodName} numberOfLines={1} ellipsizeMode="tail">
                    {displayLabel}
                  </Text>
                  <Text style={[styles.heroPodWeight, { color: wtCol }]}>
                    {weightDisplay} {metricUnit}
                  </Text>
                </View>
              </TouchableOpacity>

              <VoteButtons
                upVotes={entry.upVotes}
                downVotes={entry.downVotes}
                userVote={entry.userVote ?? null}
                onVote={(v) => onVote(entry.id, v)}
                loading={voteLoading === entry.id}
                disabled={disableVote}
                dark
                compact={rank !== 1}
                fullWidthBar={rank === 1}
              />
            </View>
          </View>
        </View>

        <Modal
          visible={catchModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCatchModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setCatchModalVisible(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setCatchModalVisible(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={28} color={colors.lightText} />
              </TouchableOpacity>
              {hasFishPhoto ? (
                <Image source={{ uri: fishPhotoUrl }} style={styles.modalPhoto} resizeMode="contain" />
              ) : (
                <View style={[styles.modalPhotoPlaceholder, { backgroundColor: avatarColor }]}>
                  <Text style={styles.modalFishEmoji}>🐟</Text>
                </View>
              )}
              <View style={styles.modalDetails}>
                <Text style={styles.modalSpecies}>{entry.species ?? 'Fish'}</Text>
                <Text style={styles.modalMeta}>
                  {entry.weightLbs != null && `${entry.weightLbs.toFixed(1)} lbs`}
                  {entry.weightLbs != null && ' • '}
                  {entry.lengthIn != null ? `${entry.lengthIn}"` : '—'} in
                </Text>
                <Text style={styles.modalDate}>Caught {formatDate(entry.createdAt)}</Text>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </>
    );
  }

  return (
    <>
      <View style={[
        styles.row,
        (compact || isMicro) && styles.rowCompact,
        isMicro && styles.rowMicro,
        isHero && styles.rowHero,
        isHero && { borderColor: getRankBorderColor(rank), borderWidth: 1, borderRadius: 12 },
      ]}>
        <View style={styles.rankCol}>{RankDisplay}</View>
        {FishThumbnail}
        <UserLink
          userId={entry.userId}
          username={displayLabel}
          proVerified={entry.proVerified}
          avatarUrl={entry.avatarUrl}
          onPressOverride={handleProfilePress}
          style={styles.userCol}
        >
          <View style={styles.userColContent}>
            <Text style={[styles.username, isHero && styles.usernameHero]} numberOfLines={1} ellipsizeMode="tail">
              {displayLabel}
            </Text>
            <Text style={[styles.metric, isHero && styles.metricHero]}>
              {isHero ? formatRelativeTime(entry.createdAt) : display}
            </Text>
          </View>
          {AvatarOrPlaceholder}
        </UserLink>
        <View style={[styles.voteWrap, (compact || isMicro) && { minWidth: 64 }]}>
          <VoteButtons
            upVotes={entry.upVotes}
            downVotes={entry.downVotes}
            userVote={entry.userVote ?? null}
            onVote={(v) => onVote(entry.id, v)}
            loading={voteLoading === entry.id}
            disabled={disableVote}
            dark={isHero}
          />
        </View>
      </View>

      <Modal
        visible={catchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCatchModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCatchModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setCatchModalVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={28} color={colors.lightText} />
            </TouchableOpacity>
            {hasFishPhoto ? (
              <Image
                source={{ uri: fishPhotoUrl }}
                style={styles.modalPhoto}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.modalPhotoPlaceholder, { backgroundColor: avatarColor }]}>
                <Text style={styles.modalFishEmoji}>🐟</Text>
              </View>
            )}
            <View style={styles.modalDetails}>
              <Text style={styles.modalSpecies}>{entry.species ?? 'Fish'}</Text>
              <Text style={styles.modalMeta}>
                {entry.weightLbs != null && `${entry.weightLbs.toFixed(1)} lbs`}
                {entry.weightLbs != null && ' • '}
                {entry.lengthIn != null ? `${entry.lengthIn}"` : '—'} in
              </Text>
              <Text style={styles.modalDate}>Caught {formatDate(entry.createdAt)}</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ROW_PADDING_V,
    paddingHorizontal: ROW_GAP,
    width: '100%',
    minWidth: 0,
  },
  rowCompact: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  rowMicro: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    minHeight: 56,
  },
  rowHero: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  heroCard: {
    borderRadius: 16,
    overflow: 'hidden',
    minWidth: 0,
    position: 'relative',
  },
  heroPodRank: {
    alignSelf: 'flex-start',
    margin: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroPodRankTxt: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  heroPodBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 7,
    paddingBottom: 8,
    paddingTop: 14,
    gap: 5,
  },
  heroPodUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    marginBottom: 4,
  },
  heroPodAvatar: {
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  heroPodAvatarTxt: {
    fontWeight: '700',
  },
  heroPodName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  heroPodWeight: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 9,
    marginTop: 1,
  },
  tournamentCard: {
    flexDirection: 'column',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
    minHeight: 120,
  },
  tournamentCardFirst: {
    borderTopWidth: 2,
    borderTopColor: 'rgba(255,200,69,0.6)',
  },
  tournamentCardPressed: {
    backgroundColor: CARD_BG_HOVER,
  },
  restCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  restCardPressable: {
    flex: 1,
  },
  restCardPressed: {
    backgroundColor: CARD_BG_HOVER,
  },
  restCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    paddingTop: 5,
    paddingBottom: 3,
    gap: 3,
  },
  restCardUserArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  restCardAvatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0,
  },
  restCardUserText: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  restCardUsername: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
  },
  restCardEntryTime: {
    fontSize: 8,
    color: colors.textFaint,
    marginTop: 1,
  },
  restCardRankWrap: {
    flexShrink: 0,
  },
  restCardFishWrap: {
    // aspectRatio set inline based on the image's actual dimensions
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  restCardFish: {
    ...StyleSheet.absoluteFillObject,
  },
  restCardFishPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  restCardWeightBadge: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  restCardWeightNum: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 9,
  },
  restCardWeightUnit: {
    fontSize: 8,
    color: colors.teal,
  },
  restCardVoteRow: {
    width: '100%',
    paddingHorizontal: 5,
    paddingVertical: 3,
    paddingBottom: 5,
  },
  tournamentCardInner: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 120,
  },
  tournamentCardLeft: {
    width: 120,
    minHeight: 120,
    alignSelf: 'stretch',
    position: 'relative',
  },
  tournamentCardRight: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  tournamentCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  tournamentCardUserArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  tournamentCardAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tournamentCardUserText: {
    flex: 1,
    minWidth: 0,
  },
  tournamentCardUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  tournamentCardEntryTime: {
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 2,
  },
  tournamentCardRankWrap: {},
  tournamentCardBottom: {
    width: '100%',
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 6,
  },
  youPill: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 2,
    backgroundColor: colors.teal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  youPillText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 10,
    fontWeight: '700',
    color: colors.abyss,
    letterSpacing: 1,
  },
  usernameOverlayText: {
    fontSize: 13,
    fontFamily: 'Sora_600SemiBold',
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    minWidth: 0,
  },
  usernameOverlayInitials: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
  },
  rankCol: {
    width: RANK_COL_WIDTH,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.lightSubtext,
  },
  userCol: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: ROW_GAP,
    gap: 8,
  },
  userColContent: {
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: AVATAR_SIZE_COMPETITION,
    height: AVATAR_SIZE_COMPETITION,
    borderRadius: AVATAR_SIZE_COMPETITION / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholder: {},
  avatarWrap: {
    borderRadius: 100,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  initials: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.lightText,
  },
  usernameHero: {
    fontSize: 14,
    fontFamily: 'Sora_600SemiBold',
    color: colors.text,
  },
  metric: {
    fontSize: 11,
    color: colors.lightSubtext,
  },
  metricHero: {
    fontSize: 10,
    color: colors.textFaint,
  },
  weightBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(2,11,20,0.75)',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  weightBadgeBottom: {
    bottom: 8,
    left: 8,
  },
  weightBadgeNum: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 14,
  },
  weightBadgeUnit: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 9,
    color: colors.textFaint,
    marginTop: 0,
  },
  voteWrap: {
    flexShrink: 0,
    minWidth: VOTE_BUTTONS_MIN_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: ROW_GAP,
  },
  fishThumbWrap: {
    width: ENTRY_IMAGE_WIDTH,
    height: ENTRY_IMAGE_HEIGHT,
    flexShrink: 0,
    borderRadius: ENTRY_IMAGE_RADIUS,
    marginLeft: 0,
    backgroundColor: colors.lightCard,
    ...cardShadow,
  },
  fishThumb: {
    width: ENTRY_IMAGE_WIDTH,
    height: ENTRY_IMAGE_HEIGHT,
    borderRadius: ENTRY_IMAGE_RADIUS,
    overflow: 'hidden',
  },
  fishThumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fishEmoji: {
    fontSize: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH - 32,
    maxWidth: 400,
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: -44,
    right: 0,
    zIndex: 10,
  },
  modalPhoto: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
    maxWidth: 400,
    maxHeight: 400,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  modalPhotoPlaceholder: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
    maxWidth: 400,
    maxHeight: 400,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFishEmoji: {
    fontSize: 80,
  },
  modalDetails: {
    marginTop: 20,
    alignItems: 'center',
  },
  modalSpecies: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  modalMeta: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gold,
    marginTop: 6,
  },
  modalDate: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginTop: 4,
  },
});
