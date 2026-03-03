/**
 * CatchCard — tapping a tile opens a bottom-sheet stats card.
 *   • All fields (name, species, weight, length, location, notes) are editable.
 *   • Tapping the hero image opens a full-screen viewer.
 *   • Save persists changes to Supabase via updateCatch.
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogbookGridTile } from './LogbookGridTile';
import type { Catch } from '@/utils/mockData';
import { isValidImageUri } from '@/src/lib/imageUri';
import { findPassportSpeciesId } from '@/src/lib/speciesMapper';
import { PASSPORT_SPECIES } from '@/utils/gamificationData';
import { updateCatch, deleteCatch } from '@/src/lib/supabase';

const { width: SW, height: SH } = Dimensions.get('window');

// ── rarity helpers ──────────────────────────────────────────────────────────
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

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── types ───────────────────────────────────────────────────────────────────
interface CatchCardProps {
  catchItem: Catch;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onUpdate?: (updated: Partial<Catch>) => void;
  onDelete?: () => void;
}

// ── component ───────────────────────────────────────────────────────────────
export function CatchCard({ catchItem, isFavorite, onToggleFavorite, onUpdate, onDelete }: CatchCardProps) {
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fullOpen,  setFullOpen]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  // editable field state
  const [name,     setName]     = useState(catchItem.name ?? '');
  const [species,  setSpecies]  = useState(catchItem.species ?? '');
  const [weight,   setWeight]   = useState(catchItem.weight > 0 ? String(catchItem.weight) : '');
  const [length,   setLength]   = useState(catchItem.length > 0 ? String(catchItem.length) : '');
  const [location, setLocation] = useState(catchItem.location ?? '');
  const [notes,    setNotes]    = useState(catchItem.notes ?? '');

  // Reset fields when opening
  useEffect(() => {
    if (sheetOpen) {
      setName(catchItem.name ?? '');
      setSpecies(catchItem.species ?? '');
      setWeight(catchItem.weight > 0 ? String(catchItem.weight) : '');
      setLength(catchItem.length > 0 ? String(catchItem.length) : '');
      setLocation(catchItem.location ?? '');
      setNotes(catchItem.notes ?? '');
    }
  }, [sheetOpen, catchItem]);

  const { name: passportName, rarity } = getPassportInfo(species || catchItem.species);
  const rarityColor = getRarityColor(rarity);
  const rarityLabel = rarity.charAt(0).toUpperCase() + rarity.slice(1);
  const hasPhoto    = isValidImageUri(catchItem.photo);
  const displayName = name.trim() || passportName;

  // iOS only allows one Modal at a time — close the sheet first, then open full screen
  const handleHeroPress = () => {
    if (!hasPhoto) return;
    setSheetOpen(false);
    setTimeout(() => setFullOpen(true), 350);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        species:       species.trim()  || catchItem.species,
        weight_lb:     parseFloat(weight)  || 0,
        length_in:     parseFloat(length)  || 0,
        location:      location.trim(),
        notes:         notes.trim(),
        fish_nickname: name.trim() || null,
      };

      await updateCatch(catchItem.id, updates);
      onUpdate?.({
        name:     name.trim() || undefined,
        species:  (species.trim() || catchItem.species) as string,
        weight:   parseFloat(weight) || 0,
        length:   parseFloat(length) || 0,
        location: location.trim(),
        notes:    notes.trim(),
      });
      setSheetOpen(false);
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Log',
      'Are you sure? This catch will be permanently removed. If this was your only catch of this species, it will also be removed from your Passport.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteCatch(catchItem.id);
              setSheetOpen(false);
              onDelete?.();
            } catch {
              Alert.alert('Error', 'Could not delete this catch. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      {/* ── grid tile ──────────────────────────────────────────────────────── */}
      <LogbookGridTile
        catchItem={catchItem}
        onPress={() => setSheetOpen(true)}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />

      {/* ── stats / edit bottom sheet ──────────────────────────────────────── */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSheetOpen(false)}
      >
        {/* tap above sheet to dismiss */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setSheetOpen(false)}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetOuter}
          pointerEvents="box-none"
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>

            {/* drag handle */}
            <View style={styles.handle} />

            {/* header row */}
            <View style={styles.headerRow}>
              <View>
                <View
                  style={[
                    styles.rarityBadge,
                    { backgroundColor: rarityColor + '22', borderColor: rarityColor + '70' },
                  ]}
                >
                  <Text style={[styles.rarityText, { color: rarityColor }]}>{rarityLabel}</Text>
                </View>
              </View>
              {onToggleFavorite && (
                <TouchableOpacity
                  style={[styles.favoriteBtn, isFavorite && styles.favoriteBtnActive]}
                  onPress={onToggleFavorite}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={16}
                    color={isFavorite ? '#F5A623' : 'rgba(255,255,255,0.8)'}
                  />
                  <Text
                    style={[
                      styles.favoriteBtnText,
                      isFavorite && styles.favoriteBtnTextActive,
                    ]}
                  >
                    Favorite
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setSheetOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {/* ── hero image (tap → fullscreen) ── */}
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleHeroPress}
                style={styles.heroWrap}
              >
                {hasPhoto ? (
                  <>
                    <Image
                      source={{ uri: catchItem.photo }}
                      style={styles.heroImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.35)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.expandHint}>
                      <Ionicons name="expand-outline" size={18} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.expandText}>Full screen</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.noPhoto}>
                    <Ionicons name="fish-outline" size={64} color="rgba(255,255,255,0.2)" />
                    <Text style={styles.noPhotoText}>No photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* ── editable fields ── */}
              <View style={styles.fields}>
                <Field
                  label="Name / Nickname"
                  value={name}
                  onChangeText={setName}
                  placeholder={passportName}
                />
                <Field
                  label="Species"
                  value={species}
                  onChangeText={setSpecies}
                  placeholder="e.g. Largemouth Bass"
                />

                <View style={styles.row2}>
                  <View style={styles.half}>
                    <Field
                      label="Weight (lbs)"
                      value={weight}
                      onChangeText={setWeight}
                      placeholder="0"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.half}>
                    <Field
                      label='Length (in)"'
                      value={length}
                      onChangeText={setLength}
                      placeholder="0"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <Field
                  label="Location"
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Where was it caught?"
                />

                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.35)" />
                  <Text style={styles.metaText}>{formatDate(catchItem.date)}</Text>
                </View>

                <Field
                  label="Notes"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any notes..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* ── save button ── */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>

              {/* ── delete button ── */}
              {onDelete && (
                <TouchableOpacity
                  style={[styles.deleteBtn, deleting && styles.saveBtnDisabled]}
                  onPress={handleDelete}
                  activeOpacity={0.85}
                  disabled={deleting || saving}
                >
                  {deleting ? (
                    <ActivityIndicator color="#ff4d4d" size="small" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={15} color="#ff4d4d" />
                      <Text style={styles.deleteBtnText}>Delete Log</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── full-screen image viewer ────────────────────────────────────────── */}
      <Modal
        visible={fullOpen}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { setFullOpen(false); setTimeout(() => setSheetOpen(true), 300); }}
      >
        <TouchableOpacity
          style={styles.fullScreen}
          activeOpacity={1}
          onPress={() => { setFullOpen(false); setTimeout(() => setSheetOpen(true), 300); }}
        >
          {hasPhoto && (
            <Image
              source={{ uri: catchItem.photo }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
          <View style={[styles.fullCloseWrap, { top: (Platform.OS === 'ios' ? 54 : 32) }]}>
            <TouchableOpacity
              onPress={() => { setFullOpen(false); setTimeout(() => setSheetOpen(true), 300); }}
              style={styles.fullCloseBtn}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
              <Text style={styles.fullCloseTxt}>Back</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.fullBottomBar}>
            <Text style={[styles.fullFishName, { color: rarityColor }]}>{displayName}</Text>
            {(catchItem.weight > 0 || catchItem.length > 0) && (
              <Text style={styles.fullMetric}>
                {catchItem.weight > 0 ? `${catchItem.weight} lbs` : ''}
                {catchItem.weight > 0 && catchItem.length > 0 ? '  ·  ' : ''}
                {catchItem.length > 0 ? `${catchItem.length}"` : ''}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ── Field helper ─────────────────────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline, numberOfLines,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad';
  multiline?: boolean;
  numberOfLines?: number;
}) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && { height: (numberOfLines ?? 3) * 22, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.25)"
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={numberOfLines}
        returnKeyType={multiline ? 'default' : 'done'}
      />
    </View>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: '#0d1624',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SH * 0.92,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  favoriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(15,23,42,0.8)',
  },
  favoriteBtnActive: {
    borderColor: 'rgba(245,166,35,0.9)',
    backgroundColor: 'rgba(245,166,35,0.16)',
  },
  favoriteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  favoriteBtnTextActive: {
    color: '#F5A623',
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingBottom: 12,
  },

  // hero
  heroWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#111827',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  noPhoto: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  noPhotoText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
  },
  expandHint: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  expandText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
  },

  // fields
  fields: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },

  // save
  saveBtn: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#00e5c8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.35)',
    backgroundColor: 'rgba(255,77,77,0.08)',
  },
  deleteBtnText: {
    color: '#ff4d4d',
    fontSize: 14,
    fontWeight: '700',
  },

  // fullscreen
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SW,
    height: SH,
  },
  fullCloseWrap: {
    position: 'absolute',
    left: 16,
  },
  fullCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  fullCloseTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  fullBottomBar: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  fullFishName: {
    fontSize: 22,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  fullMetric: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fbbf24',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

const fieldStyles = StyleSheet.create({
  wrap: {
    gap: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
