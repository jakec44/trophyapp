/**
 * LogbookGridTile — 9:16 aspect ratio tile for 3-column grid.
 * Shows fish name (from passport), weight, rarity label badge.
 * Bass 6+ lbs: golden animated glowing border with floating gold dust.
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ImageSourcePropType, Dimensions, Platform, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Catch } from '@/utils/mockData';
import { isValidImageUri } from '@/src/lib/imageUri';
import { findPassportSpeciesId } from '@/src/lib/speciesMapper';
import { SPECIES_EXAMPLE_IMAGES } from '@/src/constants/speciesExampleImages';
import { PASSPORT_SPECIES } from '@/utils/gamificationData';

function getRarityColor(rarity?: string): string {
  switch (rarity) {
    case 'uncommon':  return '#4ade80';
    case 'rare':      return '#60a5fa';
    case 'epic':      return '#c084fc';
    case 'legendary': return '#fbbf24';
    case 'mythic':    return '#ff6b2b';
    default:          return '#9ca3af';
  }
}

/** Glow by rarity: common = none, uncommon = green, rare = blue, epic = purple, legendary/mythic = super glow */
function getGlowStyle(rarity: string, color: string): {
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
  borderWidth?: number;
  borderColor?: string;
} {
  if (rarity === 'common') return {};
  const isSuperGlow = rarity === 'legendary' || rarity === 'mythic';
  if (Platform.OS === 'ios') {
    return {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: isSuperGlow ? 0.85 : (rarity === 'uncommon' ? 0.5 : 0.65),
      shadowRadius: isSuperGlow ? 16 : (rarity === 'uncommon' ? 6 : rarity === 'rare' ? 8 : 10),
    };
  }
  // Android: use colored border as glow (elevation doesn't support color)
  return {
    elevation: isSuperGlow ? 12 : (rarity === 'uncommon' ? 4 : rarity === 'rare' ? 6 : 8),
    borderWidth: isSuperGlow ? 2.5 : 1.5,
    borderColor: isSuperGlow ? color : color + '99',
  };
}

function getPassportInfo(speciesRaw?: string): { name: string; rarity: string } {
  if (!speciesRaw) return { name: 'Unknown', rarity: 'common' };
  const id = findPassportSpeciesId(speciesRaw);
  const entry = id ? PASSPORT_SPECIES.find((s) => s.id === id) : null;
  return {
    name: entry?.name ?? speciesRaw,
    rarity: entry?.rarity ?? 'common',
  };
}

function isBassSixPlus(c: Catch): boolean {
  const species = (c.species ?? '').toLowerCase();
  const isBass = species.includes('bass');
  return isBass && c.weight >= 6;
}

/** Scatter position in border band (0-1 along perimeter, 0-1 depth from edge) */
function scatterPos(i: number, n: number) {
  const a = ((i * 17 + 7) % n) / n;
  const b = ((i * 13 + 3) % n) / n;
  return { along: a, depth: 0.15 + b * 0.25 };
}

/** Animated golden border + rising gold dust for bass 6+ lbs */
function GoldenBassBorderOverlay() {
  const DUST_COUNT = 38;
  const dustY = useRef(
    Array.from({ length: DUST_COUNT }, () => new Animated.Value(0))
  ).current;
  const dustOp = useRef(
    Array.from({ length: DUST_COUNT }, () => new Animated.Value(0.25))
  ).current;

  useEffect(() => {
    const dur = 2200;
    const loops = dustY.map((y, i) => {
      const delay = (i * 97) % 800;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(y, {
              toValue: 1,
              duration: dur,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(dustOp[i], {
                toValue: 0.9,
                duration: dur * 0.15,
                useNativeDriver: true,
              }),
              Animated.timing(dustOp[i], {
                toValue: 0.1,
                duration: dur * 0.85,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.timing(dustOp[i], { toValue: 0.25, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dustY, dustOp]);

  const dustData = Array.from({ length: DUST_COUNT }, (_, i) => {
    const { along, depth } = scatterPos(i, DUST_COUNT);
    const sizeVariant = i % 3;
    const sz = sizeVariant === 0 ? 1.5 : sizeVariant === 1 ? 2.5 : 3;
    if (along < 0.25) return { left: `${(along / 0.25) * 92 + 4}%`, bottom: `${depth * 10}%`, size: sz };
    if (along < 0.5) return { right: `${depth * 10}%`, top: `${((along - 0.25) / 0.25) * 92 + 4}%`, size: sz };
    if (along < 0.75) return { top: `${depth * 10}%`, left: `${((along - 0.5) / 0.25) * 92 + 4}%`, size: sz };
    return { left: `${depth * 10}%`, top: `${((along - 0.75) / 0.25) * 92 + 4}%`, size: sz };
  });

  return (
    <View pointerEvents="none" style={goldenStyles.overlay}>
      <View style={goldenStyles.innerShine} pointerEvents="none" />
      {dustData.map((d, i) => {
        const yInterp = dustY[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, 20],
        });
        const size = d.size;
        const isLarge = size >= 2.5;
        return (
          <Animated.View
            key={i}
            style={[
              goldenStyles.dust,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: isLarge ? 0.5 : 0,
                borderColor: isLarge ? 'rgba(255,248,220,0.6)' : undefined,
                left: 'left' in d ? d.left : undefined,
                right: 'right' in d ? d.right : undefined,
                top: 'top' in d ? d.top : undefined,
                bottom: 'bottom' in d ? d.bottom : undefined,
                opacity: dustOp[i],
                transform: [{ translateY: Animated.multiply(yInterp, -1) }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const GAP = 7;
const H_PADDING = 16;
const COLS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_WIDTH = Math.floor((SCREEN_WIDTH - H_PADDING * 2 - GAP * (COLS - 1)) / COLS);
const TILE_HEIGHT = Math.floor(TILE_WIDTH * (16 / 9));

interface LogbookGridTileProps {
  catchItem: Catch;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

function getImageSource(c: Catch): { uri: string } | ImageSourcePropType | null {
  if (c.photo && isValidImageUri(c.photo)) return { uri: c.photo };
  const speciesId = findPassportSpeciesId(c.species);
  const img = speciesId && SPECIES_EXAMPLE_IMAGES[speciesId];
  if (img !== undefined) return typeof img === 'number' ? img : { uri: img as string };
  return null;
}

export function LogbookGridTile({
  catchItem,
  onPress,
  isFavorite,
  onToggleFavorite,
}: LogbookGridTileProps) {
  const [imgError, setImgError] = useState(false);
  const imageSource = getImageSource(catchItem);
  const showImage = imageSource && !imgError;

  const { name: passportName, rarity } = getPassportInfo(catchItem.species);
  const rarityColor = getRarityColor(rarity);
  const rarityLabel = rarity.charAt(0).toUpperCase() + rarity.slice(1);
  const displayName = (catchItem.name ?? passportName).trim() || passportName;
  const glowStyle = getGlowStyle(rarity, rarityColor);

  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.imageContainer, glowStyle]}>
        {showImage ? (
          <Image
            source={imageSource as ImageSourcePropType}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="fish" size={32} color="rgba(255,255,255,0.5)" />
          </View>
        )}

        {/* Rarity badge — top left */}
        <View style={[styles.rarityBadge, { borderColor: rarityColor + 'cc' }]}>
          <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
          <Text style={[styles.rarityText, { color: rarityColor }]}>{rarityLabel}</Text>
        </View>

        {isFavorite && onToggleFavorite && (
          <TouchableOpacity
            style={styles.favBtn}
            onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          >
            <Ionicons name="heart" size={16} color="#F5A623" />
          </TouchableOpacity>
        )}

        <LinearGradient
          colors={[
            'rgba(0,0,0,0)',
            'rgba(0,0,0,0.08)',
            'rgba(0,0,0,0.45)',
            'rgba(0,0,0,0.82)',
          ]}
          locations={[0, 0.35, 0.65, 1]}
          style={styles.bottomOverlay}
        >
          <Text style={styles.speciesOverlay} numberOfLines={1}>{displayName}</Text>
          {(catchItem.weight > 0 || catchItem.length > 0) && (
            <Text style={styles.metaOverlay}>
              {catchItem.weight > 0 ? `${catchItem.weight} lbs` : null}
              {catchItem.weight > 0 && catchItem.length > 0 ? ' · ' : null}
              {catchItem.length > 0 ? `${catchItem.length}"` : null}
            </Text>
          )}
        </LinearGradient>

        {isBassSixPlus(catchItem) && <GoldenBassBorderOverlay />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    margin: GAP / 2,
  },
  imageContainer: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1E5F8C',
    position: 'relative',
  },
  rarityBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  rarityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rarityText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 4,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    justifyContent: 'flex-end',
    paddingHorizontal: 7,
    paddingBottom: 8,
  },
  speciesOverlay: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  metaOverlay: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

const GOLD_DARK = '#B8860B';
const GOLD_MAIN = '#FFD700';
const GOLD_BRIGHT = '#FFF8DC';
const goldenStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: GOLD_DARK,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'ios' && {
      shadowColor: GOLD_MAIN,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 8,
    }),
  },
  innerShine: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: GOLD_BRIGHT,
  },
  dust: {
    position: 'absolute',
    backgroundColor: GOLD_BRIGHT,
    ...(Platform.OS === 'ios' && {
      shadowColor: GOLD_MAIN,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 2,
    }),
  },
});
