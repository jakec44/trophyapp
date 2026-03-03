/**
 * LogSuccessOverlay — NEW SPECIES VICTORY SCREEN.
 * Only shown when a brand-new species is logged.
 * Hero fish, XP burst particles, level progress, micro-progression hints.
 */

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Animated, Easing, Dimensions, Image, ImageSourcePropType,
  Platform, Share, Alert, ActionSheetIOS,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
import { findPassportSpeciesId } from '@/src/lib/speciesMapper';
import { SPECIES_EXAMPLE_IMAGES } from '@/src/constants/speciesExampleImages';
import { PASSPORT_SPECIES_COLOR_IMAGES } from '@/src/constants/passportSpeciesColorImages';
import { getLevelFromXp, LEVEL_UNLOCKS, LEVEL_ROADMAP } from '@/src/types/gamification';

const { width: SW, height: SH } = Dimensions.get('window');
const TOP_H = SH * 0.40;
const FISH_SIZE = Math.min(SW * 0.52, 200);

// ─── Rarity helpers ─────────────────────────────────────────────────────────

function getRarityColor(r?: string): string {
  switch (r) {
    case 'uncommon':  return '#4ade80';
    case 'rare':      return '#60a5fa';
    case 'epic':      return '#c084fc';
    case 'legendary': return '#fbbf24';
    case 'mythic':    return '#ff6b2b';
    default:          return '#9ca3af';
  }
}

function getRarityGradient(r?: string): readonly [string, string, string] {
  switch (r) {
    case 'uncommon':  return ['#042b14', '#0f3d1f', '#042b14'] as const;
    case 'rare':      return ['#08152e', '#112560', '#08152e'] as const;
    case 'epic':      return ['#1a053a', '#3b1068', '#1a053a'] as const;
    case 'legendary': return ['#2d0e00', '#5c1c00', '#2d0e00'] as const;
    case 'mythic':    return ['#200500', '#6b1500', '#200500'] as const;
    default:          return ['#0a1520', '#111f30', '#0a1520'] as const;
  }
}

function getFishImage(
  species: string,
  imageUri?: string,
): { uri: string } | ImageSourcePropType | null {
  const pid = findPassportSpeciesId(species);
  if (pid) {
    const img = PASSPORT_SPECIES_COLOR_IMAGES[pid];
    if (img != null) return typeof img === 'number' ? (img as ImageSourcePropType) : { uri: img as string };
  }
  if (imageUri) return { uri: imageUri };
  if (pid) {
    const val = SPECIES_EXAMPLE_IMAGES[pid];
    if (typeof val === 'string') return { uri: val };
    if (typeof val === 'number') return val as ImageSourcePropType;
  }
  return null;
}

// ─── Sparkle floating particle ───────────────────────────────────────────────

function Sparkle({ x, delay, color }: { x: number; delay: number; color: string }) {
  const y = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(op, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(sc, { toValue: 1,  duration: 350, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(y,  { toValue: -90, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(op, { toValue: 0,   duration: 1500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(y,  { toValue: 0,   duration: 0, useNativeDriver: true }),
          Animated.timing(sc, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const chars = ['✦', '✧', '·', '★', '◆'];
  return (
    <Animated.View style={{ position: 'absolute', left: x, bottom: 4, transform: [{ translateY: y }, { scale: sc }], opacity: op }}>
      <Text style={{ fontSize: 13, color }}>{chars[Math.floor(x) % chars.length]}</Text>
    </Animated.View>
  );
}

// ─── XP burst particle ───────────────────────────────────────────────────────

function BurstDot({ angle, dist, color, triggered }: { angle: number; dist: number; color: string; triggered: boolean }) {
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!triggered) {
      x.setValue(0); y.setValue(0); op.setValue(0); sc.setValue(0.3);
      return;
    }
    Animated.sequence([
      Animated.parallel([
        Animated.spring(x, { toValue: Math.cos(angle) * dist, useNativeDriver: true, damping: 12, stiffness: 160 }),
        Animated.spring(y, { toValue: Math.sin(angle) * dist, useNativeDriver: true, damping: 12, stiffness: 160 }),
        Animated.timing(op, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(sc, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
      ]),
      Animated.timing(op, { toValue: 0, duration: 500, delay: 150, useNativeDriver: true }),
    ]).start();
  }, [triggered]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: color,
        transform: [{ translateX: x }, { translateY: y }, { scale: sc }],
        opacity: op,
      }}
    />
  );
}

// ─── Pulse ring ──────────────────────────────────────────────────────────────

function PulseRing({ color, triggered }: { color: string; triggered: boolean }) {
  const sc = useRef(new Animated.Value(1)).current;
  const op = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!triggered) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(sc, { toValue: 2.2, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(op, { toValue: 0,   duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(sc, { toValue: 1,   duration: 0, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [triggered]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: FISH_SIZE + 24, height: FISH_SIZE + 24,
        borderRadius: (FISH_SIZE + 24) / 2,
        borderWidth: 2, borderColor: color,
        transform: [{ scale: sc }], opacity: op,
      }}
    />
  );
}

// ─── Main overlay ────────────────────────────────────────────────────────────

export interface LogSuccessOverlayProps {
  visible: boolean;
  species: string;
  xpEarned: number;
  rarity?: string;
  imageUri?: string;
  weight?: number;
  length?: number;
  speciesCount?: number;
  totalSpecies?: number;
  xpBefore?: number;
  onViewPassport?: (speciesId?: string) => void;
  onShareToFeed?: () => void;
  onDismiss: () => void;
  // kept for backward compat but unused in new design
  shareBonusIncluded?: boolean;
  shareToFeedEnabled?: boolean;
  onShareToggle?: (v: boolean) => void;
  onViewLogbook?: () => void;
  isNewSpecies?: boolean;
}

export function LogSuccessOverlay({
  visible,
  species,
  xpEarned,
  rarity,
  imageUri,
  weight,
  length,
  speciesCount = 0,
  totalSpecies = 86,
  xpBefore = 0,
  onViewPassport,
  onShareToFeed,
  onDismiss,
  isNewSpecies = false,
}: LogSuccessOverlayProps) {

  const rarityColor   = getRarityColor(rarity);
  const rarityGrad    = getRarityGradient(rarity);
  const rarityLabel   = rarity ? rarity.toUpperCase() : 'COMMON';
  const fishSource    = getFishImage(species, imageUri);
  const passportId    = findPassportSpeciesId(species);
  const isHighRarity  = rarity === 'mythic' || rarity === 'legendary' || rarity === 'epic';

  // ── level micro-progression ──────────────────────────────────────────────
  const xpAfter        = xpBefore + xpEarned;
  const levelAfter     = getLevelFromXp(xpAfter);
  const xpToNext       = levelAfter.xpForNext > 0 ? levelAfter.xpForNext - levelAfter.xpInLevel : 0;
  const levelPct       = levelAfter.xpForNext > 0 ? levelAfter.xpInLevel / levelAfter.xpForNext : 1;
  const nextLevelNum   = levelAfter.level < 15 ? levelAfter.level + 1 : null;
  const nextUnlocks    = nextLevelNum ? (LEVEL_UNLOCKS[nextLevelNum] ?? []) : [];
  const nextUnlockLbl  = nextUnlocks[0]?.label ?? null;

  // ── animation refs ───────────────────────────────────────────────────────
  const bgOp        = useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(60)).current;
  const cardOp      = useRef(new Animated.Value(0)).current;
  const fishSc      = useRef(new Animated.Value(0.4)).current;
  const fishOp      = useRef(new Animated.Value(0)).current;
  const fishFloatY  = useRef(new Animated.Value(0)).current;
  const glowSc      = useRef(new Animated.Value(0.8)).current;
  const glowOp      = useRef(new Animated.Value(0)).current;
  const raysRot     = useRef(new Animated.Value(0)).current;
  const progressW   = useRef(new Animated.Value(0)).current;
  const levelW      = useRef(new Animated.Value(0)).current;
  const xpAnim      = useRef(new Animated.Value(0)).current;
  const pulseSc     = useRef(new Animated.Value(1)).current;

  const [displayXP,       setDisplayXP]       = useState(0);
  const [burstTriggered,  setBurstTriggered]   = useState(false);
  const [glowActive,      setGlowActive]       = useState(false);

  const BURST_COUNT = 10;
  const burstAngles = Array.from({ length: BURST_COUNT }, (_, i) => (i / BURST_COUNT) * Math.PI * 2);
  const burstDists  = Array.from({ length: BURST_COUNT }, (_, i) => 55 + (i % 3) * 18);

  const sparkleCount = rarity === 'mythic' ? 9 : rarity === 'legendary' ? 7 : rarity === 'epic' ? 5 : rarity === 'rare' ? 3 : 0;
  const sparkles = Array.from({ length: sparkleCount }, (_, i) => ({
    x: (i * (FISH_SIZE * 0.9)) / Math.max(sparkleCount - 1, 1),
    delay: i * 200,
  }));

  // Refs for loops and timeouts so we can stop/cancel them on cleanup
  const floatLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowLoopRef  = useRef<Animated.CompositeAnimation | null>(null);
  const raysLoopRef  = useRef<Animated.CompositeAnimation | null>(null);
  const t1Ref        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2Ref        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xpListenerRef = useRef<string | null>(null);

  useEffect(() => {
    // ── cleanup helper ──────────────────────────────────────────────────────
    const stopAll = () => {
      if (t1Ref.current) { clearTimeout(t1Ref.current); t1Ref.current = null; }
      if (t2Ref.current) { clearTimeout(t2Ref.current); t2Ref.current = null; }
      floatLoopRef.current?.stop(); floatLoopRef.current = null;
      glowLoopRef.current?.stop();  glowLoopRef.current  = null;
      raysLoopRef.current?.stop();  raysLoopRef.current  = null;
      if (xpListenerRef.current) {
        xpAnim.removeListener(xpListenerRef.current);
        xpListenerRef.current = null;
      }
      bgOp.stopAnimation();
      cardY.stopAnimation(); cardOp.stopAnimation();
      fishSc.stopAnimation(); fishOp.stopAnimation(); fishFloatY.stopAnimation();
      glowSc.stopAnimation(); glowOp.stopAnimation();
      raysRot.stopAnimation();
      progressW.stopAnimation(); levelW.stopAnimation();
      xpAnim.stopAnimation(); pulseSc.stopAnimation();
    };

    if (!visible) {
      stopAll();
      bgOp.setValue(0); cardY.setValue(60); cardOp.setValue(0);
      fishSc.setValue(0.4); fishOp.setValue(0); fishFloatY.setValue(0);
      glowSc.setValue(0.8); glowOp.setValue(0); raysRot.setValue(0);
      progressW.setValue(0); levelW.setValue(0);
      xpAnim.setValue(0); pulseSc.setValue(1);
      setDisplayXP(0); setBurstTriggered(false); setGlowActive(false);
      return stopAll;
    }

    // Background fade
    Animated.timing(bgOp, { toValue: 1, duration: 350, useNativeDriver: true }).start();

    // Card slide up
    Animated.parallel([
      Animated.spring(cardY,  { toValue: 0, damping: 20, stiffness: 180, useNativeDriver: true }),
      Animated.timing(cardOp, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Fish pop-in then set glow active
    Animated.sequence([
      Animated.delay(120),
      Animated.parallel([
        Animated.spring(fishSc, { toValue: 1.1, damping: 8, stiffness: 200, useNativeDriver: true }),
        Animated.timing(fishOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.spring(fishSc, { toValue: 1, damping: 12, stiffness: 200, useNativeDriver: true }),
    ]).start(() => setGlowActive(true));

    // Fish float loop (deferred — stored so we can cancel)
    t1Ref.current = setTimeout(() => {
      floatLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(fishFloatY, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(fishFloatY, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      floatLoopRef.current.start();
    }, 500);

    // Glow pulse loop (deferred — stored so we can cancel)
    t2Ref.current = setTimeout(() => {
      Animated.timing(glowOp, { toValue: 0.55, duration: 400, useNativeDriver: true }).start();
      glowLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowSc, { toValue: 1.3, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(glowOp, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(glowSc, { toValue: 0.9, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(glowOp, { toValue: 0.55, duration: 1000, useNativeDriver: true }),
          ]),
        ])
      );
      glowLoopRef.current.start();
    }, 300);

    // Rays spin (high rarity)
    if (isHighRarity) {
      raysLoopRef.current = Animated.loop(
        Animated.timing(raysRot, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true })
      );
      raysLoopRef.current.start();
    }

    // Progress bars
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(progressW, {
          toValue: totalSpecies > 0 ? speciesCount / totalSpecies : 0,
          duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false,
        }),
        Animated.timing(levelW, {
          toValue: levelPct,
          duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false,
        }),
      ]),
    ]).start();

    // XP count-up
    if (xpEarned > 0) {
      xpAnim.setValue(0);
      const id = xpAnim.addListener(({ value }) => setDisplayXP(Math.round(value)));
      xpListenerRef.current = id;
      Animated.timing(xpAnim, {
        toValue: xpEarned, duration: 1100, delay: 500,
        easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished) return;
        xpAnim.removeListener(id);
        xpListenerRef.current = null;
        setBurstTriggered(true);
        Animated.sequence([
          Animated.timing(pulseSc, { toValue: 1.008, duration: 80, useNativeDriver: true }),
          Animated.timing(pulseSc, { toValue: 1,     duration: 120, useNativeDriver: true }),
        ]).start();
      });
    }

    return stopAll;
  }, [visible]);

  const floatTranslate = fishFloatY.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const raysInterp     = raysRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.root, { opacity: bgOp }]}>
        <Animated.View style={[styles.screen, { transform: [{ scale: pulseSc }] }]}>

          {/* ── TOP GRADIENT ZONE ── */}
          <LinearGradient colors={rarityGrad} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.topZone}>

            {/* Rotating rays */}
            {isHighRarity && (
              <Animated.View style={[styles.raysWrap, { transform: [{ rotate: raysInterp }] }]} pointerEvents="none">
                {Array.from({ length: 16 }, (_, i) => (
                  <View key={i} style={[styles.ray, { transform: [{ rotate: `${i * 22.5}deg` }], backgroundColor: rarityColor + '14' }]} />
                ))}
              </Animated.View>
            )}

            {/* Top bar: rarity badge + close */}
            <View style={styles.topBar}>
              <View style={[styles.rarityBadge, { borderColor: rarityColor + '60', backgroundColor: rarityColor + '20' }]}>
                <Text style={[styles.rarityBadgeTxt, { color: rarityColor }]}>{rarityLabel}</Text>
              </View>
              <TouchableOpacity onPress={onDismiss} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            {/* NEW SPECIES banner — only for new species */}
            {isNewSpecies && (
              <View style={styles.newSpeciesBanner}>
                <View style={[styles.nsDot, { backgroundColor: rarityColor }]} />
                <Text style={styles.newSpeciesTxt}>✦ NEW SPECIES UNLOCKED ✦</Text>
                <View style={[styles.nsDot, { backgroundColor: rarityColor }]} />
              </View>
            )}

            {/* Sparkles behind fish */}
            {sparkles.length > 0 && (
              <View style={styles.sparkleWrap} pointerEvents="none">
                {sparkles.map((s, i) => (
                  <Sparkle key={i} x={s.x} delay={s.delay} color={rarityColor} />
                ))}
              </View>
            )}
          </LinearGradient>

          {/* ── HERO FISH (overlaps both zones) ── */}
          <View style={styles.fishHeroWrap} pointerEvents="none">
            {/* Glow behind fish */}
            <Animated.View
              style={[
                styles.fishGlow,
                { backgroundColor: rarityColor, transform: [{ scale: glowSc }], opacity: glowOp },
              ]}
            />
            {/* Pulse ring */}
            <PulseRing color={rarityColor} triggered={glowActive} />

            {fishSource ? (
              <Animated.View style={{ transform: [{ scale: fishSc }, { translateY: floatTranslate }], opacity: fishOp }}>
                <Image source={fishSource} style={styles.fishImg} resizeMode="contain" />
              </Animated.View>
            ) : (
              <Animated.View style={[styles.fishPlaceholder, { backgroundColor: rarityColor + '30', transform: [{ scale: fishSc }], opacity: fishOp }]}>
                <Text style={{ fontSize: 64 }}>🐟</Text>
              </Animated.View>
            )}
          </View>

          {/* ── BOTTOM INFO ZONE ── */}
          <Animated.View style={[styles.bottomZone, { opacity: cardOp, transform: [{ translateY: cardY }] }]}>

            {/* Species name */}
            <Text style={[styles.speciesName, { color: rarityColor }]} numberOfLines={2} adjustsFontSizeToFit>
              {species || 'Unknown'}
            </Text>

            {/* Weight / Length */}
            {(weight != null || length != null) && (
              <View style={styles.statsRow}>
                {weight != null && <View style={styles.statPill}><Text style={styles.statTxt}>{weight} lbs</Text></View>}
                {length != null && <View style={styles.statPill}><Text style={styles.statTxt}>{length}"</Text></View>}
              </View>
            )}

            {/* XP burst section */}
            {xpEarned > 0 && (
              <View style={styles.xpSection}>
                {/* Burst particles */}
                <View style={styles.burstOrigin} pointerEvents="none">
                  {burstAngles.map((angle, i) => (
                    <BurstDot key={i} angle={angle} dist={burstDists[i]} color={rarityColor} triggered={burstTriggered} />
                  ))}
                </View>
                <Animated.Text style={[styles.xpNumber, { color: rarityColor }]}>
                  +{displayXP}
                </Animated.Text>
                <Text style={[styles.xpLabel, { color: rarityColor + 'bb' }]}>XP EARNED</Text>
              </View>
            )}

            {/* Level progress */}
            <View style={styles.progressBlock}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>{levelAfter.icon} Lv {levelAfter.level} · {levelAfter.title}</Text>
                {xpToNext > 0 && (
                  <Text style={[styles.progressHint, { color: rarityColor }]}>
                    {xpToNext} XP to Lv {(levelAfter.level + 1)}
                  </Text>
                )}
              </View>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: levelW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                      backgroundColor: rarityColor,
                    },
                  ]}
                />
              </View>
              {nextUnlockLbl && (
                <Text style={styles.nextUnlockHint}>
                  Next unlock: {nextUnlockLbl} 🔓
                </Text>
              )}
            </View>

            {/* Passport progress — only for new species */}
            {isNewSpecies && speciesCount > 0 && totalSpecies > 0 && (
              <View style={styles.passportBlock}>
                <View style={styles.passportLabelRow}>
                  <Ionicons name="book-outline" size={13} color={colors.teal} />
                  <Text style={styles.passportLabel}>Fishing Passport</Text>
                  <Text style={[styles.passportCount, { color: colors.teal }]}>
                    {speciesCount} / {totalSpecies}
                  </Text>
                  <Text style={[styles.passportPct, { color: colors.teal }]}>
                    {Math.round((speciesCount / totalSpecies) * 100)}%
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progressW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                        backgroundColor: colors.teal,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* ── BUTTONS ── */}
            <TouchableOpacity style={[styles.primaryBtn, { borderColor: rarityColor + '40' }]} onPress={onDismiss} activeOpacity={0.85}>
              <LinearGradient
                colors={[colors.teal, '#00c8b0']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.primaryBtnGrad}
              >
                <Ionicons name="fish-outline" size={19} color="#000" />
                <Text style={styles.primaryBtnTxt}>Continue Fishing</Text>
              </LinearGradient>
            </TouchableOpacity>

            {isNewSpecies && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => onViewPassport?.(passportId ?? undefined)}
                activeOpacity={0.8}
              >
                <Ionicons name="book-outline" size={16} color={rarityColor} />
                <Text style={[styles.secondaryBtnTxt, { color: rarityColor }]}>View in Passport</Text>
              </TouchableOpacity>
            )}

            {/* Share icon row */}
            {onShareToFeed && (
              <TouchableOpacity style={styles.shareRow} onPress={onShareToFeed} activeOpacity={0.7}>
                <Ionicons name="share-social-outline" size={15} color="rgba(255,255,255,0.4)" />
                <Text style={styles.shareTxt}>Share to feed</Text>
              </TouchableOpacity>
            )}

          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
  },
  screen: {
    flex: 1,
  },
  // Top gradient zone
  topZone: {
    height: TOP_H,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    overflow: 'hidden',
  },
  raysWrap: {
    position: 'absolute',
    width: SW * 1.4, height: SW * 1.4,
    top: '50%', left: '50%',
    marginTop: -(SW * 0.7), marginLeft: -(SW * 0.7),
    alignItems: 'center', justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: 2, height: SW * 0.7,
    top: 0, left: '50%', marginLeft: -1,
    borderRadius: 2,
    transformOrigin: 'bottom',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  rarityBadge: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  rarityBadgeTxt: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.2,
  },
  closeBtn: {
    padding: 4,
  },
  newSpeciesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  nsDot: { width: 6, height: 6, borderRadius: 3 },
  newSpeciesTxt: {
    fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1.6,
  },
  sparkleWrap: {
    position: 'absolute', bottom: 0,
    left: SW * 0.2, right: SW * 0.2,
    height: 80,
  },
  // Hero fish
  fishHeroWrap: {
    position: 'absolute',
    top: TOP_H - FISH_SIZE * 0.58,
    alignSelf: 'center',
    width: FISH_SIZE + 40,
    height: FISH_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fishGlow: {
    position: 'absolute',
    width: FISH_SIZE * 0.8, height: FISH_SIZE * 0.8,
    borderRadius: FISH_SIZE * 0.4,
  },
  fishImg: {
    width: FISH_SIZE,
    height: FISH_SIZE,
  },
  fishPlaceholder: {
    width: FISH_SIZE, height: FISH_SIZE,
    borderRadius: FISH_SIZE / 2,
    justifyContent: 'center', alignItems: 'center',
  },
  // Bottom zone
  bottomZone: {
    flex: 1,
    backgroundColor: '#0a0f1a',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -28,
    paddingTop: FISH_SIZE * 0.45,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    alignItems: 'center',
    overflow: 'visible',
  },
  speciesName: {
    fontSize: 32, fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row', gap: 10, marginBottom: 12,
  },
  statPill: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingVertical: 7, paddingHorizontal: 14,
  },
  statTxt: { fontSize: 14, fontWeight: '700', color: colors.teal },
  // XP section
  xpSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  burstOrigin: {
    position: 'absolute',
    width: 1, height: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  xpNumber: {
    fontSize: 52, fontWeight: '900',
    letterSpacing: -1,
  },
  xpLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginTop: -4,
  },
  // Progress
  progressBlock: {
    width: '100%',
    marginBottom: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.65)' },
  progressHint:  { fontSize: 11, fontWeight: '700' },
  nextUnlockHint: {
    fontSize: 11, color: 'rgba(255,255,255,0.35)',
    marginTop: 5, textAlign: 'right',
  },
  progressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 3,
  },
  // Passport
  passportBlock: {
    width: '100%',
    marginBottom: 20,
  },
  passportLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, marginBottom: 6,
  },
  passportLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  passportCount: { fontSize: 12, fontWeight: '700' },
  passportPct:   { fontSize: 12, fontWeight: '800', marginLeft: 4 },
  // Buttons
  primaryBtn: {
    width: '100%', borderRadius: 16,
    overflow: 'hidden', marginBottom: 12,
    borderWidth: 1,
    ...Platform.select({
      ios:     { shadowColor: colors.teal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14 },
      android: { elevation: 8 },
    }),
  },
  primaryBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 17,
  },
  primaryBtnTxt: { fontSize: 17, fontWeight: '800', color: '#000' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, width: '100%',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 14, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryBtnTxt: { fontSize: 15, fontWeight: '700' },
  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6,
  },
  shareTxt: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
});
