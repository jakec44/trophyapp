/**
 * Profile header: banner image + profile picture with story ring + Add story.
 * Handles banner tap (change image), profile tap (view/add story).
 * Gray camera + "Add story" when no story; blue ring when story exists.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';
import { CARD_RADIUS_LG, cardShadowLight } from '@/src/constants/styles';
import type { ProfileDisplayItem } from '@/src/lib/supabase';
import { getInferredPlaceFromBadge } from '@/src/lib/supabase';
import { getLevelBadgeIcon } from '@/src/types/gamification';
import { SpeciesBadgeImage } from '@/src/components/profile/SpeciesBadgeImage';
import { hasCustomSpeciesBadgeImage } from '@/src/constants/speciesBadgeImages';
import { PLACE_PALETTE } from '@/src/types/tournamentResults';
import { AnimatedTrophyBadge } from '@/src/components/profile/AnimatedTrophyBadge';
import { RarityBadge } from '@/src/components/profile/RarityBadge';

export interface EarnedBadgeItem {
  id: string;
  label: string;
  icon: string;
}

const TEAL = colors.teal;
const ACCENT_BLUE = colors.brightBlue;
/** Blue for friends / unviewed story ring */
const FRIENDS_BLUE = colors.brightBlue;
const GOLD = colors.gold;
const SPECIES_GREEN = colors.green;
const BANNER_HEIGHT = 200;
const BANNER_RADIUS = 16;
const SCREEN_PADDING = 16;
const STORY_RING_WIDTH = 3;

interface ProfileHeaderProps {
  bannerUri: string | null;
  onBannerChange?: (uri: string) => void;
  avatarUri: string;
  username: string;
  /** Angler Rating (tournament-based competitive rank) */
  anglerRating?: number;
  /** 1-based global rank by AR. Omit to hide. */
  arRank?: number | null;
  /** 1-based local/regional rank. Placeholder shown if omitted. */
  localRank?: number | null;
  level?: number;
  /** Level title (e.g. "Angler", "Trophy Chaser") */
  levelTitle?: string;
  /** XP earned within the current level */
  xpInLevel?: number;
  /** XP required to reach the next level */
  xpForNext?: number;
  location?: string;
  /** Bio — shown below location (e.g. state like SC) in the same block */
  bio?: string;
  /** Stats: Catches, Species, Wins, Friends — tappable */
  catches?: number;
  species?: number;
  wins?: number;
  friends?: number;
  onStatPress?: (stat: 'catches' | 'species' | 'wins') => void;
  onFriendsPress?: () => void;
  /** If false, banner/avatar are display-only. Own profile = true. */
  editable?: boolean;
  /** Latest active story (from Supabase). When set, show blue ring and story viewer. */
  activeStory?: { media_url: string; id: string } | null;
  /** All active stories for viewer prev/next navigation. Defaults to [activeStory] when single. */
  stories?: { media_url: string; id: string; media_path?: string | null; caption?: string | null }[];
  /** When true, all stories have been viewed → show gray ring instead of blue. */
  storyAllViewed?: boolean;
  /** Callback when user picks an image for a story. Opens composer (Snapchat-style text overlay). */
  onPickStoryImage?: (localUri: string) => void;
  /** @deprecated Use onPickStoryImage instead. Callback when user adds a story (picker → upload). */
  onAddStory?: (localUri: string) => Promise<{ media_url: string; id: string } | null>;
  /** Callback when avatar/story is tapped and user has stories. Opens viewer at index 0. */
  onOpenStoryViewer?: (index?: number) => void;
  /** Earned badges (level + tournament). Shown floating above level/XP when present. */
  earnedBadges?: EarnedBadgeItem[];
  /** IDs of badges to display (max 3). */
  displayedBadgeIds?: string[];
  /** Called when user taps "Badges" / pencil to edit which are on display. */
  onEditBadges?: () => void;
  /** Called when user taps a displayed badge pill to see how it was earned. */
  onBadgePress?: (badge: EarnedBadgeItem) => void;
  /** Dynamic display items (badges + trophies) for "Trophies & Badges" row. When set, used instead of earnedBadges/displayedBadgeIds. */
  displayItems?: ProfileDisplayItem[];
  /** Called when user taps a display item (badge -> show how earned; trophy -> open detail modal). */
  onDisplayItemPress?: (item: ProfileDisplayItem) => void;
  /** Show blue Pro verified check next to username */
  proVerified?: boolean;
  /** Prestige level (0–3). Shown as "P1" etc next to level. */
  prestige?: number;
  /** Called when level card is tapped. Use to open prestige modal when eligible (level 15, prestige < 3). */
  onLevelPress?: () => void;
  /** Called when user taps pencil to edit bio. Use to open profile-edit or bio editor. */
  onEditBio?: () => void;
  /** Called when user taps pencil to edit profile picture. Use to open profile-edit or avatar picker. */
  onEditAvatar?: () => void;
}

export function ProfileHeader({
  bannerUri,
  onBannerChange,
  avatarUri,
  username,
  anglerRating,
  arRank,
  localRank,
  level,
  xpInLevel,
  xpForNext,
  location,
  bio,
  catches = 0,
  species = 0,
  wins = 0,
  friends,
  onStatPress,
  onFriendsPress,
  editable = false,
  activeStory = null,
  stories,
  storyAllViewed = false,
  onPickStoryImage,
  onAddStory,
  onOpenStoryViewer,
  earnedBadges = [],
  displayedBadgeIds = [],
  onEditBadges,
  onBadgePress,
  displayItems,
  onDisplayItemPress,
  proVerified = false,
  levelTitle,
  prestige = 0,
  onLevelPress,
  onEditBio,
  onEditAvatar,
}: ProfileHeaderProps) {
  const displayedBadges = earnedBadges.filter((b) => displayedBadgeIds.includes(b.id)).slice(0, 5);
  const useDisplayItems = displayItems !== undefined;
  const showRow = useDisplayItems ? (displayItems?.length ?? 0) > 0 : earnedBadges.length > 0;
  const showSection = showRow || editable;
  const router = useRouter();
  const hasActiveStory = !!activeStory?.media_url;

  const handleBannerTap = async () => {
    if (!editable || !onBannerChange) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Needed',
        'Allow access to your photo library to change the banner.',
        [{ text: 'OK' }]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      onBannerChange(result.assets[0].uri);
      // TODO: Persist to Supabase storage
    }
  };

  const openImagePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Needed',
        'Allow access to your photo library to add a story.',
        [{ text: 'OK' }]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (onPickStoryImage) {
        onPickStoryImage(uri);
      } else if (onAddStory) {
        const story = await onAddStory(uri);
        if (story) onOpenStoryViewer?.(0);
      }
    }
  };

  const handleProfileImageTap = () => {
    if (hasActiveStory && activeStory?.media_url) {
      handleOpenStoryViewer();
      return;
    }
    if (editable) openImagePicker();
  };

  const handleAddStoryTap = () => {
    if (editable) openImagePicker();
  };

  const handleOpenStoryViewer = () => onOpenStoryViewer?.(0);

  return (
    <>
      {/* Banner: full width, rounded, extends to profile card. Edit button top-right. */}
      <TouchableOpacity
        style={styles.bannerWrap}
        onPress={editable ? handleBannerTap : undefined}
        activeOpacity={editable ? 0.95 : 1}
        disabled={!editable}
      >
        {editable && onBannerChange && (
          <TouchableOpacity
            style={styles.editBannerBtn}
            onPress={handleBannerTap}
            hitSlop={8}
          >
            <Feather name="edit-2" size={16} color="#FFF" />
          </TouchableOpacity>
        )}
        {bannerUri ? (
          <Image source={{ uri: bannerUri }} style={styles.banner} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={['#0B4F6C', '#145570', '#1B7A8C', '#20B2AA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <Ionicons name="fish" size={36} color="rgba(255,255,255,0.08)" style={styles.watermark1} />
            <Ionicons name="fish" size={28} color="rgba(255,255,255,0.06)" style={styles.watermark2} />
            <Ionicons name="fish" size={32} color="rgba(255,255,255,0.07)" style={styles.watermark3} />
          </LinearGradient>
        )}
      </TouchableOpacity>

      {/* Level + XP bar — full width, minimal gaps */}
      {(level != null || (xpInLevel != null || xpForNext != null)) && (
        <TouchableOpacity
          style={styles.levelBarFullWidth}
          onPress={onLevelPress}
          activeOpacity={onLevelPress ? 0.7 : 1}
          disabled={!onLevelPress}
        >
          <View style={styles.levelCardTop}>
            <View style={styles.levelTitleRow}>
              <Text style={styles.levelLabel}>Level </Text>
              <Text style={styles.levelNum}>{level ?? '—'}</Text>
              {levelTitle ? (
                <Text style={styles.levelTitle}> {levelTitle}</Text>
              ) : null}
              {prestige > 0 && (
                <Text style={styles.prestigeLabel}> · P{prestige}</Text>
              )}
            </View>
            {xpInLevel != null && xpForNext != null && xpForNext > 0 && (
              <Text style={styles.xpTextRight}>
                {xpInLevel} <Text style={styles.xpTextOf}>/ {xpForNext} XP</Text>
              </Text>
            )}
          </View>
          {(xpInLevel != null || xpForNext != null) && (
            <View style={styles.xpBarWrap}>
              <View style={styles.xpTrack}>
                <View
                  style={[
                    styles.xpFill,
                    {
                      width: `${xpForNext != null && xpForNext > 0
                        ? Math.min(100, Math.round((xpInLevel ?? 0) / xpForNext * 100))
                        : 100}%` as any,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Profile section: avatar centered, add story under, AR stats right */}
      <View style={styles.profileSectionWrap}>
        <View style={styles.profileSection}>
          {/* Center: Profile picture + add story */}
          <View style={styles.avatarCenterWrap}>
            <View style={styles.avatarTouchWrap}>
              <TouchableOpacity
                onPress={handleProfileImageTap}
                activeOpacity={0.9}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.avatarTouch}
              >
                <View style={[
                  styles.avatarRing,
                  hasActiveStory && (storyAllViewed ? styles.avatarRingViewed : styles.avatarRingActive),
                ]}>
                  {isValidImageUri(avatarUri) ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} resizeMode="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={40} color={colors.lightSubtext} />
                    </View>
                  )}
                  <View style={styles.usernameOverlay}>
                    <Text style={styles.usernameOverlayText} numberOfLines={1}>{username}</Text>
                    {proVerified && <Ionicons name="checkmark-circle" size={14} color={FRIENDS_BLUE} style={styles.proCheckOverlay} />}
                  </View>
                  {editable && !hasActiveStory && (
                    <View style={styles.grayCameraOverlay}>
                      <Feather name="camera" size={24} color={colors.lightSubtext} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              {editable && onEditAvatar && (
                <TouchableOpacity
                  style={styles.avatarPencilBtn}
                  onPress={onEditAvatar}
                  hitSlop={8}
                  activeOpacity={0.8}
                >
                  <Feather name="edit-2" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
            {editable && (
              <TouchableOpacity
                style={styles.addStoryTouchTarget}
                onPress={handleAddStoryTap}
                activeOpacity={0.8}
              >
                <Feather name="camera" size={18} color={ACCENT_BLUE} />
                <Text style={styles.addStoryLabel}>Add story</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Right: Podium layout — Trophies top center, Global left / Local right below */}
          <View style={styles.rightColumn}>
            <View style={[styles.rankStatBlock, styles.rankStatAr, styles.rankStatCentered]}>
              <View style={styles.rankStatTrophyRow}>
                <Ionicons name="trophy" size={18} color={colors.gold} />
                <Text style={[styles.rankStatValue, styles.rankStatValueAr]}>
                  {anglerRating != null ? anglerRating : '—'}
                </Text>
              </View>
              <Text style={[styles.rankStatLabel, styles.rankStatLabelAr]}>Trophies</Text>
            </View>
            <View style={styles.rankStatRow}>
              <View style={[styles.rankStatBlock, styles.rankStatGlobal, styles.rankStatCentered, styles.rankStatHalf]}>
                <Text style={[styles.rankStatValue, styles.rankStatValueBlue]}>
                  {arRank != null ? `#${arRank}` : '—'}
                </Text>
                <Text style={[styles.rankStatLabel, styles.rankStatLabelBlue]}>Global</Text>
              </View>
              <View style={[styles.rankStatBlock, styles.rankStatLocal, styles.rankStatCentered, styles.rankStatHalf]}>
                <Text style={[styles.rankStatValue, styles.rankStatValueBlue]}>
                  {localRank != null ? `#${localRank}` : '—'}
                </Text>
                <Text style={[styles.rankStatLabel, styles.rankStatLabelBlue]}>Local</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.profileSectionLower}>
        {(location || bio || (editable && onEditBio)) ? (
          <View style={styles.locationBioBlock}>
            {location ? (
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={12} color={colors.lightSubtext} />
                <Text style={styles.location}>{location}</Text>
              </View>
            ) : null}
            {editable && onEditBio ? (
              <TouchableOpacity
                style={styles.bioRow}
                onPress={onEditBio}
                activeOpacity={0.7}
              >
                <Text style={[styles.bio, !bio?.trim() && styles.bioPlaceholder]} numberOfLines={2}>
                  {bio?.trim() ? bio : 'Add a bio'}
                </Text>
                <View style={styles.bioPencilWrap}>
                  <Feather name="edit-2" size={14} color={colors.lightSubtext} />
                </View>
              </TouchableOpacity>
            ) : bio ? (
              <Text style={styles.bio} numberOfLines={2}>{bio}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Trophies & Badges row */}
        {showSection && (
          <View style={styles.badgesFloatingWrap}>
            <TouchableOpacity
              style={styles.badgesLabelRow}
              onPress={editable ? onEditBadges : undefined}
              disabled={!editable}
              activeOpacity={editable ? 0.7 : 1}
            >
              <Text style={styles.badgesLabel}>Trophies & badges</Text>
              {editable && (
                <View style={styles.badgesPencilWrap}>
                  <Feather name="edit-2" size={12} color={colors.lightSubtext} />
                </View>
              )}
            </TouchableOpacity>
            {useDisplayItems && displayItems && displayItems.length > 0 ? (
              <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.badgesPillsRow, { paddingRight: 24 }]}
                  nestedScrollEnabled
                >
                  {displayItems.map((item) => {
                    const place = item.type === 'trophy' ? item.place : getInferredPlaceFromBadge(item.badgeKey, item.label);
                    const palette = place != null ? PLACE_PALETTE[place] : null;
                    const isGold = place === 1;
                    return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.badgePill,
                        palette && { borderColor: palette.border, borderWidth: 1.5 },
                        isGold && styles.badgePillGold,
                        hasCustomSpeciesBadgeImage(item.badgeKey) && styles.badgePillNoCircle,
                        hasCustomSpeciesBadgeImage(item.badgeKey) && styles.badgePillSpecies,
                      ]}
                      onPress={() => onDisplayItemPress?.(item)}
                      activeOpacity={0.7}
                      disabled={!onDisplayItemPress}
                    >
                      {item.type === 'badge' ? (
                        (() => {
                          const place = getInferredPlaceFromBadge(item.badgeKey, item.label);
                          if (place != null) return <AnimatedTrophyBadge place={place} size={62} />;
                          if (hasCustomSpeciesBadgeImage(item.badgeKey))
                            return <SpeciesBadgeImage badgeKey={item.badgeKey} size={68} scale={1.3} />;
                          const icon = item.badgeKey.startsWith('level-') ? getLevelBadgeIcon(item.badgeKey) : item.icon;
                          if (item.rarity) return <RarityBadge rarity={item.rarity} icon={icon} size={item.badgeKey.startsWith('level-') ? 42 : item.badgeKey.startsWith('achievement-') ? 48 : 62} animated />;
                          return <Text style={styles.badgePillIcon}>{icon}</Text>;
                        })()
                      ) : (
                        <AnimatedTrophyBadge place={item.place as 1 | 2 | 3 | 4 | 5} size={62} />
                      )}
                    </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : !useDisplayItems && displayedBadges.length > 0 ? (
                <View style={styles.badgesPillsRow}>
                  {displayedBadges.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={styles.badgePill}
                      onPress={() => onBadgePress?.(b)}
                      activeOpacity={0.7}
                      disabled={!onBadgePress}
                    >
                      <Text style={styles.badgePillIcon}>{b.icon}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : editable ? (
                <Text style={styles.badgesHint}>Tap pencil to choose up to 3</Text>
              ) : null}
          </View>
        )}
      </View>

      {/* Full-width stats row: Catches · Species · Wins · Friends (color-coded) */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statPill}
          onPress={() => onStatPress?.('catches')}
          disabled={!onStatPress}
        >
          <Text style={[styles.statValue, styles.statValueCatches]}>{catches}</Text>
          <Text style={[styles.statLabel, styles.statLabelCatches]}>Catches</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statPill}
          onPress={() => onStatPress?.('species')}
          disabled={!onStatPress}
        >
          <Text style={[styles.statValue, styles.statValueSpecies]}>{species}</Text>
          <Text style={[styles.statLabel, styles.statLabelSpecies]}>Species</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statPill}
          onPress={() => onStatPress?.('wins')}
          disabled={!onStatPress}
        >
          <Text style={[styles.statValue, styles.statValueWins]}>{wins}</Text>
          <Text style={[styles.statLabel, styles.statLabelWins]}>Wins</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statPill}
          onPress={onFriendsPress}
          disabled={!onFriendsPress}
        >
          <Text style={[styles.statValue, styles.statValueFriends]}>{friends ?? 0}</Text>
          <Text style={[styles.statLabel, styles.statLabelFriends]}>Friends</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    marginHorizontal: -SCREEN_PADDING,
    marginBottom: -24,
    overflow: 'hidden',
    borderBottomLeftRadius: BANNER_RADIUS,
    borderBottomRightRadius: BANNER_RADIUS,
  },
  banner: {
    width: '100%',
    height: BANNER_HEIGHT,
    position: 'relative',
    borderBottomLeftRadius: BANNER_RADIUS,
    borderBottomRightRadius: BANNER_RADIUS,
  },
  editBannerBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermark1: { position: 'absolute', left: 20, top: 20 },
  watermark2: { position: 'absolute', left: 80, bottom: 30 },
  watermark3: { position: 'absolute', right: 40, top: 50 },
  levelBarFullWidth: {
    marginTop: 28,
    marginHorizontal: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  profileSectionWrap: {
    marginTop: 16,
    paddingHorizontal: SCREEN_PADDING,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  avatarCenterWrap: {
    alignItems: 'center',
    flex: 0,
  },
  addStoryTouchTarget: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    minWidth: 44,
    marginTop: 6,
  },
  levelCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  levelTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    flex: 1,
  },
  xpTextRight: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightText,
  },
  levelLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
  },
  levelNum: {
    fontSize: 14,
    fontWeight: '900',
    color: GOLD,
    letterSpacing: 0.5,
  },
  levelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
    opacity: 0.95,
  },
  prestigeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 0.5,
  },
  xpBarWrap: {
    width: '100%',
  },
  avatarTouchWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  avatarTouch: {
    alignItems: 'center',
  },
  avatarPencilBtn: {
    position: 'absolute',
    bottom: 4,
    right: '50%',
    marginRight: -52,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRing: {
    padding: STORY_RING_WIDTH,
    borderRadius: 48 + STORY_RING_WIDTH,
    borderWidth: STORY_RING_WIDTH,
    borderColor: colors.lightBorder,
    backgroundColor: colors.lightCard,
  },
  avatarRingActive: {
    borderColor: FRIENDS_BLUE,
  },
  avatarRingViewed: {
    borderColor: colors.lightBorder,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: GOLD,
    backgroundColor: colors.lightBorder,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderBottomLeftRadius: 45,
    borderBottomRightRadius: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  usernameOverlayText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  proCheckOverlay: {
    marginLeft: 4,
  },
  grayCameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addStoryLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: ACCENT_BLUE,
  },
  locationBioBlock: {
    width: '100%',
    marginBottom: 18,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  location: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.lightSubtext,
  },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  bio: {
    fontSize: 14,
    color: colors.lightText,
    lineHeight: 20,
    textAlign: 'center',
    flex: 1,
  },
  bioPencilWrap: {
    padding: 4,
  },
  bioPlaceholder: {
    color: colors.lightSubtext,
    fontStyle: 'italic',
  },
  profileSectionLower: {
    marginTop: 16,
    marginBottom: 20,
    paddingHorizontal: SCREEN_PADDING,
    alignItems: 'center',
  },
  rightColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 120,
    gap: 6,
  },
  rankStatRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  rankStatBlock: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    minWidth: 64,
  },
  rankStatCentered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankStatHalf: {
    flex: 1,
    minWidth: 72,
    maxWidth: 90,
  },
  rankStatAr: {
    backgroundColor: 'rgba(255,200,69,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,69,0.35)',
    ...Platform.select({
      ios: { shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  rankStatGlobal: {
    backgroundColor: 'rgba(0,229,200,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.35)',
    ...Platform.select({
      ios: { shadowColor: TEAL, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  rankStatLocal: {
    backgroundColor: 'rgba(0,229,200,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.35)',
    ...Platform.select({
      ios: { shadowColor: TEAL, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  rankStatValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rankStatTrophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rankStatValueAr: {
    color: GOLD,
    textShadowColor: 'rgba(255,200,69,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  rankStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  rankStatLabelAr: {
    color: 'rgba(255,200,69,0.95)',
  },
  rankStatValueBlue: {
    color: TEAL,
    textShadowColor: 'rgba(0,229,200,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  rankStatLabelBlue: {
    color: 'rgba(0,229,200,0.95)',
  },
  xpWrap: {
    alignSelf: 'stretch',
    marginBottom: 20,
  },
  xpText: {
    fontSize: 10,
    fontWeight: '700',
    color: TEAL,
    marginTop: 4,
  },
  xpTextOf: {
    fontWeight: '500',
    color: colors.lightSubtext,
  },
  levelTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
    marginLeft: 4,
    opacity: 0.95,
  },
  xpTrack: {
    height: 6,
    borderRadius: 2,
    backgroundColor: 'rgba(168,196,212,0.25)',
    overflow: 'hidden',
    width: '100%',
  },
  xpFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  globalRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  globalRankLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.teal,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  globalRankNum: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.teal,
    letterSpacing: 0.5,
    textShadowColor: colors.teal,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  badgesFloatingWrap: {
    marginBottom: 18,
    marginRight: -12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingRight: 12,
    alignSelf: 'stretch',
  },
  badgesLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  badgesLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.teal,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  badgesPencilWrap: {
    padding: 2,
  },
  badgesPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'nowrap',
  },
  badgePill: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  badgePillSpecies: {
    width: 88,
    height: 88,
    overflow: 'visible' as const,
  },
  badgePillNoCircle: {
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  badgePillGold: {
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  badgePillIcon: {
    fontSize: 28,
  },
  badgePillTrophyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePillPlace: {
    fontSize: 8,
    fontWeight: '800',
    marginTop: 0,
  },
  badgesHint: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 8,
    marginBottom: 2,
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: 44,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.lightBorder,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.lightText,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.lightSubtext,
    marginTop: 2,
  },
  statValueCatches: { color: TEAL },
  statLabelCatches: { color: TEAL + 'cc' },
  statValueSpecies: { color: SPECIES_GREEN },
  statLabelSpecies: { color: SPECIES_GREEN + 'cc' },
  statValueWins: { color: GOLD },
  statLabelWins: { color: GOLD + 'dd' },
  statValueFriends: { color: FRIENDS_BLUE },
  statLabelFriends: { color: FRIENDS_BLUE + 'cc' },
});
