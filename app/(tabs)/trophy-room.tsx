import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  Modal,
  ScrollView,
  TextInput,
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  Easing,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParticleBackground } from '@/src/components/ui/ParticleBackground';
import { useRouter } from 'expo-router';
import { colors } from '@/utils/colors';
import { mockCatches, type Catch } from '@/utils/mockData';
import { useTrophyRoom } from '@/src/hooks/useTrophyRoom';
import type { MountedFish, TrophyTheme, ThemeType } from '@/src/types/trophyRoom';
import Feather from '@expo/vector-icons/Feather';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';
import { isValidImageUri } from '@/src/lib/imageUri';
import { Ionicons } from '@expo/vector-icons';

const GOLD = colors.gold;
const BRIGHT_BLUE = colors.brightBlue;
const MOUNT_LIMIT_PER_WEEK = 5;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ROOM_WIDTH = SCREEN_WIDTH * 1.8;
const MAX_TILT = 25;

function AnimatedBubbles() {
  const bubbles = useRef(
    Array.from({ length: 12 }, () => ({
      anim: new Animated.Value(0),
      left: Math.random() * 100,
      size: 4 + Math.random() * 10,
      duration: 3000 + Math.random() * 4000,
      delay: Math.random() * 2000,
    }))
  ).current;

  useEffect(() => {
    const loops = bubbles.map((b) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(b.delay),
          Animated.timing(b.anim, {
            toValue: 1,
            duration: b.duration,
            useNativeDriver: true,
            easing: Easing.linear,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bubbles.map((b, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bubble,
            {
              left: `${b.left}%`,
              width: b.size,
              height: b.size,
              borderRadius: b.size / 2,
              opacity: b.anim.interpolate({
                inputRange: [0, 0.3, 0.7, 1],
                outputRange: [0, 0.6, 0.6, 0],
              }),
              transform: [
                {
                  translateY: b.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [SCREEN_HEIGHT, -50],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const DARK_WOOD = '#3D1F0F';

/** 6 wall slots: left%, top%, width%, height%, scale (natural trophy wall layout) */
const WALL_SLOTS = [
  { left: 8, top: 12, width: 18, height: 16, scale: 1.0 },
  { left: 30, top: 8, width: 20, height: 18, scale: 1.15 },
  { left: 54, top: 10, width: 22, height: 19, scale: 1.2 },
  { left: 78, top: 14, width: 16, height: 14, scale: 0.9 },
  { left: 18, top: 36, width: 19, height: 17, scale: 1.05 },
  { left: 58, top: 38, width: 20, height: 18, scale: 1.1 },
] as const;

function WoodPlank({ index, total }: { index: number; total: number }) {
  const variation = ((index % 5) - 2) * 5;
  const color = adjustColor(DARK_WOOD, variation);
  return (
    <View
      style={[
        styles.woodPlank,
        {
          flex: 1,
          backgroundColor: color,
          borderRightWidth: index < total - 1 ? 1 : 0,
          borderRightColor: 'rgba(0,0,0,0.3)',
        },
      ]}
    />
  );
}

function EmptySlotFrame({
  onPress,
  style,
  isLodge,
}: {
  onPress: () => void;
  style: object;
  isLodge?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.woodenFrame, styles.ghostFrame, isLodge && styles.frameDark, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.woodenFrameInner, styles.ghostFrameInner]}>
        <View style={[styles.frameMat, styles.ghostMat]}>
          <View style={styles.ghostPlusIcon}>
            <Feather name="plus" size={28} color="rgba(255,255,255,0.5)" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FilledFishFrame({
  mount,
  catchData,
  slot,
  themeType,
  onPress,
  style,
  isLodge,
}: {
  mount: MountedFish;
  catchData: Catch;
  slot: (typeof WALL_SLOTS)[number];
  themeType: ThemeType;
  onPress: () => void;
  style: object;
  isLodge?: boolean;
}) {
  const fishImg = catchData.photo;
  return (
    <TouchableOpacity
      style={[styles.woodenFrame, isLodge && styles.frameDark, style]}
      onPress={onPress}
      activeOpacity={1}
    >
      <View style={styles.woodenFrameInner}>
        <View style={styles.frameMat}>
          {isValidImageUri(fishImg) ? (
            <Image source={{ uri: fishImg }} style={styles.fishInFrame} resizeMode="contain" />
          ) : (
            <View style={[styles.fishInFrame, { backgroundColor: colors.lightBorder, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="fish" size={40} color={colors.lightSubtext} />
            </View>
          )}
          <Text style={styles.frameSpecies} numberOfLines={1}>
            {catchData.species}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FloorWoodGrain() {
  const lines = 12;
  return (
    <View style={styles.floorGrainContainer} pointerEvents="none">
      {Array.from({ length: lines }, (_, i) => (
        <View
          key={i}
          style={[
            styles.floorGrainLine,
            {
              top: `${(i / lines) * 100}%`,
              backgroundColor: i % 2 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.02)',
            },
          ]}
        />
      ))}
    </View>
  );
}

function ThemeBackground({ themeType }: { themeType: ThemeType }) {
  const isLodge = themeType === 'duck-lodge';
  const isUnderwater = themeType === 'underwater';

  if (themeType === 'fish-cabin' || themeType === 'duck-lodge') {
    const plankCount = 24;
    const floorBg = '#1a120a';
    return (
      <View style={[styles.roomBackground, { backgroundColor: DARK_WOOD }]}>
        <View style={styles.wall3D}>
          {/* Warm amber point spotlight from top center */}
          <View style={styles.spotlight} pointerEvents="none" />
          {/* Vertical plank pattern */}
          <View style={styles.plankRow}>
            {Array.from({ length: plankCount }, (_, i) => (
              <WoodPlank key={i} index={i} total={plankCount} />
            ))}
          </View>
        </View>
        <View style={[styles.floor3D, { backgroundColor: floorBg }]}>
          <FloorWoodGrain />
          <View style={styles.floorShade} />
          <View style={styles.floorProps}>
            <View style={styles.woodenCrate}>
              <Text style={styles.crateText}>TH</Text>
            </View>
            <View style={styles.vaseReeds}>
              <View style={styles.reed} />
              <View style={[styles.reed, styles.reed2]} />
              <View style={[styles.reed, styles.reed3]} />
            </View>
          </View>
        </View>
      </View>
    );
  }
  if (isUnderwater) {
    return (
      <View style={[styles.roomBackground, { backgroundColor: '#0a3d5c' }]}>
        <View style={styles.underwaterWall3D}>
          <View style={[styles.waterRay, styles.waterRay1]} />
          <View style={[styles.waterRay, styles.waterRay2]} />
          <View style={[styles.waterRay, styles.waterRay3]} />
          <AnimatedBubbles />
        </View>
        <View style={styles.seabed3D} />
      </View>
    );
  }
  return null;
}

function WallSlotsView({
  themeMounts,
  themeType,
  themeId,
  catches,
  mountMode,
  selectedCatch,
  onPlaceInSlot,
  onEmptySlotPress,
  onFilledSlotPress,
}: {
  themeMounts: MountedFish[];
  themeType: ThemeType;
  themeId: string;
  catches: Catch[];
  mountMode: boolean;
  selectedCatch: Catch | null;
  onPlaceInSlot: (slotIndex: number) => void;
  onEmptySlotPress: () => void;
  onFilledSlotPress: (mount: MountedFish) => void;
}) {
  const isLodge = themeType === 'duck-lodge';
  const mountsBySlot = new Map<number, MountedFish>();
  const legacyMounts = themeMounts.filter((m) => m.slotIndex == null);
  const slotMounts = themeMounts.filter((m) => m.slotIndex != null);
  slotMounts.forEach((m) => mountsBySlot.set(m.slotIndex!, m));
  legacyMounts.forEach((m, i) => {
    if (i < 6 && !mountsBySlot.has(i)) mountsBySlot.set(i, m);
  });

  return (
    <View style={styles.wallSlotsContainer} pointerEvents="box-none">
      {WALL_SLOTS.map((slot, i) => {
        const mount = mountsBySlot.get(i);
        const catchData = mount ? catches.find((c) => c.id === mount.catchId) : null;
        if (mount && catchData) {
          return (
            <FilledFishFrame
              key={mount.id}
              mount={mount}
              catchData={catchData}
              slot={slot}
              themeType={themeType}
              onPress={() => onFilledSlotPress(mount)}
              style={{
                left: `${slot.left}%`,
                top: `${slot.top}%`,
                width: `${slot.width}%`,
                height: `${slot.height}%`,
              }}
              isLodge={isLodge}
            />
          );
        }
        return (
          <EmptySlotFrame
            key={`empty-${i}`}
            onPress={() => {
              if (mountMode && selectedCatch) onPlaceInSlot(i);
              else onEmptySlotPress();
            }}
            style={{
              left: `${slot.left}%`,
              top: `${slot.top}%`,
              width: `${slot.width}%`,
              height: `${slot.height}%`,
            }}
            isLodge={isLodge}
          />
        );
      })}
    </View>
  );
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

export default function TrophyRoomScreen() {
  const router = useRouter();
  const bottomPadding = useBottomSafePadding();
  const {
    themes,
    loaded,
    addMount,
    updateMount,
    removeMount,
    getMountsForTheme,
    updateTheme,
  } = useTrophyRoom();

  const [activeTheme, setActiveTheme] = useState<TrophyTheme | null>(null);

  useEffect(() => {
    if (loaded && themes.length > 0 && !activeTheme) {
      setActiveTheme(themes[0]);
    }
  }, [loaded, themes, activeTheme]);
  const [panX, setPanX] = useState(0);
  const panAnim = useRef(new Animated.Value(0)).current;
  const [tiltAngle, setTiltAngle] = useState(0);
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const [mountMode, setMountMode] = useState(false);
  const [selectedCatch, setSelectedCatch] = useState<Catch | null>(null);
  const [showLogbookPicker, setShowLogbookPicker] = useState(false);
  const [selectedMount, setSelectedMount] = useState<MountedFish | null>(null);
  const [showThemeSettings, setShowThemeSettings] = useState(false);

  const currentTheme = activeTheme ?? themes[0];
  const themeMounts = getMountsForTheme(currentTheme?.id ?? '');
  const mountsLeft = Math.max(0, MOUNT_LIMIT_PER_WEEK - themeMounts.length);

  const tiltRef = useRef(0);
  tiltRef.current = tiltAngle;
  const tiltResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dx }) => {
        const deg = Math.max(-MAX_TILT, Math.min(MAX_TILT, tiltRef.current + dx * 0.2));
        tiltAnim.setValue(deg);
      },
      onPanResponderRelease: (_, { dx }) => {
        const deg = Math.max(-MAX_TILT, Math.min(MAX_TILT, tiltRef.current + dx * 0.2));
        setTiltAngle(deg);
        Animated.spring(tiltAnim, {
          toValue: deg,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
      },
    })
  ).current;

  const handleNavLeft = () => {
    const next = Math.min(0, panX + SCREEN_WIDTH * 0.4);
    setPanX(next);
    Animated.spring(panAnim, {
      toValue: next,
      useNativeDriver: true,
      tension: 80,
      friction: 15,
    }).start();
  };

  const handleNavRight = () => {
    const next = Math.max(-ROOM_WIDTH + SCREEN_WIDTH, panX - SCREEN_WIDTH * 0.4);
    setPanX(next);
    Animated.spring(panAnim, {
      toValue: next,
      useNativeDriver: true,
      tension: 80,
      friction: 15,
    }).start();
  };

  const handleMountPress = () => {
    if (mountMode) return;
    setShowLogbookPicker(true);
  };

  const handleSelectFish = (c: Catch) => {
    setSelectedCatch(c);
    setShowLogbookPicker(false);
    setMountMode(true);
  };

  if (!loaded || !currentTheme) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const containerBg =
    currentTheme.themeType === 'underwater'
      ? { backgroundColor: '#0a2d45' }
      : { backgroundColor: DARK_WOOD };

  return (
    <SafeAreaView style={[styles.container, containerBg]} edges={['top']}>
      <ParticleBackground />
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => router.push('/(tabs)')}
        >
          <Ionicons name="home-outline" size={24} color="#2C3E50" />
        </TouchableOpacity>
        <View style={styles.mountsBadge}>
          <Text style={styles.mountsBadgeText} numberOfLines={1}>
            {mountsLeft}/5 left
          </Text>
        </View>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => setShowThemeSettings(true)}
        >
          <Feather name="settings" size={22} color={colors.lightText} />
        </TouchableOpacity>
      </View>

      {/* Room view */}
      <View style={styles.roomContainer}>
        <Animated.View
          style={[
            styles.roomInner,
            {
              width: ROOM_WIDTH,
              transform: [
                { perspective: 1200 },
                { translateX: panAnim },
                { rotateY: tiltAnim.interpolate({ inputRange: [-MAX_TILT, MAX_TILT], outputRange: ['-25deg', '25deg'] }) },
              ],
            },
          ]}
          {...(!mountMode ? tiltResponder.panHandlers : {})}
        >
          <ThemeBackground themeType={currentTheme.themeType} />
          {currentTheme.themeType === 'fish-cabin' || currentTheme.themeType === 'duck-lodge' ? (
            <WallSlotsView
              themeMounts={themeMounts}
              themeType={currentTheme.themeType}
              themeId={currentTheme.id}
              catches={mockCatches}
              mountMode={mountMode}
              selectedCatch={selectedCatch}
              onPlaceInSlot={(slotIndex) => {
                if (selectedCatch && currentTheme) {
                  const s = WALL_SLOTS[slotIndex];
                  const posX = (s.left + s.width / 2) / 100;
                  const posY = (s.top + s.height / 2) / 100;
                  addMount(currentTheme.id, selectedCatch.id, posX, posY, slotIndex);
                  setMountMode(false);
                  setSelectedCatch(null);
                }
              }}
              onEmptySlotPress={() => {
                if (selectedCatch) return;
                setShowLogbookPicker(true);
              }}
              onFilledSlotPress={(m) => setSelectedMount(m)}
            />
          ) : (
            <View style={styles.wallTapArea}>
              {themeMounts.map((m) => (
                <MountedFishView
                  key={m.id}
                  mount={m}
                  catches={mockCatches}
                  themeType={currentTheme.themeType}
                  onPress={() => setSelectedMount(m)}
                />
              ))}
            </View>
          )}
        </Animated.View>
      </View>

      {/* Nav arrows */}
      <TouchableOpacity style={styles.navLeft} onPress={handleNavLeft}>
        <Feather name="chevron-left" size={32} color={colors.lightText} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.navRight} onPress={handleNavRight}>
        <Feather name="chevron-right" size={32} color="#2C3E50" />
      </TouchableOpacity>

      {/* Bottom buttons - Mount + Plus */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={styles.mountButtonOrange}
          onPress={handleMountPress}
          activeOpacity={0.85}
        >
          <Feather name="target" size={20} color="#FFFFFF" />
          <Text style={styles.mountButtonOrangeText}>Mount</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.plusButtonBlue}
          onPress={handleMountPress}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Theme switcher - fish → pool → */}
      <View style={styles.themeSwitcher}>
        {themes.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[
              styles.themePill,
              currentTheme.id === t.id && styles.themePillActive,
            ]}
            onPress={() => setActiveTheme(t)}
          >
            <Text
              style={[
                styles.themePillText,
                currentTheme.id === t.id && styles.themePillTextActive,
              ]}
            >
              {t.name} →
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Place mode hint */}
      {mountMode && (
        <View style={styles.placeHint}>
          <Text style={styles.placeHintText}>
            Tap an empty slot to place {selectedCatch?.species}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setMountMode(false);
              setSelectedCatch(null);
            }}
            style={styles.placeHintCancel}
          >
            <Text style={styles.placeHintCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Logbook Picker Modal */}
      <Modal
        visible={showLogbookPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLogbookPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pick a fish to mount</Text>
            <TouchableOpacity onPress={() => setShowLogbookPicker(false)}>
              <Feather name="x" size={26} color={colors.lightText} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={[styles.logbookGrid, { paddingBottom: bottomPadding }]}
            showsVerticalScrollIndicator={false}
          >
            {mockCatches.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.logbookCard}
                onPress={() => handleSelectFish(c)}
                activeOpacity={0.8}
              >
                {isValidImageUri(c.photoNoBg || c.photo) ? (
                  <Image
                    source={{ uri: c.photoNoBg || c.photo }}
                    style={styles.logbookThumb}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.logbookThumb, { backgroundColor: colors.lightBorder, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="fish" size={28} color={colors.lightSubtext} />
                  </View>
                )}
                <Text style={styles.logbookSpecies} numberOfLines={1}>
                  {c.species}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Mount Detail Modal */}
      <Modal
        visible={!!selectedMount}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMount(null)}
      >
        {selectedMount && (
          <MountDetailModal
            mount={selectedMount}
            catches={mockCatches}
            onClose={() => setSelectedMount(null)}
            onUpdate={(updates) => updateMount(selectedMount.id, updates)}
            onDelete={() => {
              removeMount(selectedMount.id);
              setSelectedMount(null);
            }}
          />
        )}
      </Modal>

      {/* Theme Settings Modal */}
      <Modal
        visible={showThemeSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowThemeSettings(false)}
      >
        <ThemeSettingsModal
          themes={themes}
          onUpdateTheme={updateTheme}
          onClose={() => setShowThemeSettings(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

function MountedFishView({
  mount,
  catches,
  onPress,
  themeType,
}: {
  mount: MountedFish;
  catches: Catch[];
  onPress: () => void;
  themeType: ThemeType;
}) {
  const c = catches.find((x) => x.id === mount.catchId);
  if (!c) return null;

  const fishImg = c.photo;
  const size = 80 * mount.scale;
  const h = size * 1.2;
  const plaqueW = size * 1.15;
  const plaqueH = h * 1.2;

  return (
    <TouchableOpacity
      style={[
        styles.mountedFish,
        {
          left: `${mount.positionX * 100}%`,
          top: `${mount.positionY * 100}%`,
          width: plaqueW,
          height: plaqueH,
          marginLeft: -plaqueW / 2,
          marginTop: -plaqueH / 2,
        },
      ]}
      onPress={onPress}
      activeOpacity={1}
    >
      <View
        style={[
          styles.mountPlaque,
          {
            width: plaqueW,
            height: plaqueH,
            borderColor: themeType === 'underwater' ? 'rgba(255,255,255,0.15)' : '#5D4E37',
          },
        ]}
      />
      <View style={[styles.mountInnerShadow, { width: plaqueW, height: plaqueH }]} />
      <View
        style={[
          styles.fishMountShadow,
          {
            width: size * 0.9,
            height: h * 0.3,
            bottom: -plaqueH * 0.08,
          },
        ]}
      />
      {isValidImageUri(fishImg) ? (
        <Image
          source={{ uri: fishImg }}
          style={[
            styles.fishImageRealistic,
            {
              width: size,
              height: h,
              transform: [{ scaleX: mount.rotation === 180 ? -1 : 1 }],
            },
          ]}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.fishImageRealistic, { width: size, height: h, backgroundColor: colors.lightBorder, justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="fish" size={40} color={colors.lightSubtext} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function MountDetailModal({
  mount,
  catches,
  onClose,
  onUpdate,
  onDelete,
}: {
  mount: MountedFish;
  catches: Catch[];
  onClose: () => void;
  onUpdate: (u: Partial<MountedFish>) => void;
  onDelete: () => void;
}) {
  const c = catches.find((x) => x.id === mount.catchId);
  const [scale, setScale] = useState(mount.scale);
  const [rotation, setRotation] = useState(mount.rotation);
  const bottomPadding = useBottomSafePadding();

  if (!c) return null;

  const handleSave = () => {
    onUpdate({ scale, rotation });
    onClose();
  };

  return (
    <SafeAreaView style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onClose}>
          <Feather name="x" size={26} color={colors.lightText} />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>{c.species}</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveText}>Done</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: bottomPadding }]}>
        {isValidImageUri(c.photoOriginal || c.photo) ? (
          <Image
            source={{ uri: c.photoOriginal || c.photo }}
            style={styles.detailImage}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.detailImage, { backgroundColor: colors.lightBorder, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="fish" size={48} color={colors.lightSubtext} />
          </View>
        )}
        <Text style={styles.detailWeight}>{c.weight} lbs • {c.length}"</Text>
        <View style={styles.controls}>
          <Text style={styles.controlLabel}>Size</Text>
          <View style={styles.sliderRow}>
            <TouchableOpacity
              onPress={() => {
                const next = Math.max(0.5, scale - 0.1);
                setScale(next);
                onUpdate({ scale: next });
              }}
            >
              <Feather name="minus" size={24} color={BRIGHT_BLUE} />
            </TouchableOpacity>
            <Text style={styles.sliderValue}>{scale.toFixed(1)}x</Text>
            <TouchableOpacity
              onPress={() => {
                const next = Math.min(2, scale + 0.1);
                setScale(next);
                onUpdate({ scale: next });
              }}
            >
              <Feather name="plus" size={24} color={BRIGHT_BLUE} />
            </TouchableOpacity>
          </View>
          <Text style={styles.controlLabel}>Direction</Text>
          <TouchableOpacity
            style={styles.rotateBtn}
            onPress={() => {
              const next = rotation === 0 ? 180 : 0;
              setRotation(next);
              onUpdate({ rotation: next });
            }}
          >
            <Feather name="rotate-cw" size={20} color={colors.lightText} />
            <Text style={styles.rotateBtnText}>
              Rotate fish {rotation === 0 ? 'left' : 'right'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Feather name="trash-2" size={20} color="#FFFFFF" />
          <Text style={styles.deleteBtnText}>Remove from wall</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ThemeSettingsModal({
  themes,
  onUpdateTheme,
  onClose,
}: {
  themes: TrophyTheme[];
  onUpdateTheme: (id: string, u: Partial<TrophyTheme>) => void;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const bottomPadding = useBottomSafePadding();

  return (
    <SafeAreaView style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onClose}>
          <Feather name="x" size={26} color={colors.lightText} />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Theme Settings</Text>
        <View style={{ width: 26 }} />
      </View>
      <KeyboardAvoidingView
        style={styles.themeSettingsKeyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView contentContainerStyle={[styles.settingsContent, { paddingBottom: bottomPadding }]}>
        {themes.map((t) => (
          <View key={t.id} style={styles.themeSettingRow}>
            {editingId === t.id ? (
              <View style={styles.themeNameEdit}>
                <TextInput
                  style={styles.themeNameInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Theme name"
                  placeholderTextColor={colors.lightSubtext}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (editName.trim()) onUpdateTheme(t.id, { name: editName.trim() });
                    setEditingId(null);
                  }}
                >
                  <Feather name="check" size={22} color={BRIGHT_BLUE} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.themeNameDisplay}
                onPress={() => {
                  setEditName(t.name);
                  setEditingId(t.id);
                }}
              >
                <Text style={styles.themeNameText}>{t.name}</Text>
                <Feather name="edit-2" size={16} color={colors.lightSubtext} />
              </TouchableOpacity>
            )}
            <View style={styles.publicToggleRow}>
              <Text style={styles.publicLabel}>Public</Text>
              <TouchableOpacity
                style={[styles.toggle, t.isPublic && styles.toggleOn]}
                onPress={() => onUpdateTheme(t.id, { isPublic: !t.isPublic })}
              >
                <View style={[styles.toggleKnob, t.isPublic && styles.toggleKnobOn]} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_WOOD,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.lightSubtext,
    fontSize: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(180,180,180,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mountsBadge: {
    backgroundColor: 'rgba(180,180,180,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mountsBadgeText: {
    color: '#2C3E50',
    fontSize: 14,
    fontWeight: '600',
  },
  roomContainer: {
    flex: 1,
    overflow: 'hidden',
    transform: [{ perspective: 1000 }],
  },
  roomInner: {
    height: '100%',
    position: 'relative',
  },
  roomBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  woodPlank: {
    height: '100%',
    minWidth: 1,
  },
  plankRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  spotlight: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: '75%',
    backgroundColor: 'rgba(255, 160, 60, 0.22)',
    borderBottomLeftRadius: 300,
    borderBottomRightRadius: 300,
  },
  woodenFrame: {
    position: 'absolute',
    backgroundColor: '#5D4E37',
    borderWidth: 6,
    borderColor: '#4A3728',
    borderRadius: 4,
    padding: 4,
    borderRadius: 4,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  frameDark: {
    backgroundColor: '#4A3728',
    borderColor: '#3D2918',
  },
  woodenFrameInner: {
    flex: 1,
    backgroundColor: '#2A1F14',
    borderRadius: 2,
    overflow: 'hidden',
  },
  frameMat: {
    flex: 1,
    backgroundColor: '#3D2F1F',
    margin: 6,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  frameEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  frameSpecies: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 4,
  },
  ghostFrame: {
    opacity: 0.6,
    borderStyle: 'dashed',
  },
  ghostFrameInner: {
    backgroundColor: 'rgba(42, 31, 20, 0.5)',
  },
  ghostMat: {
    backgroundColor: 'rgba(61, 47, 31, 0.4)',
  },
  ghostPlusIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fishInFrame: {
    width: 56,
    height: 42,
    marginBottom: 4,
  },
  wallSlotsContainer: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: '45%',
  },
  floorGrainContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  floorGrainLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  wall3D: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '68%',
    overflow: 'hidden',
  },
  floor3D: {
    position: 'absolute',
    bottom: 0,
    left: -40,
    right: -40,
    height: '45%',
    transform: [{ perspective: 400 }, { rotateX: '12deg' }],
  },
  floorShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  floorProps: {
    position: 'absolute',
    bottom: '8%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: '8%',
  },
  woodenCrate: {
    width: 56,
    height: 36,
    backgroundColor: '#5D4E37',
    borderRadius: 2,
    borderWidth: 2,
    borderColor: '#4A3728',
  },
  vaseReeds: {
    width: 28,
    height: 52,
    backgroundColor: '#3d2f1f',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    overflow: 'visible',
  },
  reed: {
    position: 'absolute',
    top: -18,
    left: 4,
    width: 3,
    height: 24,
    backgroundColor: '#4a3728',
    borderRadius: 1,
  },
  reed2: { left: 10 },
  reed3: { left: 16 },
  crateText: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.4)',
  },
  underwaterWall3D: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0e3d5c',
  },
  seabed3D: {
    position: 'absolute',
    bottom: 0,
    left: -40,
    right: -40,
    height: '40%',
    backgroundColor: '#1a4d3a',
    transform: [{ perspective: 300 }, { rotateX: '10deg' }],
  },
  lightRaysDown: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: 'transparent',
  },
  waterRay: {
    position: 'absolute',
    top: 0,
    width: 60,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  waterRay1: { left: '15%' },
  waterRay2: { left: '42%' },
  waterRay3: { left: '70%' },
  bubble: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.5)',
    ...Platform.select({
      ios: { shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  wallTapArea: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: '40%',
  },
  placeOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 80,
    bottom: 120,
  },
  mountedFish: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mountPlaque: {
    position: 'absolute',
    backgroundColor: 'rgba(60, 45, 30, 0.95)',
    borderWidth: 3,
    borderRadius: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
      },
      android: { elevation: 8 },
    }),
  },
  mountInnerShadow: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
  },
  fishMountShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 4,
    transform: [{ skewY: '8deg' }],
  },
  fishImageRealistic: {
    position: 'relative',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: { elevation: 4 },
    }),
  },
  navLeft: {
    position: 'absolute',
    left: 8,
    top: '45%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(180,180,180,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navRight: {
    position: 'absolute',
    right: 8,
    top: '45%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomButtons: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  mountButtonOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E67E22',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  mountButtonOrangeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  plusButtonBlue: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: BRIGHT_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: BRIGHT_BLUE, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  themeSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
    flexWrap: 'wrap',
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(180,180,180,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
  },
  themePillActive: {
    backgroundColor: 'rgba(0,102,255,0.25)',
    borderWidth: 1,
    borderColor: BRIGHT_BLUE,
  },
  themePillText: {
    color: '#2C3E50',
    fontSize: 14,
    fontWeight: '600',
  },
  themePillTextActive: {
    color: BRIGHT_BLUE,
  },
  placeHint: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeHintText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  placeHintCancel: {
    padding: 8,
  },
  placeHintCancelText: {
    color: BRIGHT_BLUE,
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  themeSettingsKeyboardWrap: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRIGHT_BLUE,
  },
  logbookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  logbookCard: {
    width: '47%',
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  logbookThumb: {
    width: '100%',
    height: 120,
    backgroundColor: '#0a0a0a',
  },
  logbookSpecies: {
    padding: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.lightText,
  },
  detailContent: {
    padding: 16,
    paddingBottom: 40,
  },
  detailImage: {
    width: '100%',
    height: 280,
    borderRadius: 14,
    backgroundColor: '#0a0a0a',
    marginBottom: 16,
  },
  detailWeight: {
    fontSize: 16,
    color: colors.lightSubtext,
    marginBottom: 24,
  },
  controls: {
    marginBottom: 24,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.lightText,
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightText,
  },
  rotateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.lightCardBlue,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  rotateBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightText,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 12,
  },
  deleteBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsContent: {
    padding: 16,
  },
  themeSettingRow: {
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  themeNameDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  themeNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightText,
  },
  themeNameEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  themeNameInput: {
    flex: 1,
    fontSize: 16,
    color: colors.lightText,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.lightCardBlue,
    borderRadius: 10,
  },
  publicToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  publicLabel: {
    fontSize: 14,
    color: colors.lightSubtext,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.lightBorder,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: BRIGHT_BLUE,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobOn: {
    marginLeft: 20,
  },
});
