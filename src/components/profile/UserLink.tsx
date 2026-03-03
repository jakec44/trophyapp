import React, { type ReactNode } from 'react';
import { View, Text, Image, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { isValidImageUri } from '@/src/lib/imageUri';

export interface UserLinkProps {
  userId: string;
  username?: string;
  avatarUrl?: string;
  proVerified?: boolean;
  children?: ReactNode;
  onPressOverride?: () => void;
  /** Layout: 'row' (avatar + text), 'avatar-only', 'text-only' */
  variant?: 'row' | 'avatar-only' | 'text-only';
  avatarSize?: number;
  textStyle?: StyleProp<any>;
  style?: StyleProp<ViewStyle>;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '??';
}

export function UserLink({
  userId,
  username,
  avatarUrl,
  proVerified = false,
  children,
  onPressOverride,
  variant = 'row',
  avatarSize = 40,
  textStyle,
  style,
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[styles.username, textStyle]} numberOfLines={1}>
            {username}
          </Text>
          {proVerified && <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />}
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
