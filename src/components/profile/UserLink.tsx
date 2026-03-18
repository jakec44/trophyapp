import React, { type ReactNode } from 'react';
import { View, Text, Image, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';
import type { ProfileDisplayItem } from '@/src/lib/supabase';
import { getInferredPlaceFromBadge } from '@/src/lib/supabase';
import { getLevelBadgeIcon } from '@/src/types/gamification';
import { SpeciesBadgeImage } from '@/src/components/profile/SpeciesBadgeImage';
import { hasCustomSpeciesBadgeImage } from '@/src/constants/speciesBadgeImages';
import { AnimatedTrophyBadge } from '@/src/components/profile/AnimatedTrophyBadge';
import { RarityBadge } from '@/src/components/profile/RarityBadge';

/** Badge size next to username: compact for feed/leaderboard, default for profile, large for home feed */
export type BadgeSizeVariant = 'compact' | 'default' | 'large';

export interface UserLinkProps {
  userId: string;
  username?: string;
  avatarUrl?: string;
  proVerified?: boolean;
  /** Pinned badges to show next to username (max 3) */
  displayItems?: ProfileDisplayItem[];
  children?: ReactNode;
  onPressOverride?: () => void;
  /** Layout: 'row' (avatar + text), 'avatar-only', 'text-only' */
  variant?: 'row' | 'avatar-only' | 'text-only';
  avatarSize?: number;
  textStyle?: StyleProp<any>;
  style?: StyleProp<ViewStyle>;
  /** Badge size: compact ~22px (feed/leaderboard), default ~26px (profile), large ~34px (home feed) */
  badgeSize?: BadgeSizeVariant;
  /** When false, badges are display-only (feed/leaderboard). When true, badges are clickable (profile, badge collection) */
  badgesClickable?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '??';
}

const BADGE_SIZE_COMPACT = 22;
const BADGE_SIZE_DEFAULT = 26;
const BADGE_SIZE_LARGE = 34;
const BADGE_GAP = 2;

function getBadgeSize(badgeSize: BadgeSizeVariant): number {
  if (badgeSize === 'large') return BADGE_SIZE_LARGE;
  if (badgeSize === 'default') return BADGE_SIZE_DEFAULT;
  return BADGE_SIZE_COMPACT;
}

export function UserLink({
  userId,
  username,
  avatarUrl,
  proVerified = false,
  displayItems = [],
  children,
  onPressOverride,
  variant = 'row',
  avatarSize = 40,
  textStyle,
  style,
  badgeSize = 'compact',
  badgesClickable = false,
}: UserLinkProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPressOverride) {
      onPressOverride();
      return;
    }
    if (userId === 'current-user') {
      router.push('/(tabs)/profile');
      return;
    }
    router.push(`/user/${userId}`);
  };

  const content = children ?? (
    <>
      {(variant === 'row' || variant === 'avatar-only') && (
        isValidImageUri(avatarUrl) ? (
          <Image
            source={{ uri: avatarUrl }}
            style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
          />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
            ]}
          >
            <Text
              style={[
                styles.avatarFallbackText,
                { fontSize: Math.max(10, avatarSize * 0.35) },
              ]}
            >
              {username ? getInitials(username) : '??'}
            </Text>
          </View>
        )
      )}
      {(variant === 'row' || variant === 'text-only') && username != null && (
        <View style={styles.usernameRow}>
          <View style={styles.usernameTextWrap}>
            <Text style={[styles.username, textStyle]} numberOfLines={1} ellipsizeMode="tail">
              {username}
            </Text>
          </View>
          <View style={styles.badgeGroup}>
            {displayItems.slice(0, 3).map((item) => {
              const sz = getBadgeSize(badgeSize);
              const levelSz = item.badgeKey?.startsWith('level-') ? Math.round(sz * 0.85) : item.badgeKey?.startsWith('achievement-') ? Math.round(sz * 0.88) : sz;
              let badgeEl: React.ReactNode;
              if (item.type === 'trophy') {
                badgeEl = <AnimatedTrophyBadge place={item.place} size={sz} animated={!badgesClickable} />;
              } else {
                const place = getInferredPlaceFromBadge(item.badgeKey, item.label);
                const icon = item.badgeKey.startsWith('level-') ? getLevelBadgeIcon(item.badgeKey) : item.icon;
                if (place != null) {
                  badgeEl = <AnimatedTrophyBadge place={place} size={sz} animated={!badgesClickable} />;
                } else if (item.type === 'badge' && hasCustomSpeciesBadgeImage(item.badgeKey)) {
                  badgeEl = <SpeciesBadgeImage badgeKey={item.badgeKey} size={sz} scale={1.2} />;
                } else if (item.type === 'badge' && item.rarity) {
                  badgeEl = <RarityBadge rarity={item.rarity} icon={icon} size={levelSz} animated={!badgesClickable} compact />;
                } else {
                  badgeEl = <Text style={[styles.badgeIcon, { fontSize: sz }]}>{icon}</Text>;
                }
              }
              return (
                <View key={item.id} style={styles.badgePill}>
                  {badgeEl}
                </View>
              );
            })}
          </View>
          {proVerified && <Ionicons name="checkmark-circle" size={18} color="#3B82F6" style={styles.proCheck} />}
        </View>
      )}
    </>
  );

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.wrap,
        variant === 'row' && styles.wrapRow,
        pressed && styles.pressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
  wrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 6,
    minWidth: 0,
    flex: 1,
  },
  usernameTextWrap: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BADGE_GAP,
    marginLeft: 2,
    flexShrink: 0,
  },
  badgePill: {},
  proCheck: { marginLeft: 2 },
  badgeIcon: {},
  avatar: {
    backgroundColor: colors.lightBorder,
  },
  avatarFallback: {
    backgroundColor: colors.accentBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.lightText,
  },
});
