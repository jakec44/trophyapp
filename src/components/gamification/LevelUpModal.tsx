/**
 * LevelUpModal — full-screen victory ceremony.
 * Matches the premium dark radial design:
 *   • Starfield background particles
 *   • Rotating light rays
 *   • Confetti rain
 *   • Gold badge with level number spinning in
 *   • XP count-up
 *   • "KEEP FISHING" primary / "VIEW PROFILE" secondary
 */

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Easing, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/utils/colors';
import { LEVEL_UNLOCKS, LEVEL_ROADMAP } from '@/src/types/gamification';

const GOLD  = colors.gold;
const TEAL  = colors.teal;
const { width: SW, height: SH } = Dimensions.get('window');

const BADGE_SIZE  = Math.min(SW * 0.52, 200);
const RING_BORDER = 7;

// ─── Star background particle ──────────────────────────────────────────────

const STAR_DATA = Array.from({ length: 50 }, (_, i) => ({
  x: (i * 73.13 + 17) % 100,   // deterministic spread across 0-100%
  y: (i * 47.71 + 11) % 100,
  size: 1.5 + (i % 3) * 0.8,
  delay: (i * 137) % 2000,
  dur: 1800 + (i * 89) % 1400,
}));

function StarField() {
  return (
    <>
      {STAR_DATA.map((s, i) => (
        <StarDot key={i} {...s} />
      ))}
    </>
  );
}

function StarDot({ x, y, size, delay, dur }: { x: number; y: number; size: number; delay: number; dur: number }) {
  const op = useRef(new Animated.Value(0.1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(op, { toValue: 0.8, duration: dur / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.1, duration: dur / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: `${x}%`, top: `${y}%`,
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: '#fff',
        opacity: op,
      }}
    />
  );
}

// ─── Confetti piece ────────────────────────────────────────────────────────

const CONFETTI_COLORS = [GOLD, TEAL, '#ff6b2b', '#c084fc', '#60a5fa', '#4ade80', '#fff', '#f97316'];
const CONFETTI_DATA = Array.from({ length: 60 }, (_, i) => ({
  startX: (i * SW / 60),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: i * 40,
  dur: 2200 + (i * 31) % 1200,
  drift: ((i % 7) - 3) * 30,
  isRect: i % 2 === 0,
}));

function ConfettiPiece({ startX, color, delay, dur, drift, isRect }: typeof CONFETTI_DATA[0]) {
  const y   = useRef(new Animated.Value(-30)).current;
  const x   = useRef(new Animated.Value(0)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const op  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(y,   { toValue: SH + 50, duration: dur, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(x,   { toValue: drift, duration: dur, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 1, duration: dur, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(op, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0, duration: 600, delay: dur - 800, useNativeDriver: true }),
        ]),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  const rotDeg = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '420deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: startX, top: 0, opacity: op, transform: [{ translateY: y }, { translateX: x }, { rotate: rotDeg }] }}
    >
      <View style={{ width: isRect ? 6 : 8, height: isRect ? 12 : 8, borderRadius: isRect ? 2 : 4, backgroundColor: color }} />
    </Animated.View>
  );
}

// ─── Sparkle burst around badge ────────────────────────────────────────────

function SparkleRing({ triggered, color }: { triggered: boolean; color: string }) {
  const COUNT = 12;
  const refs = useRef(
    Array.from({ length: COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      op: new Animated.Value(0),
      sc: new Animated.Value(0.3),
    }))
  ).current;

  useEffect(() => {
    if (!triggered) return;
    const r = BADGE_SIZE / 2 + 20;
    refs.forEach((p, i) => {
      const angle = (i / COUNT) * Math.PI * 2;
      Animated.sequence([
        Animated.parallel([
          Animated.spring(p.x, { toValue: Math.cos(angle) * r, useNativeDriver: true, damping: 10, stiffness: 120 }),
          Animated.spring(p.y, { toValue: Math.sin(angle) * r, useNativeDriver: true, damping: 10, stiffness: 120 }),
          Animated.timing(p.op, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.spring(p.sc, { toValue: 1, useNativeDriver: true, damping: 8, stiffness: 180 }),
        ]),
        Animated.timing(p.op, { toValue: 0, duration: 600, delay: 100, useNativeDriver: true }),
      ]).start();
    });
  }, [triggered]);

  const chars = ['✦', '✧', '★', '·', '◆', '✦', '✧', '★', '·', '◆', '✦', '✧'];
  return (
    <View style={{ position: 'absolute', width: 1, height: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      {refs.map((p, i) => (
        <Animated.View key={i} style={{ position: 'absolute', transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.sc }], opacity: p.op }}>
          <Text style={{ fontSize: 14, color }}>{chars[i]}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Unlock chip ───────────────────────────────────────────────────────────

function UnlockChip({ label, type }: { label: string; type: 'FEATURE' | 'BADGE' | 'TITLE' }) {
  const colors2: Record<string, [string, string]> = {
    FEATURE: ['#7c3aed', '#4c1d95'],
    BADGE:   ['#b45309', '#78350f'],
    TITLE:   ['#0e7490', '#164e63'],
  };
  const icons: Record<string, string> = { FEATURE: '🏆', BADGE: '🎖️', TITLE: '⚡' };
  const [c1, c2] = colors2[type] ?? ['#1e293b', '#0f172a'];
  return (
    <LinearGradient colors={[c1, c2]} style={uchip.wrap}>
      <Text style={uchip.icon}>{icons[type] ?? '⭐'}</Text>
      <Text style={uchip.label}>{label}</Text>
    </LinearGradient>
  );
}
const uchip = StyleSheet.create({
  wrap:  { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', gap: 4, flex: 1 },
  icon:  { fontSize: 22 },
  label: { fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'center' },
});

// ─── Main component ────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  fromLevel: number;
  fromTitle: string;
  toLevel: number;
  toTitle: string;
  toIcon: string;
  totalXp: number;
  xpInLevel: number;
  xpForNext: number;
  username: string;
  onDismiss: () => void;
  onViewProfile: () => void;
}

export function LevelUpModal({
  visible, fromLevel, toLevel, toTitle, toIcon,
  xpInLevel, xpForNext, onDismiss, onViewProfile,
}: Props) {

  const xpToNext = xpForNext > 0 ? xpForNext - xpInLevel : 0;
  const nextLevel = toLevel < 15 ? toLevel + 1 : null;
  const nextLevelTitle = nextLevel ? (LEVEL_ROADMAP[nextLevel - 1]?.title ?? '') : null;
  const unlocks = LEVEL_UNLOCKS[toLevel] ?? [];

  // Use the specific earned TITLE unlock for this level (e.g. "Pro Angler", "Trophy Hunter")
  // If no TITLE unlock exists for this level, fall back to the rank title from LEVEL_ROADMAP
  const earnedTitle = unlocks.find((u) => u.type === 'TITLE')?.label ?? toTitle;
  // Non-title unlocks (features/badges) shown separately in chips — exclude "Species Log" chip so we only show the teal button
  const otherUnlocks = unlocks.filter(
    (u) => u.type !== 'TITLE' && !(u.type === 'FEATURE' && u.label === 'Species Log')
  );

  // ── animation refs ──────────────────────────────────────────────────────
  const bgOp        = useRef(new Animated.Value(0)).current;
  const headerY     = useRef(new Animated.Value(-40)).current;
  const headerOp    = useRef(new Animated.Value(0)).current;
  const badgeSc     = useRef(new Animated.Value(0.1)).current;
  const badgeRot    = useRef(new Animated.Value(-0.5)).current;   // -180deg spin-in
  const badgeOp     = useRef(new Animated.Value(0)).current;
  const glowSc      = useRef(new Animated.Value(1)).current;
  const glowOp      = useRef(new Animated.Value(0.5)).current;
  const rayRot      = useRef(new Animated.Value(0)).current;
  const xpNumOp     = useRef(new Animated.Value(0)).current;
  const xpNumY      = useRef(new Animated.Value(20)).current;
  const bodyY       = useRef(new Animated.Value(30)).current;
  const bodyOp      = useRef(new Animated.Value(0)).current;
  const pulseSc     = useRef(new Animated.Value(1)).current;

  const [sparkleTriggered, setSparkleTriggered] = useState(false);
  const [xpDisplay, setXpDisplay]               = useState(0);
  const xpAnim = useRef(new Animated.Value(0)).current;

  // Determine an "XP earned" to display — cap at xpInLevel (what they have in this level)
  const xpEarned = Math.max(xpInLevel, 20);

  useEffect(() => {
    if (!visible) {
      bgOp.setValue(0); headerY.setValue(-40); headerOp.setValue(0);
      badgeSc.setValue(0.1); badgeRot.setValue(-0.5); badgeOp.setValue(0);
      glowSc.setValue(1); glowOp.setValue(0.5); rayRot.setValue(0);
      xpNumOp.setValue(0); xpNumY.setValue(20); bodyY.setValue(30); bodyOp.setValue(0);
      pulseSc.setValue(1); xpAnim.setValue(0);
      setSparkleTriggered(false); setXpDisplay(0);
      return;
    }

    // Background fade
    Animated.timing(bgOp, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    // Header slides down
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(headerY,  { toValue: 0, duration: 420, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
        Animated.timing(headerOp, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();

    // Badge spins + scales in
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(badgeSc,  { toValue: 1.1, damping: 6, stiffness: 180, useNativeDriver: true }),
        Animated.timing(badgeOp,  { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(badgeRot, { toValue: 0, duration: 600, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]),
      Animated.spring(badgeSc, { toValue: 1, damping: 12, stiffness: 200, useNativeDriver: true }),
    ]).start(() => {
      setSparkleTriggered(true);
      // screen pulse
      Animated.sequence([
        Animated.timing(pulseSc, { toValue: 1.012, duration: 90, useNativeDriver: true }),
        Animated.timing(pulseSc, { toValue: 1, duration: 130, useNativeDriver: true }),
      ]).start();
    });

    // Glow pulse loop
    setTimeout(() => {
      Animated.timing(glowOp, { toValue: 0.6, duration: 300, useNativeDriver: true }).start();
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowSc, { toValue: 1.4, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(glowOp, { toValue: 0.18, duration: 1000, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(glowSc, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(glowOp, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
          ]),
        ])
      ).start();
    }, 500);

    // Rays spin
    Animated.loop(
      Animated.timing(rayRot, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // XP number fades in
    Animated.sequence([
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(xpNumOp, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(xpNumY,  { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();

    // Body slides up
    Animated.sequence([
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(bodyOp, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(bodyY,  { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();

    // XP count-up
    xpAnim.setValue(0);
    const listener = xpAnim.addListener(({ value }) => setXpDisplay(Math.round(value)));
    Animated.timing(xpAnim, {
      toValue: xpEarned, duration: 900, delay: 800,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start(() => xpAnim.removeListener(listener));

    return () => xpAnim.removeListener(listener);
  }, [visible]);

  const rayInterp  = rayRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const badgeRotDeg = badgeRot.interpolate({ inputRange: [-0.5, 0], outputRange: ['-180deg', '0deg'] });

  const handleViewProfile = () => {
    onDismiss();
    onViewProfile();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.root, { opacity: bgOp }]}>

        {/* Star field */}
        <StarField />

        {/* Confetti */}
        {CONFETTI_DATA.map((c, i) => <ConfettiPiece key={i} {...c} />)}

        {/* Pulsing screen wrapper */}
        <Animated.View style={[s.screen, { transform: [{ scale: pulseSc }] }]}>

          {/* ── Rotating rays ── */}
          <Animated.View style={[s.raysWrap, { transform: [{ rotate: rayInterp }] }]} pointerEvents="none">
            {Array.from({ length: 18 }, (_, i) => (
              <View key={i} style={[s.ray, { transform: [{ rotate: `${i * 20}deg` }] }]} />
            ))}
          </Animated.View>

          {/* ── LEVEL UP! header ── */}
          <Animated.View style={[s.header, { opacity: headerOp, transform: [{ translateY: headerY }] }]}>
            <Text style={s.levelUpTxt}>✦  L E V E L   U P !  ✦</Text>
          </Animated.View>

          {/* ── Gold badge ── */}
          <View style={s.badgeArea}>
            {/* Glow behind badge */}
            <Animated.View
              pointerEvents="none"
              style={[s.badgeGlow, { transform: [{ scale: glowSc }], opacity: glowOp }]}
            />

            {/* Sparkle burst */}
            <SparkleRing triggered={sparkleTriggered} color={GOLD} />

            {/* Badge */}
            <Animated.View
              style={[
                s.badge,
                {
                  opacity: badgeOp,
                  transform: [{ scale: badgeSc }, { rotate: badgeRotDeg }],
                },
              ]}
            >
              {/* Outer gold ring */}
              <LinearGradient
                colors={['#ffe066', '#c8860a', '#ffe066', '#c8860a']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.badgeOuter}
              >
                {/* Inner dark circle */}
                <LinearGradient
                  colors={['#0d1e30', '#061220', '#0d2840']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.badgeInner}
                >
                  <Text style={s.levelNum} adjustsFontSizeToFit numberOfLines={1}>
                    {toLevel}
                  </Text>
                </LinearGradient>
              </LinearGradient>
            </Animated.View>
          </View>

          {/* ── Title banner ── */}
          <Animated.View style={[s.titleBanner, { opacity: headerOp }]}>
            <LinearGradient
              colors={['#c8860a', '#ffe066', '#c8860a']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.titleBannerGrad}
            >
              <Text style={s.titleBannerTxt}>{earnedTitle.toUpperCase()}</Text>
            </LinearGradient>
          </Animated.View>

          {/* ── XP earned ── */}
          <Animated.View style={[s.xpRow, { opacity: xpNumOp, transform: [{ translateY: xpNumY }] }]}>
            <Text style={s.xpIcon}>{toIcon}</Text>
            <Text style={s.xpNum}>+{xpDisplay} XP</Text>
            <Text style={s.xpStar}>✦</Text>
          </Animated.View>

          {/* ── Body ── */}
          <Animated.View style={[s.body, { opacity: bodyOp, transform: [{ translateY: bodyY }] }]}>

            {/* "You're now a …" */}
            <Text style={s.nowTxt}>
              You're now a <Text style={[s.nowBold, { color: TEAL }]}>{earnedTitle.toUpperCase()}!</Text>
            </Text>

            {/* XP to next level */}
            {xpToNext > 0 && nextLevel ? (
              <Text style={s.xpToNext}>
                {xpToNext.toLocaleString()} XP until Level {nextLevel}
                {nextLevelTitle ? ` · ${nextLevelTitle}` : ''}
              </Text>
            ) : (
              <Text style={s.xpToNext}>Maximum level reached — Legend! 🏆</Text>
            )}

            {/* Unlocks */}
            {otherUnlocks.length > 0 && (
              <View style={s.unlocksWrap}>
                <Text style={s.unlocksLabel}>UNLOCKED</Text>
                <View style={s.unlocksRow}>
                  {otherUnlocks.slice(0, 3).map((u, i) => <UnlockChip key={i} label={u.label} type={u.type} />)}
                </View>
              </View>
            )}

            {/* KEEP FISHING */}
            <TouchableOpacity style={s.primaryBtn} onPress={onDismiss} activeOpacity={0.88}>
              <LinearGradient
                colors={[TEAL, '#00b8a0']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.primaryBtnGrad}
              >
                <Text style={s.primaryBtnTxt}>KEEP FISHING</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* SPECIES LOG */}
            <TouchableOpacity style={s.secondaryBtn} onPress={handleViewProfile} activeOpacity={0.8}>
              <Text style={s.secondaryBtnTxt}>SPECIES LOG</Text>
            </TouchableOpacity>

          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020d18',
  },
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingHorizontal: 28,
  },

  // Rays
  raysWrap: {
    position: 'absolute',
    width: SW * 1.6, height: SW * 1.6,
    alignSelf: 'center',
    top: SH * 0.5 - SW * 0.8,
    alignItems: 'center', justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: 2, height: SW * 0.8,
    top: 0, left: '50%', marginLeft: -1,
    backgroundColor: TEAL + '14',
    borderRadius: 2,
    transformOrigin: 'bottom',
  },

  // Header
  header: {
    marginBottom: 20,
  },
  levelUpTxt: {
    fontSize: 22, fontWeight: '900',
    color: TEAL,
    letterSpacing: 2,
    textShadowColor: TEAL,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },

  // Badge area
  badgeArea: {
    width: BADGE_SIZE + 60, height: BADGE_SIZE + 60,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  badgeGlow: {
    position: 'absolute',
    width: BADGE_SIZE * 0.9, height: BADGE_SIZE * 0.9,
    borderRadius: BADGE_SIZE * 0.45,
    backgroundColor: GOLD,
  },
  badge: {
    width: BADGE_SIZE, height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    ...Platform.select({
      ios:     { shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 24 },
      android: { elevation: 20 },
    }),
  },
  badgeOuter: {
    flex: 1,
    borderRadius: BADGE_SIZE / 2,
    padding: RING_BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeInner: {
    flex: 1, width: '100%',
    borderRadius: (BADGE_SIZE - RING_BORDER * 2) / 2,
    justifyContent: 'center', alignItems: 'center',
  },
  levelNum: {
    fontSize: BADGE_SIZE * 0.48, fontWeight: '900',
    color: TEAL,
    letterSpacing: -2,
    textShadowColor: TEAL,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },

  // Title banner
  titleBanner: {
    marginBottom: 14,
    borderRadius: 8,
    overflow: 'hidden',
  },
  titleBannerGrad: {
    paddingVertical: 7,
    paddingHorizontal: 28,
  },
  titleBannerTxt: {
    fontSize: 15, fontWeight: '900',
    color: '#1a0800',
    letterSpacing: 2.5,
  },

  // XP row
  xpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 18,
  },
  xpIcon: { fontSize: 20 },
  xpNum: {
    fontSize: 34, fontWeight: '900',
    color: GOLD,
    letterSpacing: -0.5,
    textShadowColor: GOLD,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  xpStar: { fontSize: 18, color: TEAL },

  // Body
  body: {
    width: '100%', alignItems: 'center', gap: 0,
  },
  nowTxt: {
    fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', marginBottom: 6,
  },
  nowBold: { fontWeight: '900' },
  xpToNext: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)',
    textAlign: 'center', marginBottom: 20,
  },

  // Unlocks
  unlocksWrap: { width: '100%', gap: 8, marginBottom: 20 },
  unlocksLabel: {
    fontSize: 10, fontWeight: '800',
    color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5,
    textAlign: 'center',
  },
  unlocksRow: { flexDirection: 'row', gap: 8 },

  // Buttons
  primaryBtn: {
    width: '100%', borderRadius: 18,
    overflow: 'hidden', marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: TEAL, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16 },
      android: { elevation: 10 },
    }),
  },
  primaryBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  primaryBtnTxt: {
    fontSize: 17, fontWeight: '900',
    color: '#000', letterSpacing: 2,
  },
  secondaryBtn: {
    width: '100%', paddingVertical: 15, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  secondaryBtnTxt: {
    fontSize: 14, fontWeight: '800',
    color: TEAL, letterSpacing: 1.5,
  },
});
