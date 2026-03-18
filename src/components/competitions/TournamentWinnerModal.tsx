/**
 * Tournament Winner Celebration — full-screen dopamine hit.
 * Navy #06111A, rotating conic-style border (gold/silver/bronze + teal), Bebas Neue + Barlow Condensed.
 * Trophy with glow + sparks, reward pills, cinematic catch photo, Share / View Profile / Tournaments.
 * Confetti ~6s, spring entrance, respects reduceMotion.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
  Animated,
  Easing,
  AccessibilityInfo,
  Share,
  Alert,
  InteractionManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import type { TrophyBadgeRow } from '@/src/lib/supabase';
import { PLACE_PALETTE } from '@/src/types/tournamentResults';
import { isValidImageUri } from '@/src/lib/imageUri';

/** Cup trophy SVG — gold/silver/bronze by place. viewBox 0 0 56 72. */
function TrophyIcon({ color, size = 44 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * (72 / 56)} viewBox="0 0 56 72" fill="none">
      {/* Cup bowl */}
      <Path
        d="M 14 14 L 14 40 C 14 46 20 50 28 50 C 36 50 42 46 42 40 L 42 14 C 42 8 36 4 28 4 C 20 4 14 8 14 14 Z"
        fill={color}
      />
      {/* Left handle */}
      <Path d="M 14 20 Q 4 20 4 30 Q 4 40 14 40" stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" />
      {/* Right handle */}
      <Path d="M 42 20 Q 52 20 52 30 Q 52 40 42 40" stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" />
      {/* Stem */}
      <Path d="M 24 50 L 24 60 L 32 60 L 32 50 Z" fill={color} />
      {/* Base */}
      <Path d="M 16 60 L 16 68 L 40 68 L 40 60 Z" fill={color} />
    </Svg>
  );
}

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_W = Math.min(SW - 32, 420);
const TEAL = '#00e5c8';
const NAVY = '#06111A';

const CONFETTI_COUNT = 140;
const SPARK_COUNT = 12;
const CONFETTI_DURATION_MS = 6000;

export type Position = { x: number; y: number; width: number; height: number };

interface TournamentWinnerModalProps {
  visible: boolean;
  badge: TrophyBadgeRow | null;
  onClose: () => void;
  onViewProfile?: () => void;
  onViewTournaments?: () => void;
  xpProgressFrom?: number;
  xpProgressTo?: number;
  reduceMotion?: boolean;
}

const PLACE_HEADLINE: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '1ST PLACE',
  2: '2ND PLACE',
  3: '3RD PLACE',
  4: '4TH PLACE',
  5: '5TH PLACE',
};

/** Border gradient colors per place (primary + teal for rotating border) */
const BORDER_GRADIENT: Record<1 | 2 | 3 | 4 | 5, [string, string, string, string]> = {
  1: ['#FFB800', TEAL, '#FFD700', TEAL],
  2: ['#C0C8D4', TEAL, '#A8B2C0', TEAL],
  3: ['#E07D3A', TEAL, '#CD7F32', TEAL],
  4: ['#7B68EE', TEAL, '#5B4DB8', TEAL],
  5: ['#8B7355', TEAL, '#6B5344', TEAL],
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function TournamentWinnerModal({
  visible,
  badge,
  onClose,
  onViewProfile,
  onViewTournaments,
  reduceMotion: reduceMotionProp,
}: TournamentWinnerModalProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.88)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const borderRotation = useRef(new Animated.Value(0)).current;
  const trophyScale = useRef(new Animated.Value(0)).current;
  const trophyGlow = useRef(new Animated.Value(0)).current;
  const headlineOpacity = useRef(new Animated.Value(0)).current;
  const headlineTranslateY = useRef(new Animated.Value(20)).current;
  const raysRotation = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef<Animated.Value[]>([]).current;
  const sparkAnims = useRef<Animated.Value[]>([]).current;
  const pillsOpacity = useRef(new Animated.Value(0)).current;
  const photoOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const hasPlayedOpenRef = useRef(false);
  const shareInProgress = useRef(false);
  const animCancelledRef = useRef(false);

  if (confettiAnims.length === 0) {
    for (let i = 0; i < CONFETTI_COUNT; i++) confettiAnims.push(new Animated.Value(0));
  }
  if (sparkAnims.length === 0) {
    for (let i = 0; i < SPARK_COUNT; i++) sparkAnims.push(new Animated.Value(0));
  }

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    const update = (val: boolean) => setReduceMotion(reduceMotionProp ?? val);
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => setReduceMotion(false));
    try {
      sub = AccessibilityInfo.addEventListener('reduceMotionChanged', update) as { remove: () => void };
    } catch (_) {}
    return () => { sub?.remove(); };
  }, [reduceMotionProp]);

  const noAnim = reduceMotion || reduceMotionProp === true;

  useEffect(() => {
    if (!visible || !badge) return;
    if (!hasPlayedOpenRef.current) {
      hasPlayedOpenRef.current = true;
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
    }
  }, [visible, badge?.id]);

  useEffect(() => {
    if (!visible || !badge || noAnim) return;

    animCancelledRef.current = false;
    overlayOpacity.setValue(0);
    cardScale.setValue(0.88);
    cardOpacity.setValue(0);
    borderRotation.setValue(0);
    trophyScale.setValue(0);
    trophyGlow.setValue(0);
    headlineOpacity.setValue(0);
    headlineTranslateY.setValue(20);
    raysRotation.setValue(0);
    pillsOpacity.setValue(0);
    photoOpacity.setValue(0);
    buttonsOpacity.setValue(0);
    confettiAnims.forEach((a) => a.setValue(0));
    sparkAnims.forEach((a) => a.setValue(0));

    // Overlay + spring card entrance
    Animated.timing(overlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 9, tension: 80 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();

    // Rotating border (infinite) — stop on cleanup
    const borderLoop = Animated.loop(
      Animated.timing(borderRotation, { toValue: 1, duration: 4000, useNativeDriver: true, easing: Easing.linear })
    );
    borderLoop.start();

    // Trophy pop + glow pulse — only recurse if not cancelled
    Animated.sequence([
      Animated.delay(180),
      Animated.parallel([
        Animated.spring(trophyScale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 100 }),
        Animated.timing(trophyGlow, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
    const glowLoop = () => {
      if (animCancelledRef.current) return;
      trophyGlow.setValue(0);
      Animated.sequence([
        Animated.timing(trophyGlow, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(trophyGlow, { toValue: 0.5, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]).start(({ finished }) => {
        if (finished && !animCancelledRef.current) glowLoop();
      });
    };
    const glowT = setTimeout(glowLoop, 600);

    // Spinning rays — stop on cleanup
    const raysLoop = Animated.loop(
      Animated.timing(raysRotation, { toValue: 1, duration: 8000, useNativeDriver: true, easing: Easing.linear })
    );
    raysLoop.start();

    // Headline
    Animated.parallel([
      Animated.timing(headlineOpacity, { toValue: 1, duration: 300, delay: 320, useNativeDriver: true }),
      Animated.timing(headlineTranslateY, { toValue: 0, duration: 300, delay: 320, useNativeDriver: true }),
    ]).start();

    // Confetti: rain down, then fade after ~6s
    const seed = Date.now() % 1e6;
    const rnd = mulberry32(seed);
    confettiAnims.forEach((anim, i) => {
      const delay = 400 + rnd() * 200;
      const fallDuration = 2200 + rnd() * 1800;
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: fallDuration, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.delay(Math.max(0, CONFETTI_DURATION_MS - delay - fallDuration)),
        Animated.timing(anim, { toValue: 1.5, duration: 800, useNativeDriver: true }),
      ]).start();
    });

    // Sparks burst from trophy (start after trophy pop)
    const sparkRnd = mulberry32(seed + 1);
    sparkAnims.forEach((anim, i) => {
      const angle = (i / SPARK_COUNT) * Math.PI * 2 + sparkRnd() * 0.5;
      const dist = 40 + sparkRnd() * 50;
      const delay = 380 + sparkRnd() * 120;
      const duration = 600 + sparkRnd() * 300;
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          // opacity fade handled in interpolate
        ]),
      ]).start();
    });

    // Pills + photo + buttons stagger
    Animated.timing(pillsOpacity, { toValue: 1, duration: 250, delay: 550, useNativeDriver: true }).start();
    Animated.timing(photoOpacity, { toValue: 1, duration: 280, delay: 650, useNativeDriver: true }).start();
    Animated.timing(buttonsOpacity, { toValue: 1, duration: 250, delay: 950, useNativeDriver: true }).start();

    return () => {
      animCancelledRef.current = true;
      clearTimeout(glowT);
      borderLoop.stop();
      raysLoop.stop();
      borderRotation.stopAnimation();
      raysRotation.stopAnimation();
      trophyGlow.stopAnimation();
    };
  }, [visible, badge?.id, noAnim]);

  useEffect(() => {
    if (!visible) hasPlayedOpenRef.current = false;
  }, [visible]);

  if (!visible || !badge) return null;

  const place = badge.place as 1 | 2 | 3 | 4 | 5;
  const palette = PLACE_PALETTE[place];
  const borderColors = BORDER_GRADIENT[place];
  const hasFishPhoto = !!badge.fish_photo_url && isValidImageUri(badge.fish_photo_url);

  const handleViewProfile = () => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
    onViewProfile ? onViewProfile() : onClose();
  };

  const handleShare = () => {
    if (shareInProgress.current) return;
    shareInProgress.current = true;
    const message = `🏆 I just placed ${PLACE_HEADLINE[place]} in ${badge.tournament_name ?? 'the tournament'} on Snagged! 🎣`;
    InteractionManager.runAfterInteractions(() => {
      Share.share({ message, title: 'Tournament Win' })
        .catch((e) => {
          if ((e as { message?: string })?.message !== 'User did not share') Alert.alert('Share', 'Could not share.');
        })
        .finally(() => { shareInProgress.current = false; });
    });
  };

  const handleViewTournaments = () => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
    onViewTournaments ? onViewTournaments() : onClose();
  };

  const borderRotate = borderRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const cardScaleStyle = noAnim ? {} : { transform: [{ scale: cardScale }], opacity: cardOpacity };
  const headlineStyle = noAnim ? {} : { opacity: headlineOpacity, transform: [{ translateY: headlineTranslateY }] };
  const raysRotate = raysRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: noAnim ? 1 : overlayOpacity }]}>
        {/* Confetti layer */}
        {!noAnim && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {confettiAnims.slice(0, CONFETTI_COUNT).map((anim, i) => {
              const rnd = mulberry32((i + 100) * 7919);
              const fromX = rnd() * SW;
              const fromY = -30 - rnd() * 40;
              const toY = 80 + rnd() * (SH * 0.6);
              const toX = fromX + (rnd() - 0.5) * 100;
              const colors = [palette.primary, TEAL, '#ff8c00', '#FFD700', '#E07D3A', '#C0C8D4', '#fff'];
              const color = colors[i % colors.length];
              return (
                <Animated.View
                  key={`c-${i}`}
                  style={[
                    styles.confettiDot,
                    {
                      backgroundColor: color,
                      left: fromX,
                      top: fromY,
                      transform: [
                        { translateX: anim.interpolate({ inputRange: [0, 1, 1.5], outputRange: [0, toX - fromX, toX - fromX] }) },
                        { translateY: anim.interpolate({ inputRange: [0, 1, 1.5], outputRange: [0, toY - fromY, toY - fromY] }) },
                      ],
                      opacity: anim.interpolate({ inputRange: [0, 0.7, 1, 1.5], outputRange: [0.95, 0.6, 0.25, 0] }),
                    },
                  ]}
                />
              );
            })}
          </View>
        )}

        {/* Card with rotating (or static) gradient border */}
        <Animated.View style={[styles.cardOuter, cardScaleStyle]}>
          {noAnim ? (
            <View style={styles.borderWrapper}>
              <LinearGradient
                colors={borderColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.borderGradient}
              />
            </View>
          ) : (
            <Animated.View style={[styles.borderWrapper, { transform: [{ rotate: borderRotate }] }]}>
              <LinearGradient
                colors={borderColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.borderGradient}
              />
            </Animated.View>
          )}
          <View style={styles.cardInner}>
            {/* Headline: 1ST / 2ND / 3RD PLACE */}
            <Animated.View style={[styles.headlineWrap, headlineStyle]}>
              <Text style={[styles.headline, { color: palette.primary }]} allowFontScaling={false}>
                {PLACE_HEADLINE[place]}
              </Text>
            </Animated.View>

            {/* Trophy + rays + glow + sparks */}
            <View style={styles.trophySection}>
              {!noAnim && (
                <Animated.View style={[styles.raysWrap, { transform: [{ rotate: raysRotate }] }]} pointerEvents="none">
                  {[...Array(12)].map((_, i) => (
                    <View key={i} style={[styles.ray, { transform: [{ rotate: `${i * 30}deg` }], backgroundColor: palette.primary }]} />
                  ))}
                </Animated.View>
              )}
              <Animated.View
                style={[
                  styles.trophyGlow,
                  {
                    backgroundColor: palette.primary,
                    opacity: noAnim ? 0.35 : trophyGlow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] }),
                    transform: [{ scale: noAnim ? 1 : trophyScale }],
                  },
                ]}
              />
              <Animated.View style={[styles.trophyCircle, { borderColor: palette.border }, noAnim ? {} : { transform: [{ scale: trophyScale }] }]}>
                <TrophyIcon color={palette.primary} size={42} />
              </Animated.View>
              {!noAnim && (
                <View style={styles.sparkCenter} pointerEvents="none">
                  {sparkAnims.slice(0, SPARK_COUNT).map((anim, i) => {
                    const rnd = mulberry32((i + 200) * 7919);
                    const angle = (i / SPARK_COUNT) * Math.PI * 2 + rnd() * 0.3;
                    const dist = 50 + rnd() * 40;
                    const tx = Math.cos(angle) * dist;
                    const ty = Math.sin(angle) * dist;
                    return (
                      <Animated.View
                        key={`s-${i}`}
                        style={[
                          styles.spark,
                          {
                            backgroundColor: palette.primary,
                            transform: [
                              { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, tx] }) },
                              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, ty] }) },
                            ],
                            opacity: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.4, 0] }),
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              )}
            </View>

            {/* Rewards: Trophies + XP (same teal), badge earned */}
            <Animated.View style={[styles.rewardsWrap, noAnim ? {} : { opacity: pillsOpacity }]}>
              <View style={styles.pillsRow}>
                <View style={[styles.pill, styles.xpPill]}>
                  <Ionicons name="trophy" size={16} color={TEAL} />
                  <Text style={styles.pillLabel}>Trophies</Text>
                  <Text style={[styles.pillValue, { color: TEAL }]}>+{badge.xp_awarded}</Text>
                </View>
                <View style={[styles.pill, styles.xpPill]}>
                  <Ionicons name="star" size={16} color={TEAL} />
                  <Text style={styles.pillLabel}>XP</Text>
                  <Text style={[styles.pillValue, { color: TEAL }]}>+{badge.xp_awarded}</Text>
                </View>
              </View>
              <Text style={styles.badgeEarnedText}>
                Badge earned · {PLACE_HEADLINE[place]} · {badge.tournament_name ?? 'Tournament'}
              </Text>
            </Animated.View>

            {/* Catch photo — more vertical to show more of image */}
            <Animated.View style={[styles.photoWrap, noAnim ? {} : { opacity: photoOpacity }]}>
              {hasFishPhoto ? (
                <Image source={{ uri: badge.fish_photo_url! }} style={styles.photoImg} resizeMode="cover" />
              ) : (
                <View style={[styles.photoImg, styles.photoPlaceholder]}>
                  <Text style={styles.photoPlaceholderEmoji}>🐟</Text>
                </View>
              )}
              <LinearGradient
                colors={['transparent', 'rgba(6,17,26,0.4)', 'rgba(6,17,26,0.92)']}
                style={styles.photoOverlay}
              />
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeText} numberOfLines={1}>{badge.tournament_name ?? 'Tournament'}</Text>
              </View>
              <View style={styles.photoSpeciesWrap}>
                <Text style={styles.photoSpeciesText} numberOfLines={1}>Winning catch</Text>
              </View>
            </Animated.View>

            {/* Buttons */}
            <Animated.View style={[styles.buttonsWrap, noAnim ? {} : { opacity: buttonsOpacity }]}>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: palette.primary }]} onPress={handleShare} activeOpacity={0.85}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.35)', 'transparent', 'rgba(255,255,255,0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="share-social" size={22} color={palette.text} />
                <Text style={[styles.btnPrimaryText, { color: palette.text }]}>Share Your Win</Text>
              </TouchableOpacity>
              <View style={styles.secondaryRow}>
                <TouchableOpacity style={styles.btnSecondary} onPress={handleViewProfile} activeOpacity={0.85}>
                  <Ionicons name="person" size={20} color="#fff" />
                  <Text style={styles.btnSecondaryText}>View Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSecondary} onPress={handleViewTournaments} activeOpacity={0.85}>
                  <Ionicons name="trophy-outline" size={20} color="#fff" />
                  <Text style={styles.btnSecondaryText}>Tournaments</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.closeLink} onPress={onClose} hitSlop={12}>
                <Text style={styles.closeLinkText}>Close</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardOuter: {
    width: CARD_W,
    alignSelf: 'center',
    position: 'relative',
  },
  borderWrapper: {
    position: 'absolute',
    width: CARD_W + 8,
    left: -4,
    top: -4,
    height: '100%',
    minHeight: SH * 0.75,
    borderRadius: 24,
    overflow: 'hidden',
  },
  borderGradient: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  cardInner: {
    width: CARD_W,
    backgroundColor: NAVY,
    borderRadius: 20,
    overflow: 'hidden',
    margin: 4,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headlineWrap: {
    marginBottom: 16,
  },
  headline: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 36,
    letterSpacing: 2,
  },
  trophySection: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  raysWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ray: {
    position: 'absolute',
    width: 2,
    height: 28,
    borderRadius: 1,
    opacity: 0.4,
    top: 8,
  },
  trophyGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  trophyCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkCenter: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    marginLeft: 0,
    marginTop: 0,
  },
  spark: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    left: -3,
    top: -3,
  },
  rewardsWrap: {
    marginBottom: 16,
    alignItems: 'center',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  xpPill: {
    backgroundColor: 'rgba(0,229,200,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.35)',
  },
  pillLabel: { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  pillValue: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 18 },
  badgeEarnedText: {
    fontFamily: 'BarlowCondensed_600SemiBold',
    fontSize: 13,
    color: TEAL,
    opacity: 0.95,
    textAlign: 'center',
  },
  photoWrap: {
    width: '100%',
    height: CARD_W * 0.88,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    backgroundColor: '#0d1f2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderEmoji: { fontSize: 48 },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  photoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: TEAL,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  photoBadgeText: {
    fontFamily: 'BarlowCondensed_600SemiBold',
    fontSize: 12,
    color: '#06111A',
  },
  photoSpeciesWrap: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  photoSpeciesText: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 16,
    color: '#fff',
  },
  buttonsWrap: {
    width: '100%',
    alignItems: 'center',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    marginBottom: 12,
    overflow: 'hidden',
  },
  btnPrimaryText: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 18,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 8,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  btnSecondaryText: {
    fontFamily: 'BarlowCondensed_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  closeLink: {
    paddingVertical: 10,
  },
  closeLinkText: {
    fontFamily: 'BarlowCondensed_600SemiBold',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  confettiDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
