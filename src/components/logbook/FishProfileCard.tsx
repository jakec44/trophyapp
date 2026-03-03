/**
 * FishProfileCard — collectible-style card for logbook
 * Supports vertical/horizontal images, example fallback, Share, Favorite
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
  Dimensions,
  ActionSheetIOS,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import type { Catch } from '@/utils/mockData';
import { SPECIES_EXAMPLE_IMAGES } from '@/src/constants/speciesExampleImages';
import { PASSPORT_SPECIES } from '@/utils/gamificationData';
import { isValidImageUri } from '@/src/lib/imageUri';

const GOLD = colors.gold;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 16;
const CARD_WIDTH = SCREEN_WIDTH - CARD_PADDING * 2;
const CARD_IMAGE_MAX_HEIGHT = 280;
const CARD_IMAGE_ASPECT_RATIOS = { min: 0.75, max: 1.5 };

function findPassportId(species: string): string | null {
  const lower = (species || '').toLowerCase().trim();
  if (!lower) return null;
  for (const s of PASSPORT_SPECIES) {
    const nameLower = s.name.toLowerCase();
    if (nameLower.includes(lower) || lower.includes(nameLower.split(' ')[0])) {
      return s.id;
    }
  }
  return null;
}

function getImageSource(c: Catch): { uri: string } | number {
  if (c.photo) return { uri: c.photo };
  const id = findPassportId(c.species);
  const img = id && SPECIES_EXAMPLE_IMAGES[id];
  if (img !== undefined) return typeof img === 'number' ? img : { uri: img };
  return { uri: `https://picsum.photos/seed/${c.id}/400/300` };
}

interface FishProfileCardProps {
  catchItem: Catch;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPress?: () => void;
  compact?: boolean;
}

export function FishProfileCard({
  catchItem,
  isFavorite,
  onToggleFavorite,
  onPress,
  compact = false,
}: FishProfileCardProps) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const imageSource = getImageSource(catchItem);
  const showImage = !imgError;

  const handleShare = () => {
    const shareText = `${catchItem.name || catchItem.species} — ${catchItem.weight} lbs, ${catchItem.length}" | ${catchItem.location} | ${new Date(catchItem.date).toLocaleDateString()}`;
    const message = `Check out my catch! ${shareText}`;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Send to Friends', 'Share to Apps'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) {
            router.push('/(tabs)/friends');
          } else if (idx === 2) {
            Share.share({ message, title: catchItem.species }).catch(() => {});
          }
        }
      );
    } else {
      Alert.alert(
        'Share',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send to Friends', onPress: () => router.push('/(tabs)/friends') },
          { text: 'Share to Apps', onPress: () => Share.share({ message, title: catchItem.species }).catch(() => {}) },
        ]
      );
    }
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.cardCompact}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <View style={styles.imageWrapCompact}>
          {showImage ? (
            <Image
              source={imageSource}
              style={styles.imageCompact}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.placeholderCompact}>
              <Text style={styles.placeholderLetter}>
                {(catchItem.species || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.favBtnCompact}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? GOLD : '#FFF'}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.infoCompact}>
          <Text style={styles.speciesCompact} numberOfLines={1}>
            {catchItem.name || catchItem.species}
          </Text>
          <Text style={styles.metaCompact}>
            {catchItem.weight} lbs · {new Date(catchItem.date).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.shareBtnCompact}
          onPress={(e) => {
            e.stopPropagation();
            handleShare();
          }}
        >
          <Ionicons name="share-outline" size={20} color={colors.accentBlue} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        {showImage ? (
          <Image
            source={imageSource}
            style={styles.image}
            resizeMode="contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderLetter}>
              {(catchItem.species || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.species} numberOfLines={1}>
            {catchItem.name || catchItem.species}
          </Text>
          <Text style={styles.meta}>
            {catchItem.weight} lbs · {catchItem.length}" · {new Date(catchItem.date).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? GOLD : colors.lightSubtext}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation();
              handleShare();
            }}
          >
            <Ionicons name="share-outline" size={24} color={colors.accentBlue} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignSelf: 'center',
    backgroundColor: colors.lightCard,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: CARD_IMAGE_MAX_HEIGHT,
    backgroundColor: colors.lightBorder,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#1E5F8C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderLetter: {
    fontSize: 48,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  footerLeft: { flex: 1, minWidth: 0 },
  species: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.lightText,
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: colors.lightSubtext,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
  },
  cardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightCard,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  imageWrapCompact: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.lightBorder,
  },
  imageCompact: {
    width: '100%',
    height: '100%',
  },
  placeholderCompact: {
    flex: 1,
    backgroundColor: '#1E5F8C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favBtnCompact: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 4,
  },
  infoCompact: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  speciesCompact: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.lightText,
    marginBottom: 4,
  },
  metaCompact: {
    fontSize: 13,
    color: colors.lightSubtext,
  },
  shareBtnCompact: {
    padding: 8,
  },
});
