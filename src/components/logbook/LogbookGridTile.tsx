/**
 * LogbookGridTile — 9:16 aspect ratio tile for 3-column grid.
 * Shows fish name (from passport), weight, rarity label badge.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ImageSourcePropType, Dimensions } from 'react-native';
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

function getPassportInfo(speciesRaw?: string): { name: string; rarity: string } {
  if (!speciesRaw) return { name: 'Unknown', rarity: 'common' };
  const id = findPassportSpeciesId(speciesRaw);
  const entry = id ? PASSPORT_SPECIES.find((s) => s.id === id) : null;
  return {
    name: entry?.name ?? speciesRaw,
    rarity: entry?.rarity ?? 'common',
  };
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

  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
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
