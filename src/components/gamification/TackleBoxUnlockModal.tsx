/**
 * TackleBoxUnlockModal — premium fishing tackle case for badge unlock.
 * Idle: floating sparkles, chest bounce, glow pulse. Tap: shake → open → burst → confetti → badge.
 */

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors } from '@/utils/colors';
import { RarityBadge } from '@/src/components/profile/RarityBadge';
import { SpeciesBadgeImage } from '@/src/components/profile/SpeciesBadgeImage';
import { hasCustomSpeciesBadgeImage } from '@/src/constants/speciesBadgeImages';
import { RARITY_PALETTE } from '@/src/types/badgeRarity';
import type { BadgeRarity } from '@/src/types/badgeRarity';

const GOLD = colors.gold;
const TEAL = colors.teal;
const { width: SW, height: SH } = Dimensions.get('window');

const CONFETTI_COUNT = 80;
const CONF_DURATION_MS = 5000;

function mulberry32(seed: number) {
  return function rnd() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Treasure chest: ornate style, dark brown + gold trim
const BOX_WIDTH = Math.min(SW * 0.78, 260);
const BOX_HEIGHT = Math.min(BOX_WIDTH * 0.52, 125);
const LID_HEIGHT = Math.round(36 * 0.8); // domed lid
const LID_THICKNESS = 6;
const LID_FULL = LID_HEIGHT + LID_THICKNESS;
const LID_HALF = LID_FULL / 2;
const SPARKLE_COUNT = 24;

// Glow rings: 40% smaller (premium, subtle)
const GLOW_OUTER_W = (BOX_WIDTH + 80) * 0.6;
const GLOW_OUTER_H = (BOX_HEIGHT + 100) * 0.6;
const GLOW_MID_W = (BOX_WIDTH + 50) * 0.6;
const GLOW_MID_H = (BOX_HEIGHT + 60) * 0.6;

/** Chest glow color by rarity — subtle and premium */
const CHEST_GLOW: Record<BadgeRarity, { outer: string; mid: string; burst: string }> = {
  COMMON: { outer: GOLD + '70', mid: GOLD + '45', burst: GOLD + '40' },
  RARE: { outer: '#60a5fa' + '90', mid: '#3b82f6' + '60', burst: '#3b82f6' + '50' },
  EPIC: { outer: '#c084fc' + '90', mid: '#a855f7' + '70', burst: '#a855f7' + '50' },
  MYTHIC: { outer: '#fbbf24' + 'b0', mid: '#f59e0b' + '90', burst: '#f59e0b' + '60' },
};

interface TackleBoxUnlockModalProps {
  visible: boolean;
  onDismiss: () => void;
  badgeName: string;
  rarity: BadgeRarity;
  subtitle?: string;
  /** When set, use proper badge image (e.g. species-red-drum-elite) instead of generic RarityBadge */
  badgeKey?: string;
}

function FloatingSparkle({
  index,
  visible,
  centerX,
  centerY,
}: {
  index: number;
  visible: boolean;
  centerX: number;
  centerY: number;
}) {
  const opacity = useRef(new Animated.Value(0.2)).current;
  const angle = (index / SPARKLE_COUNT) * Math.PI * 2 + (index % 3) * 0.5;
  const r = BOX_WIDTH * 0.45 + (index % 4) * 10;
  const x = Math.cos(angle) * r;
  const y = Math.sin(angle) * r - 15;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 100),
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.12,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, index]);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute' as const,
          left: centerX + x - 2,
          top: centerY + y - 25,
          width: index % 3 === 0 ? 4 : 3,
          height: index % 3 === 0 ? 4 : 3,
          borderRadius: 2,
          backgroundColor: GOLD,
          opacity,
        },
      ]}
    />
  );
}

const BADGE_SIZE = 72;

export function TackleBoxUnlockModal({
  visible,
  onDismiss,
  badgeName,
  rarity,
  subtitle,
  badgeKey,
}: TackleBoxUnlockModalProps) {
  const [phase, setPhase] = useState<'idle' | 'shaking' | 'opening' | 'revealed'>('idle');

  const sparkleOp = useRef(new Animated.Value(0)).current;
  const boxScale = useRef(new Animated.Value(1)).current;
  const boxBounce = useRef(new Animated.Value(0)).current;
  const boxShake = useRef(new Animated.Value(0)).current;
  const lidRotate = useRef(new Animated.Value(0)).current;
  const burstScale = useRef(new Animated.Value(0)).current;
  const burstOp = useRef(new Animated.Value(0)).current;
  const badgeY = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.6)).current;
  const badgeOp = useRef(new Animated.Value(0)).current;
  const badgeGlowOp = useRef(new Animated.Value(0)).current;
  const textOp = useRef(new Animated.Value(0)).current;
  const particleOp = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef<Animated.Value[]>([]).current;

  if (confettiAnims.length === 0) {
    for (let i = 0; i < CONFETTI_COUNT; i++) confettiAnims.push(new Animated.Value(0));
  }

  const palette = RARITY_PALETTE[rarity];
  const chestGlow = CHEST_GLOW[rarity];

  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      lidRotate.setValue(0);
      burstScale.setValue(0);
      burstOp.setValue(0);
      badgeY.setValue(0);
      badgeScale.setValue(0.6);
      badgeOp.setValue(0);
      badgeGlowOp.setValue(0);
      textOp.setValue(0);
      particleOp.setValue(0);
      boxShake.setValue(0);
      return;
    }
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleOp, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sparkleOp, {
          toValue: 0.45,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    glowLoop.start();

    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(boxBounce, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(boxBounce, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    bounceLoop.start();

    return () => {
      glowLoop.stop();
      bounceLoop.stop();
    };
  }, [visible]);

  // Confetti when revealed
  useEffect(() => {
    if (phase !== 'revealed' || !visible) return;
    confettiAnims.forEach((a) => a.setValue(0));
    const seed = Date.now() % 1e6;
    const rnd = mulberry32(seed);
    const colors = [palette.primary, GOLD, TEAL, '#ff8c00', '#FFD700', '#E07D3A', '#c084fc', '#60a5fa'];
    confettiAnims.forEach((anim, i) => {
      const delay = 0 + rnd() * 300;
      const fallDuration = 1800 + rnd() * 1500;
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: fallDuration,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.delay(Math.max(0, CONF_DURATION_MS - delay - fallDuration)),
        Animated.timing(anim, { toValue: 1.5, duration: 600, useNativeDriver: true }),
      ]).start();
    });
  }, [phase, visible]);

  const handleTapBox = () => {
    if (phase !== 'idle') return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setPhase('shaking');

    Animated.sequence([
      Animated.sequence([
        Animated.timing(boxShake, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(boxShake, { toValue: 2, duration: 50, useNativeDriver: true }),
        Animated.timing(boxShake, { toValue: 3, duration: 50, useNativeDriver: true }),
        Animated.timing(boxShake, { toValue: 4, duration: 50, useNativeDriver: true }),
        Animated.timing(boxShake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]),
      Animated.delay(80),
    ]).start(() => {
      setPhase('opening');

      // Start particles rising from chest center
      Animated.timing(particleOp, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      Animated.parallel([
        Animated.sequence([
          Animated.timing(boxScale, { toValue: 1.06, duration: 60, useNativeDriver: true }),
          Animated.timing(boxScale, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]),
        Animated.timing(lidRotate, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.timing(burstScale, {
              toValue: 1,
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(burstOp, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(burstOp, {
            toValue: 0,
            duration: 320,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setPhase('revealed');

        // Badge emerges from chest center: scale 0.6→1.15→1, translate up ~40px
        Animated.parallel([
          Animated.sequence([
            Animated.timing(badgeScale, {
              toValue: 1.15,
              duration: 220,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(badgeScale, {
              toValue: 1,
              duration: 180,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(badgeY, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.back(1.3)),
            useNativeDriver: true,
          }),
          Animated.timing(badgeOp, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(badgeGlowOp, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => {
          Animated.timing(textOp, {
            toValue: 1,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        });
      });
    });
  };

  const shakeX = boxShake.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [0, -5, 5, -3, 0],
  });
  // Lid rotates 100–110° around hinge at top rear (bottom of lid)
  const lidDeg = lidRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-105deg'],
  });
  const burstScaleOut = burstScale.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1.6],
  });
  // Badge starts inside chest center, rises ~40px
  const badgeTranslateY = badgeY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -40],
  });
  const bounceY = boxBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });
  const glowOpacity = sparkleOp.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.9],
  });

  // Chest center for particles (content is centered)
  const chestCenterY = SH * 0.5;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#010a12', '#02111c', '#030d18', '#010a12']}
          style={StyleSheet.absoluteFill}
        />

        {/* Confetti layer (when revealed) */}
        {phase === 'revealed' && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {confettiAnims.slice(0, CONFETTI_COUNT).map((anim, i) => {
              const rnd = mulberry32((i + 100) * 7919);
              const fromX = rnd() * SW;
              const fromY = -20 - rnd() * 50;
              const toY = 60 + rnd() * (SH * 0.7);
              const toX = fromX + (rnd() - 0.5) * 120;
              const confColors = [palette.primary, GOLD, TEAL, '#ff8c00', '#FFD700', '#E07D3A', '#c084fc', '#60a5fa'];
              const color = confColors[i % confColors.length];
              return (
                <Animated.View
                  key={`conf-${i}`}
                  style={[
                    styles.confettiPiece,
                    {
                      backgroundColor: color,
                      left: fromX,
                      top: fromY,
                      transform: [
                        {
                          translateX: anim.interpolate({
                            inputRange: [0, 1, 1.5],
                            outputRange: [0, toX - fromX, toX - fromX],
                          }),
                        },
                        {
                          translateY: anim.interpolate({
                            inputRange: [0, 1, 1.5],
                            outputRange: [0, toY - fromY, toY - fromY],
                          }),
                        },
                      ],
                      opacity: anim.interpolate({
                        inputRange: [0, 0.6, 1, 1.5],
                        outputRange: [0.9, 0.5, 0.2, 0],
                      }),
                    },
                  ]}
                />
              );
            })}
          </View>
        )}

        {/* Header */}
        <Text style={styles.header}>NEW BADGE UNLOCKED</Text>

        {phase === 'idle' &&
          Array.from({ length: SPARKLE_COUNT }, (_, i) => (
            <FloatingSparkle
              key={i}
              index={i}
              visible={visible}
              centerX={SW / 2}
              centerY={chestCenterY}
            />
          ))}

        {/* Burst (on open) */}
        {phase !== 'idle' && (
          <Animated.View
            style={[
              styles.burstWrap,
              {
                opacity: burstOp,
                transform: [{ scale: burstScaleOut }],
              },
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={[chestGlow.burst, 'rgba(0,0,0,0)']}
              style={styles.burst}
            />
            <View style={[styles.burstInner, { backgroundColor: palette.glow }]} />
          </Animated.View>
        )}

        {/* Box container — lower to avoid header overlap */}
        <TouchableOpacity
          style={styles.boxTouchArea}
          onPress={handleTapBox}
          activeOpacity={1}
          disabled={phase !== 'idle'}
        >
          <View style={styles.chestUnderGlow} />
          <Animated.View
            style={{
              transform: [
                { translateX: shakeX },
                { translateY: phase === 'idle' ? bounceY : 0 },
                { scale: boxScale },
              ],
            }}
          >
            {/* Glow rings — 40% smaller, subtle */}
            <Animated.View
              style={[
                styles.glowOuter,
                {
                  width: GLOW_OUTER_W,
                  height: GLOW_OUTER_H,
                  borderRadius: GLOW_OUTER_W / 2,
                  opacity: glowOpacity,
                  borderColor: chestGlow.outer,
                  backgroundColor: chestGlow.outer.substring(0, 7) + '15',
                },
              ]}
            />
            <Animated.View
              style={[
                styles.glowMid,
                {
                  width: GLOW_MID_W,
                  height: GLOW_MID_H,
                  borderRadius: GLOW_MID_W / 2,
                  opacity: sparkleOp.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.55] }),
                  borderWidth: 1.2,
                  borderColor: chestGlow.mid,
                },
              ]}
            />

            {/* Ornate treasure chest — dark brown + gold trim + blue gems */}
            <View style={[styles.boxBody, { width: BOX_WIDTH, height: BOX_HEIGHT + LID_FULL }]}>
              {/* Golden feet — base bar */}
              <View style={styles.chestFeet}>
                <View style={styles.chestFoot} />
                <View style={styles.chestFoot} />
                <View style={styles.chestFoot} />
                <View style={styles.chestFoot} />
              </View>

              {/* Base — dark brown wood body */}
              <View style={[styles.boxBase, { height: BOX_HEIGHT }]}>
                <LinearGradient
                  colors={['#2d1f12', '#1a120a', '#251808', '#2d1f12']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.boxSides}
                />
                <LinearGradient
                  colors={['#4a3520', '#3d2914', '#2a1c0a', '#352410']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.boxFront}
                >
                  {/* Gold horizontal bands */}
                  <View style={[styles.goldBand, styles.goldBandTop]} />
                  <View style={[styles.goldBand, styles.goldBandBottom]} />
                  <View style={styles.boxInnerCavity} />
                  {/* Elaborate lock plate — center */}
                  <View style={styles.lockPlate}>
                    <View style={styles.lockKeyhole} />
                  </View>
                </LinearGradient>
              </View>

              {/* Lid — domed, gold trim, handle, blue gems on corners */}
              <Animated.View
                style={[
                  styles.lidWrap,
                  {
                    width: BOX_WIDTH,
                    height: LID_FULL,
                    top: 0,
                    left: 0,
                    transform: [
                      { translateY: -LID_HALF },
                      { rotate: lidDeg },
                      { translateY: LID_HALF },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={['#3d2914', '#2a1c0a', '#1f1508', '#352410']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.lid}
                >
                  {/* Gold trim on lid edges */}
                  <View style={styles.lidGoldTrim} />
                  {/* Gold handle on top center */}
                  <View style={styles.lidHandle} />
                  {/* Blue gems on top corners */}
                  <View style={[styles.lidGem, styles.lidGemLeft]} />
                  <View style={[styles.lidGem, styles.lidGemRight]} />
                  <View style={styles.lidTopHighlight} />
                  <View style={styles.lidHingeLine} />
                </LinearGradient>
              </Animated.View>

              {/* Badge — emerges from center of chest interior */}
              {phase !== 'idle' && (
                <View style={styles.badgeContainer}>
                  <Animated.View
                    style={[
                      styles.badgeRise,
                      {
                        transform: [
                          { translateY: badgeTranslateY },
                          { scale: badgeScale },
                        ],
                        opacity: badgeOp,
                      },
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.badgeGlow,
                        {
                          backgroundColor: palette.glow,
                          width: 90,
                          height: 90,
                          borderRadius: 45,
                          opacity: badgeGlowOp.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 0.5],
                          }),
                        },
                      ]}
                    />
                    {badgeKey && hasCustomSpeciesBadgeImage(badgeKey) ? (
                      <SpeciesBadgeImage badgeKey={badgeKey} size={BADGE_SIZE} scale={1.2} />
                    ) : (
                      <RarityBadge
                        rarity={rarity}
                        size={BADGE_SIZE}
                        animated={rarity === 'EPIC' || rarity === 'MYTHIC'}
                      />
                    )}
                  </Animated.View>
                </View>
              )}
            </View>
          </Animated.View>
        </TouchableOpacity>

        {/* Particles — rise from chest center when opening */}
        {(phase === 'opening' || phase === 'revealed') &&
          Array.from({ length: 8 }, (_, i) => {
            const angle = (i / 8) * Math.PI * 0.6 - Math.PI * 0.3;
            const offsetX = Math.cos(angle) * 40;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.risingParticle,
                  {
                    left: SW / 2 - 3 + offsetX,
                    top: chestCenterY + 25,
                    opacity: particleOp.interpolate({
                      inputRange: [0, 0.3, 1],
                      outputRange: [0, 0.7, 0.2],
                    }),
                    transform: [
                      {
                        translateY: particleOp.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -70 - i * 12],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={[styles.particleDot, { backgroundColor: GOLD }]} />
              </Animated.View>
            );
          })}

        {phase === 'idle' && <Text style={styles.tapHint}>Tap chest to open</Text>}

        {phase === 'revealed' && (
          <Animated.View style={[styles.revealArea, { opacity: textOp }]}>
            <Text style={styles.badgeName}>{badgeName}</Text>
            <View
              style={[
                styles.rarityPill,
                {
                  backgroundColor: palette.primary + '35',
                  borderColor: palette.border,
                  borderWidth: 1.5,
                },
              ]}
            >
              <Text style={[styles.rarityText, { color: palette.primary }]}>
                {palette.label}
              </Text>
            </View>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </Animated.View>
        )}

        <TouchableOpacity
          style={[styles.dismissBtn, phase !== 'revealed' && styles.dismissBtnHidden]}
          onPress={onDismiss}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[TEAL, '#00c4a8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.dismissBtnGrad}
          >
            <View style={styles.dismissBtnGlow} />
            <Text style={styles.dismissBtnTxt}>COLLECT</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3.5,
    color: GOLD,
    marginBottom: 20,
    textShadowColor: GOLD + '80',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  burstWrap: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    left: SW / 2 - 110,
    top: SH * 0.5 - 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burst: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 110,
  },
  burstInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    opacity: 0.4,
  },
  boxTouchArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  chestUnderGlow: {
    position: 'absolute',
    bottom: -15,
    left: '50%',
    marginLeft: -80,
    width: 160,
    height: 25,
    borderRadius: 80,
    backgroundColor: GOLD,
    opacity: 0.25,
  },
  glowOuter: {
    position: 'absolute',
    top: -GLOW_OUTER_H / 2 + (BOX_HEIGHT + LID_FULL) / 2,
    left: -GLOW_OUTER_W / 2 + BOX_WIDTH / 2,
    borderWidth: 1.5,
  },
  glowMid: {
    position: 'absolute',
    top: -GLOW_MID_H / 2 + (BOX_HEIGHT + LID_FULL) / 2,
    left: -GLOW_MID_W / 2 + BOX_WIDTH / 2,
  },
  boxBody: {
    borderRadius: 12,
    overflow: 'visible',
    position: 'relative',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  chestFeet: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
    zIndex: 1,
  },
  chestFoot: {
    width: 16,
    height: 10,
    borderRadius: 3,
    backgroundColor: GOLD,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.8)',
  },
  boxBase: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    marginTop: LID_HEIGHT + LID_THICKNESS,
  },
  boxSides: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
    opacity: 0.9,
  },
  boxFront: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 4,
    bottom: 4,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.6)',
    overflow: 'hidden',
  },
  goldBand: {
    position: 'absolute',
    left: -2,
    right: -2,
    height: 4,
    backgroundColor: GOLD,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.8)',
  },
  goldBandTop: { top: 8 },
  goldBandBottom: { bottom: 8 },
  lockPlate: {
    position: 'absolute',
    left: '50%',
    marginLeft: -24,
    bottom: 12,
    width: 48,
    height: 28,
    borderRadius: 6,
    backgroundColor: GOLD,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  lockKeyhole: {
    width: 6,
    height: 10,
    borderRadius: 3,
    backgroundColor: '#1a1000',
  },
  boxInnerCavity: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 6,
    top: 4,
    left: 6,
    right: 6,
    bottom: 5,
  },
  boxEdgeHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  boxBottomShadow: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    right: 4,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 4,
  },
  lidWrap: {
    position: 'absolute',
  },
  lid: {
    flex: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.7)',
    overflow: 'hidden',
    position: 'relative',
  },
  lidGoldTrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: GOLD,
    opacity: 0.9,
  },
  lidHandle: {
    position: 'absolute',
    top: 10,
    left: '50%',
    marginLeft: -18,
    width: 36,
    height: 12,
    borderRadius: 6,
    backgroundColor: GOLD,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.9)',
  },
  lidGem: {
    position: 'absolute',
    top: 6,
    width: 14,
    height: 18,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#60a5fa',
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  lidGemLeft: {
    left: 10,
  },
  lidGemRight: {
    right: 10,
  },
  lidTopHighlight: {
    position: 'absolute',
    top: 4,
    left: 20,
    right: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  lidHingeLine: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
  badgeContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: LID_FULL + BOX_HEIGHT / 2 - 36,
    height: 80,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  badgeRise: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlow: {
    position: 'absolute',
  },
  risingParticle: {
    position: 'absolute',
    width: 6,
    height: 6,
  },
  particleDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  confettiPiece: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  tapHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
    marginTop: -4,
  },
  revealArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badgeName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 10,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  rarityPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rarityText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  subtitle: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 10,
    textAlign: 'center',
  },
  dismissBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    minWidth: 180,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  dismissBtnHidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
  dismissBtnGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    position: 'relative',
  },
  dismissBtnGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dismissBtnTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 2,
  },
});
