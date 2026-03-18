/**
 * LogCatchContent — Step-by-step catch logging wizard.
 * Steps: 0=Photo, 1=Name, 2=Species, 3=Details+Submit
 *
 * The photo is displayed as a 9:16 portrait hero in step 0,
 * then as a compact full-width strip in steps 1-3.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@/utils/colors';
import { PASSPORT_SPECIES } from '@/utils/gamificationData';
import type { CatchDraft } from '@/src/hooks/useCatchDraft';
import { findPassportSpeciesId } from '@/src/lib/speciesMapper';
import { SnaggedWordmark } from '@/src/components/ui/SnaggedWordmark';

const { width: SW, height: SH } = Dimensions.get('window');
// Portrait 9:16 hero capped at 80% of screen height (bigger display)
const HERO_H = Math.min(SW * (16 / 9), SH * 0.8);
// Compact photo strip height for steps 1–3 (larger for better visibility)
const STRIP_H = 180;
const TEAL = colors.teal;

type Step = 0 | 1 | 2 | 3;

export type ShareMediaItem = { uri: string; type: 'image' | 'video' };

export interface LogCatchContentProps {
  draft: CatchDraft;
  shareToFeed: boolean;
  shareCaption: string;
  shareMedia: ShareMediaItem[];
  isSubmitting: boolean;
  errorMessage: string | null;
  showSpeciesPicker: boolean;
  caughtSpecies: Set<string>;
  bottomPadding: number;
  onBack: () => void;
  onTakePhoto: () => void;
  onPickFromGallery: () => void;
  onPhotoCropped?: (uri: string) => void;
  onDismissError: () => void;
  onNameChange: (n: string) => void;
  onSpeciesChange: (s: string) => void;
  onWeightChange: (w: string) => void;
  onLengthChange: (l: string) => void;
  onNotesChange: (n: string) => void;
  onShareChange: (v: boolean) => void;
  onShareCaptionChange: (s: string) => void;
  onShareMediaChange: (m: ShareMediaItem[]) => void;
  onNewSpeciesChange: (v: boolean) => void;
  onShowSpeciesPicker: () => void;
  onShowSpeciesPickerChange: (v: boolean) => void;
  onSubmit: () => void;
}

export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'common': return '#9ca3af';
    case 'uncommon': return '#4ade80';
    case 'rare': return '#60a5fa';
    case 'epic': return '#c084fc';
    case 'legendary': return '#fbbf24';
    case 'mythic': return '#f97316';
    default: return '#9ca3af';
  }
}

const MAX_SHARE_MEDIA = 5;
const SHARE_THUMB = (SW - 32 - 12 * (3 - 1)) / 3;

function CaptionPreview({ text }: { text: string }) {
  const parts = text.split(/(#\w+)/g);
  return (
    <Text style={captionPreviewStyles.text}>
      {parts.map((part, i) =>
        part.startsWith('#')
          ? <Text key={i} style={captionPreviewStyles.tag}>{part}</Text>
          : part
      )}
    </Text>
  );
}
const captionPreviewStyles = StyleSheet.create({
  text: { fontSize: 14, color: '#fff', lineHeight: 20 },
  tag:  { color: TEAL, fontWeight: '700' },
});

export function LogCatchContent({
  draft,
  shareToFeed,
  shareCaption,
  shareMedia,
  isSubmitting,
  caughtSpecies,
  bottomPadding,
  onBack,
  onTakePhoto,
  onPickFromGallery,
  onNameChange,
  onSpeciesChange,
  onWeightChange,
  onLengthChange,
  onNotesChange,
  onShareChange,
  onShareCaptionChange,
  onShareMediaChange,
  onNewSpeciesChange,
  onSubmit,
}: LogCatchContentProps) {
  const [step, setStep] = useState<Step>(0);
  const [speciesSearch, setSpeciesSearch] = useState('');
  const [showAllSpecies, setShowAllSpecies] = useState(false);
  const prevPhotoUri = useRef<string | null>(null);

  // Hero height for step 0 — dynamic to show full image naturally
  const [imgNaturalHeight, setImgNaturalHeight] = useState<number | null>(null);
  const heroHeight = imgNaturalHeight
    ? Math.min(imgNaturalHeight, SH * 0.8)
    : HERO_H;

  useEffect(() => {
    if (!draft.photoUri) { setImgNaturalHeight(null); return; }
    Image.getSize(
      draft.photoUri,
      (w, h) => setImgNaturalHeight(Math.round(SW * (h / w))),
      () => setImgNaturalHeight(null)
    );
  }, [draft.photoUri]);

  // Auto-advance from photo step to name step when photo is first set.
  // Explicitly dismiss the keyboard so it never appears automatically on step 1.
  useEffect(() => {
    if (draft.photoUri && !prevPhotoUri.current && step === 0) {
      Keyboard.dismiss();
      setStep(1);
    }
    prevPhotoUri.current = draft.photoUri;
  }, [draft.photoUri, step]);

  const goNext = useCallback(() => {
    if (step < 3) setStep((s) => (s + 1) as Step);
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 0) setStep((s) => (s - 1) as Step);
    else onBack();
  }, [step, onBack]);

  // Species sorted: caught ones first, then rest
  const caughtSpeciesList = useMemo(
    () => PASSPORT_SPECIES.filter((s) => caughtSpecies.has(s.id)),
    [caughtSpecies]
  );

  const filteredSpecies = useMemo(() => {
    const q = speciesSearch.toLowerCase().trim();
    if (q) return PASSPORT_SPECIES.filter((s) => s.name.toLowerCase().includes(q));
    const caught = PASSPORT_SPECIES.filter((s) => caughtSpecies.has(s.id));
    const rest = PASSPORT_SPECIES.filter((s) => !caughtSpecies.has(s.id));
    return [...caught, ...rest];
  }, [speciesSearch, caughtSpecies]);

  const displayedSpecies = showAllSpecies || speciesSearch
    ? filteredSpecies
    : filteredSpecies.slice(0, 12);
  const hiddenCount = filteredSpecies.length - displayedSpecies.length;

  const handleSelectSpecies = useCallback(
    (name: string) => {
      onSpeciesChange(name);
      const id = findPassportSpeciesId(name);
      if (id) onNewSpeciesChange(!caughtSpecies.has(id));
      setStep(3);
    },
    [onSpeciesChange, onNewSpeciesChange, caughtSpecies]
  );

  const hasPhoto = !!draft.photoUri;
  const maxExtraMedia = draft.photoUri ? MAX_SHARE_MEDIA - 1 : MAX_SHARE_MEDIA;

  const pickShareMedia = useCallback(async () => {
    if (shareMedia.length >= maxExtraMedia) {
      Alert.alert('Limit reached', `You can add up to ${maxExtraMedia} extra photo${maxExtraMedia === 1 ? '' : 's'} or video${maxExtraMedia === 1 ? '' : 's'}.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to add media.');
      return;
    }
    const remaining = maxExtraMedia - shareMedia.length;
    // When picking one, allow crop; multi-select doesn't support crop on iOS.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      allowsEditing: remaining === 1,
      aspect: remaining === 1 ? [1, 1] : undefined,
      quality: 0.85,
      orderedSelection: true,
    });
    if (!result.canceled) {
      const picked: ShareMediaItem[] = result.assets.map((a) => ({
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
      }));
      onShareMediaChange([...shareMedia, ...picked].slice(0, maxExtraMedia));
    }
  }, [shareMedia, maxExtraMedia, onShareMediaChange]);

  const removeShareMedia = useCallback(
    (idx: number) => onShareMediaChange(shareMedia.filter((_, i) => i !== idx)),
    [shareMedia, onShareMediaChange]
  );

  // ── Shared header (Snagged title + step dots + dismiss keyboard + optional skip) ──
  const renderHeader = (onSkip?: () => void) => (
    <View style={styles.stepHeader}>
      <View style={styles.headerLeft}>
        <SnaggedWordmark />
      </View>

      <View style={styles.headerCenter}>
        <View style={styles.dots}>
          {([0, 1, 2, 3] as Step[]).map((i) => (
            <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
          ))}
        </View>
        {/* Dismiss keyboard — always visible so keyboard never feels trapped */}
        <TouchableOpacity style={styles.kbdDismissBtn} onPress={() => Keyboard.dismiss()} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <Feather name="chevron-down" size={18} color={colors.lightSubtext} />
        </TouchableOpacity>
      </View>

      {onSkip ? (
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipTxt}>Skip</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.skipBtn} />
      )}
    </View>
  );

  // ── Compact photo strip shown in steps 1–3 ─────────────────────────────
  const renderStrip = () => (
    <TouchableOpacity
      style={[styles.strip, { height: STRIP_H }]}
      activeOpacity={0.85}
      onPress={onTakePhoto}
    >
      {hasPhoto ? (
        <Image
          source={{ uri: draft.photoUri! }}
          style={styles.stripImg}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.stripImg, styles.stripPlaceholder]}>
          <Feather name="camera" size={22} color={TEAL} />
          <Text style={styles.stripPlaceholderTxt}>Tap to add photo</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // ══════════════════════════════════════════════════════════════════════
  // STEP 0: Photo
  // ══════════════════════════════════════════════════════════════════════
  if (step === 0) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {renderHeader(goNext)}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.step0Content, { paddingBottom: bottomPadding + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero photo area — height matches image aspect ratio */}
          <View style={[styles.hero, { height: heroHeight }]}>
            {hasPhoto ? (
              <Image source={{ uri: draft.photoUri! }} style={styles.heroImg} resizeMode="contain" />
            ) : (
              <TouchableOpacity style={styles.heroPlaceholder} activeOpacity={0.8} onPress={onTakePhoto}>
                <View style={styles.heroCamIcon}>
                  <Feather name="camera" size={52} color={TEAL} />
                </View>
                <Text style={styles.heroPlaceholderTitle}>Add your catch photo</Text>
                <Text style={styles.heroPlaceholderSub}>9:16 portrait — tap to capture</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.aiComingSoonStep0}>AI identifier coming soon</Text>
          {/* Photo action buttons */}
          <View style={styles.photoBtns}>
            <TouchableOpacity style={[styles.photoBtn, styles.photoBtnPrimary]} onPress={onTakePhoto}>
              <Feather name="camera" size={20} color="#000" />
              <Text style={styles.photoBtnPrimaryTxt}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={onPickFromGallery}>
              <Feather name="image" size={20} color={TEAL} />
              <Text style={styles.photoBtnOutlineTxt}>From Gallery</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.skipPhotoBtn} onPress={goNext}>
            <Text style={styles.skipPhotoTxt}>Skip photo →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // STEP 1: Name
  // ══════════════════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {renderHeader(goNext)}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: bottomPadding + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStrip()}
          <View style={styles.formContent}>
            <Text style={styles.stepTitle}>Name your catch</Text>
            <Text style={styles.stepSub}>Optional — e.g. "Big Bertha"</Text>

            <TextInput
              style={styles.input}
              placeholder="e.g. Big Bertha"
              placeholderTextColor={colors.lightSubtext}
              value={draft.name}
              onChangeText={onNameChange}
            returnKeyType="next"
            onSubmitEditing={goNext}
          />

            <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
              <Text style={styles.nextBtnTxt}>Next →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2: Species
  // ══════════════════════════════════════════════════════════════════════
  if (step === 2) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {renderHeader(() => setStep(3))}

        {/* Search bar pinned below header */}
        <View style={styles.searchSection}>
          <Text style={styles.searchLabel}>Search Species</Text>
          <Text style={styles.aiComingSoon}>AI identifier coming soon</Text>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={20} color={TEAL} />
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. Redfish, Largemouth Bass…"
              placeholderTextColor={colors.lightSubtext}
              value={speciesSearch}
              onChangeText={(t) => { setSpeciesSearch(t); setShowAllSpecies(false); }}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {speciesSearch.length > 0 && (
              <TouchableOpacity onPress={() => setSpeciesSearch('')}>
                <Ionicons name="close-circle" size={20} color={colors.lightSubtext} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={styles.flex} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onScrollBeginDrag={() => Keyboard.dismiss()}>
          {/* Strip scrolls with list */}
          {renderStrip()}

          {/* Quick picks: user's previously caught species */}
          {caughtSpeciesList.length > 0 && !speciesSearch && (
            <View style={styles.quickPicksWrap}>
              <Text style={styles.sectionLabel}>Your catches</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickPicksScroll}
              >
                {caughtSpeciesList.slice(0, 10).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.pill, draft.species === s.name && styles.pillActive]}
                    onPress={() => handleSelectSpecies(s.name)}
                  >
                    <Text style={[styles.pillTxt, draft.species === s.name && styles.pillTxtActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Show more species — pinned above list so it's always visible */}
          {hiddenCount > 0 && (
            <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllSpecies(true)}>
              <Text style={styles.showMoreTxt}>Show {hiddenCount} more species</Text>
              <Feather name="chevron-down" size={16} color={TEAL} />
            </TouchableOpacity>
          )}

          {/* Species list */}
          {displayedSpecies.map((s) => {
            const isCaught = caughtSpecies.has(s.id);
            const isSelected = draft.species === s.name;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.speciesRow, isSelected && styles.speciesRowActive]}
                onPress={() => handleSelectSpecies(s.name)}
              >
                <Text style={[styles.speciesRowTxt, isSelected && styles.speciesRowTxtActive]} numberOfLines={1}>
                  {s.name}
                </Text>
                <View style={styles.speciesRowRight}>
                  {isCaught && !isSelected && (
                    <Text style={styles.caughtBadge}>✓ caught</Text>
                  )}
                  <Text style={[styles.rarityLabel, { color: getRarityColor(s.rarity) }]}>
                    {s.rarity}
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={18} color={TEAL} />}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // STEP 3: Details (weight, length, notes, share, submit)
  // ══════════════════════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {renderHeader()}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: bottomPadding + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderStrip()}
        <View style={styles.formContent}>
        {/* Selected species chip with change option */}
        {draft.species ? (
          <TouchableOpacity style={styles.selectedSpeciesRow} onPress={() => setStep(2)}>
            <Ionicons name="fish" size={15} color={TEAL} />
            <Text style={styles.selectedSpeciesTxt} numberOfLines={1}>{draft.species}</Text>
            <Text style={styles.changeSpeciesTxt}>Change</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.addSpeciesRow} onPress={() => setStep(2)}>
            <Ionicons name="add-circle-outline" size={18} color={TEAL} />
            <Text style={styles.addSpeciesTxt}>Select species (optional)</Text>
          </TouchableOpacity>
        )}

        {/* Weight & Length */}
        <Text style={styles.aiTrackerComingSoon}>AI tracker coming soon</Text>
        <View style={styles.row}>
          <View style={styles.halfGroup}>
            <Text style={styles.fieldLabel}>Weight (lbs)</Text>
            <TextInput
              style={styles.input}
              placeholder="optional"
              placeholderTextColor={colors.lightSubtext}
              value={draft.weight}
              onChangeText={onWeightChange}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.halfGroup}>
            <Text style={styles.fieldLabel}>Length (in)</Text>
            <TextInput
              style={styles.input}
              placeholder="optional"
              placeholderTextColor={colors.lightSubtext}
              value={draft.length}
              onChangeText={onLengthChange}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Notes */}
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder="Bait, conditions, quick story…"
          placeholderTextColor={colors.lightSubtext}
          value={draft.notes}
          onChangeText={onNotesChange}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Share to feed toggle */}
        <View style={styles.shareRow}>
          <View style={styles.shareLeft}>
            <Text style={styles.shareLabel}>Share to feed</Text>
            <Text style={styles.shareHint}>+100 XP when shared</Text>
          </View>
          <Switch
            value={shareToFeed}
            onValueChange={onShareChange}
            trackColor={{ false: colors.lightBorder, true: TEAL + '80' }}
            thumbColor={shareToFeed ? TEAL : '#888'}
          />
        </View>

        {/* Share caption + extra media (when Share to feed is on) */}
        {shareToFeed && (
          <>
            <View style={styles.shareCaptionSection}>
              <View style={styles.shareCaptionRow}>
                <Feather name="edit-3" size={16} color="rgba(255,255,255,0.35)" style={{ marginTop: 3 }} />
                <TextInput
                  style={styles.shareCaptionInput}
                  placeholder="Write a caption… use #hashtags"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={shareCaption}
                  onChangeText={onShareCaptionChange}
                  multiline
                  maxLength={500}
                  returnKeyType="default"
                  textAlignVertical="top"
                />
              </View>
              <Text style={styles.shareCharCount}>{shareCaption.length}/500</Text>
            </View>
            {shareCaption.includes('#') && (
              <View style={styles.sharePreviewBox}>
                <Text style={styles.sharePreviewLabel}>Preview</Text>
                <CaptionPreview text={shareCaption} />
              </View>
            )}
            <View style={styles.shareMediaSection}>
              <Text style={styles.shareMediaLabel}>Add photos or videos</Text>
              <View style={styles.shareMediaGrid}>
                {shareMedia.map((item, idx) => (
                  <View key={idx} style={styles.shareThumb}>
                    {item.type === 'video' ? (
                      <View style={styles.shareVideoThumb}>
                        <Ionicons name="videocam" size={24} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.shareVideoLabel}>Video</Text>
                      </View>
                    ) : (
                      <Image source={{ uri: item.uri }} style={styles.shareThumbImg} resizeMode="cover" />
                    )}
                    <TouchableOpacity
                      style={styles.shareRemoveBtn}
                      onPress={() => removeShareMedia(idx)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {shareMedia.length < maxExtraMedia && (
                  <TouchableOpacity style={styles.shareAddTile} onPress={pickShareMedia} activeOpacity={0.75}>
                    <Ionicons name="add" size={28} color={TEAL} />
                    <Text style={styles.shareAddTileTxt}>
                      {shareMedia.length === 0 ? 'Add' : `+${maxExtraMedia - shareMedia.length}`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}

        {/* Submit — Pressable for reliable web clicks */}
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            isSubmitting && styles.submitBtnDisabled,
            Platform.OS === 'web' && (styles.submitBtnWeb as object),
            pressed && styles.submitBtnPressed,
          ]}
          onPress={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#000" />
              <Text style={styles.submitBtnTxt}>Continue to Log</Text>
            </>
          )}
        </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // ── Header ─────────────────────────────────────────────────────────────
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.lightCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lightBorder,
  },
  headerLeft: { minWidth: 80 },
  headerSnagged: {
    fontFamily: 'Orbitron_900Black',
    fontSize: 18,
    color: '#00e5c8',
    letterSpacing: 1.5,
  },
  headerCenter: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  kbdDismissBtn: {
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.lightBorder,
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TEAL,
  },
  skipBtn: { minWidth: 48, alignItems: 'flex-end' },
  skipTxt: { fontSize: 14, fontWeight: '600', color: colors.lightSubtext },

  // ── Step 0: Photo hero ─────────────────────────────────────────────────
  step0Content: { paddingHorizontal: 0 },
  hero: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  heroImg: { width: '100%', height: '100%', backgroundColor: '#000' },
  heroPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: TEAL + '35',
    borderStyle: 'dashed',
    margin: 16,
    borderRadius: 18,
    gap: 12,
  },
  heroCamIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: TEAL + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
  },
  heroPlaceholderSub: {
    fontSize: 13,
    color: colors.lightSubtext,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  photoBtns: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: TEAL,
  },
  photoBtnPrimary: { backgroundColor: TEAL, borderColor: TEAL },
  photoBtnPrimaryTxt: { fontSize: 15, fontWeight: '700', color: '#000' },
  photoBtnOutlineTxt: { fontSize: 15, fontWeight: '600', color: TEAL },
  skipPhotoBtn: { alignSelf: 'center', paddingVertical: 18, paddingHorizontal: 24 },
  skipPhotoTxt: { fontSize: 14, color: colors.lightSubtext, fontWeight: '500' },
  aiComingSoonStep0: {
    fontSize: 13,
    color: colors.lightSubtext,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
  },

  // ── Compact strip (steps 1–3) ─────────────────────────────────────────
  strip: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  stripImg: { width: '100%', height: '100%' },
  stripPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111',
  },
  stripPlaceholderTxt: { fontSize: 13, color: TEAL, fontWeight: '500' },

  // ── Shared form layout ─────────────────────────────────────────────────
  formContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.lightText,
    marginBottom: 6,
  },
  stepSub: { fontSize: 13, color: colors.lightSubtext, marginBottom: 20 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.lightSubtext,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.lightText,
    marginBottom: 18,
  },
  noteInput: { minHeight: 88, paddingTop: 12 },
  nextBtn: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  nextBtnTxt: { fontSize: 16, fontWeight: '700', color: '#000' },

  // ── Species step ───────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.lightSubtext,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  quickPicksWrap: { paddingTop: 12, paddingBottom: 8 },
  quickPicksScroll: { paddingHorizontal: 16, gap: 8 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    backgroundColor: colors.lightCard,
  },
  pillActive: { backgroundColor: TEAL, borderColor: TEAL },
  pillTxt: { fontSize: 13, fontWeight: '600', color: colors.lightText },
  pillTxtActive: { color: '#000' },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.lightBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lightBorder,
  },
  searchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.lightSubtext,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  aiComingSoon: {
    fontSize: 13,
    color: colors.lightSubtext,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.lightCard,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.lightBorder,
    borderColor: colors.lightBorder,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.lightText, paddingVertical: 0 },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lightBorder,
  },
  speciesRowActive: { backgroundColor: TEAL + '10' },
  speciesRowTxt: { flex: 1, fontSize: 15, color: colors.lightText, fontWeight: '500', marginRight: 8 },
  speciesRowTxtActive: { color: TEAL, fontWeight: '700' },
  speciesRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caughtBadge: { fontSize: 10, color: TEAL, fontWeight: '700' },
  rarityLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 18,
  },
  showMoreTxt: { fontSize: 14, fontWeight: '600', color: TEAL },

  // ── Details step ──────────────────────────────────────────────────────
  selectedSpeciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: TEAL + '12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TEAL + '30',
  },
  selectedSpeciesTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: TEAL },
  changeSpeciesTxt: { fontSize: 13, fontWeight: '600', color: colors.lightSubtext },
  addSpeciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.lightCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    borderStyle: 'dashed',
  },
  addSpeciesTxt: { fontSize: 14, fontWeight: '500', color: TEAL },
  aiTrackerComingSoon: {
    fontSize: 13,
    color: colors.lightSubtext,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 12 },
  halfGroup: { flex: 1 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  shareLeft: { flex: 1 },
  shareLabel: { fontSize: 16, fontWeight: '600', color: colors.lightText },
  shareHint: { fontSize: 12, color: TEAL, marginTop: 3, fontWeight: '500' },

  shareCaptionSection: { marginTop: 12, marginBottom: 8 },
  shareCaptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
  },
  shareCaptionInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    minHeight: 72,
    lineHeight: 22,
  },
  shareCharCount: {
    textAlign: 'right',
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 6,
  },
  sharePreviewBox: {
    marginTop: 8,
    marginBottom: 8,
    padding: 10,
    backgroundColor: 'rgba(0,229,200,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TEAL + '30',
    gap: 4,
  },
  sharePreviewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEAL,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  shareMediaSection: { marginTop: 8, marginBottom: 16 },
  shareMediaLabel: { fontSize: 13, fontWeight: '600', color: colors.lightSubtext, marginBottom: 8 },
  shareMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shareThumb: {
    width: SHARE_THUMB,
    height: SHARE_THUMB,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a2535',
    position: 'relative',
  },
  shareThumbImg: { width: '100%', height: '100%' },
  shareVideoThumb: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f1e2e',
    gap: 2,
  },
  shareVideoLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  shareRemoveBtn: { position: 'absolute', top: 4, right: 4 },
  shareAddTile: {
    width: SHARE_THUMB,
    height: SHARE_THUMB,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: TEAL + '50',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TEAL + '08',
  },
  shareAddTileTxt: { fontSize: 12, color: TEAL, fontWeight: '600' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: TEAL,
    paddingVertical: 17,
    borderRadius: 16,
  },
  submitBtnWeb: { cursor: 'pointer' } as { cursor: string },
  submitBtnPressed: { opacity: 0.85 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnTxt: { fontSize: 17, fontWeight: '800', color: '#000' },
});
