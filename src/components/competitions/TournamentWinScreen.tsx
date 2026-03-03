/**
 * TournamentWinScreen
 * Flashy full-screen modal shown when a user places 1st/2nd/3rd in a tournament.
 * Opens automatically for unseen results; also reachable by tapping a profile badge.
 */

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  Share,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { TournamentResult } from '@/src/types/tournamentResults';
import { PLACE_PALETTE } from '@/src/types/tournamentResults';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_W = SW - 32;
const FISH_H = CARD_W * (4 / 3); // portrait fish photo

interface Props {
  result: TournamentResult;
  username: string;
  avatarUrl?: string | null;
  visible: boolean;
  onClose: () => void;
  onViewLeaderboard?: () => void;
}

// ── Floating particle
function Particle({ delay, palette }: { delay: number; palette: typeof PLACE_PALETTE[1] }) {
  const y = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  const left = useRef(Math.random() * SW).current;
  const size = useRef(4 + Math.random() * 6).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y, { toValue: -SH * 0.6, duration: 3000 + Math.random() * 2000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(op, { toValue: 0.85, duration: 600, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0, duration: 2400 + Math.random() * 1000, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: -20,
        left,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.primary,
        opacity: op,
        transform: [{ translateY: y }],
      }}
    />
  );
}

export function TournamentWinScreen({ result, username, avatarUrl, visible, onClose, onViewLeaderboard }: Props) {
  const router = useRouter();
  const palette = PLACE_PALETTE[result.place];

  // Entrance animation
  const scale = useRef(new Animated.Value(0.78)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.78);
    opacity.setValue(0);
    glow.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 160 }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [visible]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.65] });

  const handleShare = async () => {
    const metric =
      result.unit === 'lbs' && result.weight_lbs
        ? `${result.weight_lbs} lbs`
        : result.length_in
          ? `${result.length_in} in`
          : '';
    const msg = `🏆 I just placed ${palette.label} in the ${result.tournament_name} tournament on Snagged!${metric ? ` (${metric})` : ''} 🎣`;
    try { await Share.share({ message: msg }); } catch {}
  };

  const hasFishPhoto = !!result.fish_photo_url;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* Dim background */}
      <View style={styles.overlay}>
        {/* Particles */}
        {Array.from({ length: 16 }, (_, i) => (
          <Particle key={i} delay={i * 140} palette={palette} />
        ))}

        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          {/* Pulsing glow ring */}
          <Animated.View
            pointerEvents="none"
            style={[styles.glowRing, { borderColor: palette.primary, opacity: glowOpacity }]}
          />

          {/* Fish image hero */}
          <View style={[styles.fishWrap, { borderColor: palette.border }]}>
            {hasFishPhoto ? (
              <Image source={{ uri: result.fish_photo_url! }} style={styles.fishImg} resizeMode="cover" />
            ) : (
              <View style={[styles.fishImg, styles.fishPlaceholder]}>
                <Text style={styles.fishPlaceholderEmoji}>🐟</Text>
              </View>
            )}
            {/* Gradient scrim */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.82)']}
              locations={[0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* Place badge top-left */}
            <View style={[styles.placeBadge, { backgroundColor: palette.badge, borderColor: palette.border }]}>
              <Text style={styles.placeMedal}>{palette.medal}</Text>
              <Text style={[styles.placeLabel, { color: palette.primary }]}>{palette.label.toUpperCase()}</Text>
            </View>
            {/* Reward chips top-right */}
            <View style={styles.chipStack}>
              <View style={styles.xpChip}>
                <Text style={styles.xpChipTxt}>+{result.xp_awarded} XP</Text>
              </View>
              {result.coins_awarded != null && result.coins_awarded > 0 && (
                <View style={styles.coinsChip}>
                  <Text style={styles.coinsChipTxt}>💰 +{result.coins_awarded}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.headline}>You Placed!</Text>
            <Text style={[styles.tournamentName, { color: palette.primary }]} numberOfLines={2}>
              {result.tournament_name}
            </Text>

            {/* User row */}
            <View style={styles.userRow}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={18} color="#fff" />
                </View>
              )}
              <Text style={styles.usernameText} numberOfLines={1}>{username}</Text>
            </View>

            {/* Stats */}
            {(result.fish_species || result.weight_lbs || result.length_in) && (
              <View style={styles.statsRow}>
                {result.fish_species && (
                  <View style={styles.statChip}>
                    <Text style={styles.statChipTxt}>{result.fish_species}</Text>
                  </View>
                )}
                {result.unit === 'lbs' && result.weight_lbs != null && (
                  <View style={styles.statChip}>
                    <Text style={styles.statChipTxt}>{result.weight_lbs} lbs</Text>
                  </View>
                )}
                {result.unit === 'in' && result.length_in != null && (
                  <View style={styles.statChip}>
                    <Text style={styles.statChipTxt}>{result.length_in} in</Text>
                  </View>
                )}
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: palette.primary }]} onPress={handleShare} activeOpacity={0.85}>
                <Ionicons name="share-social-outline" size={18} color={palette.text} />
                <Text style={[styles.btnPrimaryTxt, { color: palette.text }]}>Share</Text>
              </TouchableOpacity>

              {onViewLeaderboard && (
                <TouchableOpacity style={styles.btnSecondary} onPress={onViewLeaderboard} activeOpacity={0.8}>
                  <Ionicons name="trophy-outline" size={16} color="#fff" />
                  <Text style={styles.btnSecondaryTxt}>Leaderboard</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
              <Text style={styles.closeTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: CARD_W,
    borderRadius: 22,
    backgroundColor: '#080e1a',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.6, shadowRadius: 24 },
      android: { elevation: 20 },
    }),
  },
  glowRing: {
    position: 'absolute',
    inset: -3,
    borderRadius: 25,
    borderWidth: 2,
    zIndex: 99,
    pointerEvents: 'none',
  },
  fishWrap: {
    width: '100%',
    height: CARD_W * 0.72,
    borderBottomWidth: 1.5,
    position: 'relative',
  },
  fishImg: {
    width: '100%',
    height: '100%',
  },
  fishPlaceholder: {
    backgroundColor: '#0d1f3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fishPlaceholderEmoji: { fontSize: 64 },
  placeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  placeMedal: { fontSize: 16 },
  placeLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  chipStack: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'flex-end',
    gap: 6,
  },
  xpChip: {
    backgroundColor: 'rgba(0,229,200,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.45)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  xpChipTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00e5c8',
  },
  coinsChip: {
    backgroundColor: 'rgba(255,184,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coinsChipTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFB800',
  },
  content: {
    padding: 18,
    gap: 10,
  },
  headline: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  tournamentName: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1a2a3a',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statChipTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPrimaryTxt: {
    fontSize: 14,
    fontWeight: '800',
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnSecondaryTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  closeTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
});
