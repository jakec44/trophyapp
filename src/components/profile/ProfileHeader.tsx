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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';
import { CARD_RADIUS_LG, cardShadowLight } from '@/src/constants/styles';

export interface EarnedBadgeItem {
  id: string;
  label: string;
  icon: string;
}

const ACCENT_BLUE = colors.brightBlue;
/** Blue ring when user hasn't viewed the story yet (clear, classic blue) */
const RING_UNVIEWED_BLUE = '#3B82F6';
const GOLD = colors.gold;
const BANNER_HEIGHT = 200;
const BANNER_RADIUS = 16;
const SCREEN_PADDING = 16;
const STORY_RING_WIDTH = 3;

interface ProfileHeaderProps {
  bannerUri: string | null;
  onBannerChange?: (uri: string) => void;
  avatarUri: string;
  username: string;
  globalRank?: number;
  level?: number;
  /** XP earned within the current level */
  xpInLevel?: number;
  /** XP required to reach the next level */
  xpForNext?: number;
  location?: string;
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
  /** IDs of badges to display (max 5). */
  displayedBadgeIds?: string[];
  /** Called when user taps "Badges" / pencil to edit which are on display. */
  onEditBadges?: () => void;
  /** Show blue Pro verified check next to username */
  proVerified?: boolean;
}

export function ProfileHeader({
  bannerUri,
  onBannerChange,
  avatarUri,
  username,
  globalRank = 247,
  level,
  xpInLevel,
  xpForNext,
  location,
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
  proVerified = false,
}: ProfileHeaderProps) {
  const displayedBadges = earnedBadges.filter((b) => displayedBadgeIds.includes(b.id)).slice(0, 5);
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

      {/* Profile row: avatar overlaps banner bottom */}
      <View style={styles.profileRow}>
        <View style={styles.avatarWrap}>
          <TouchableOpacity
            onPress={handleProfileImageTap}
            activeOpacity={0.9}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
              {editable && !hasActiveStory && (
                <View style={styles.grayCameraOverlay}>
                  <Feather name="camera" size={24} color={colors.lightSubtext} />
                </View>
              )}
            </View>
          </TouchableOpacity>
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
        <View style={styles.profileInfo}>
          <View style={styles.usernameRow}>
            <Text style={styles.username} numberOfLines={1}>{username}</Text>
            {proVerified && <Ionicons name="checkmark-circle" size={18} color="#3B82F6" style={styles.proCheck} />}
          </View>
          {location ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={colors.lightSubtext} />
              <Text style={styles.location}>{location}</Text>
            </View>
          ) : null}

          {/* Level pill */}
          {level !== undefined && (
            <View style={styles.levelRow}>
              <View style={styles.levelPill}>
                <Text style={styles.levelPillTxt}>LV {level}</Text>
              </View>
              {xpInLevel !== undefined && xpForNext !== undefined && xpForNext > 0 && (
                <Text style={styles.xpText}>{xpInLevel} <Text style={styles.xpTextOf}>/ {xpForNext} XP</Text></Text>
              )}
            </View>
          )}

          {/* XP bar */}
          {xpInLevel !== undefined && xpForNext !== undefined && xpForNext > 0 && (
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.min(100, Math.round((xpInLevel / xpForNext) * 100))}%` as any }]} />
            </View>
          )}

          {/* Global Rank — neon prominent */}
          <View style={styles.globalRankRow}>
            <Text style={styles.globalRankLabel}>GLOBAL RANK</Text>
            <Text style={styles.globalRankNum}>
              {globalRank !== undefined ? `#${globalRank}` : '—'}
            </Text>
          </View>

          {/* Floating badges — above level/XP, tappable to edit (max 5) */}
          {earnedBadges.length > 0 && (
            <View style={styles.badgesFloatingWrap}>
              <TouchableOpacity
                style={styles.badgesLabelRow}
                onPress={editable ? onEditBadges : undefined}
                disabled={!editable}
                activeOpacity={editable ? 0.7 : 1}
              >
                <Text style={styles.badgesLabel}>Badges</Text>
                {editable && (
                  <View style={styles.badgesPencilWrap}>
                    <Feather name="edit-2" size={12} color={colors.lightSubtext} />
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.badgesPillsRow}>
                {displayedBadges.map((b) => (
                  <View key={b.id} style={styles.badgePill}>
                    <Text style={styles.badgePillIcon}>{b.icon}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Full-width stats row: Catches · Species · Wins · Friends */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statPill}
          onPress={() => onStatPress?.('catches')}
          disabled={!onStatPress}
        >
          <Text style={styles.statValue}>{catches}</Text>
          <Text style={styles.statLabel}>Catches</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statPill}
          onPress={() => onStatPress?.('species')}
          disabled={!onStatPress}
        >
          <Text style={styles.statValue}>{species}</Text>
          <Text style={styles.statLabel}>Species</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statPill}
          onPress={() => onStatPress?.('wins')}
          disabled={!onStatPress}
        >
          <Text style={styles.statValue}>{wins}</Text>
          <Text style={styles.statLabel}>Wins</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statPill}
          onPress={onFriendsPress}
          disabled={!onFriendsPress}
        >
          <Text style={styles.statValue}>{friends ?? 0}</Text>
          <Text style={styles.statLabel}>Friends</Text>
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: SCREEN_PADDING,
  },
  avatarWrap: {
    position: 'relative' as const,
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
    borderColor: RING_UNVIEWED_BLUE,
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
  grayCameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
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
  addStoryLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: ACCENT_BLUE,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  username: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  proCheck: {
    marginLeft: 2,
  },
  profileInfo: {
    marginLeft: 14,
    marginBottom: 4,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  levelPill: {
    backgroundColor: GOLD,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  levelPillTxt: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1a1000',
    letterSpacing: 0.8,
  },
  xpText: {
    fontSize: 13,
    fontWeight: '800',
    color: GOLD,
  },
  xpTextOf: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.lightSubtext,
  },
  xpTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.lightBorder,
    marginBottom: 6,
    overflow: 'hidden',
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  location: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.lightSubtext,
  },
  badgesFloatingWrap: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,229,200,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.15)',
    alignSelf: 'flex-start',
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
    gap: 6,
    flexWrap: 'wrap',
  },
  badgePill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePillIcon: {
    fontSize: 18,
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
});
