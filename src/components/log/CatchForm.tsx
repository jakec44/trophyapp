/**
 * CatchForm — Species, weight, length, notes, share toggle.
 * Includes species modal picker.
 * Import useState and useMemo from react — required for hooks; React default export
 * does not provide them in some bundler configs, causing "Property useState does not exist".
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/utils/colors';
import { PASSPORT_SPECIES } from '@/utils/gamificationData';

const BRIGHT_BLUE = colors.brightBlue;

const WEIGHT_MAX = 500;
const LENGTH_MAX = 200;

export interface CatchFormProps {
  name: string;
  species: string;
  weight: string;
  length: string;
  notes: string;
  shareToFeed: boolean;
  onNameChange: (n: string) => void;
  onSpeciesChange: (s: string) => void;
  onWeightChange: (w: string) => void;
  onLengthChange: (l: string) => void;
  onNotesChange: (n: string) => void;
  onShareChange: (v: boolean) => void;
  onNewSpeciesChange?: (v: boolean) => void;
  caughtSpecies?: Set<string>;
  disabled?: boolean;
  /** Controlled species picker - when set, parent owns visibility */
  showSpeciesPicker?: boolean;
  onShowSpeciesPickerChange?: (show: boolean) => void;
}

function findPassportSpeciesId(speciesName: string): string | null {
  const lower = (speciesName || '').toLowerCase().trim();
  if (!lower || lower === 'unknown') return null;
  for (const s of PASSPORT_SPECIES) {
    if (
      s.name.toLowerCase().includes(lower) ||
      lower.includes(s.name.toLowerCase())
    ) {
      return s.id;
    }
    const nameWords = s.name.toLowerCase().split(/\s+/);
    if (nameWords.some((w) => lower.includes(w) || lower === w)) return s.id;
  }
  return null;
}

export function CatchForm({
  name,
  species,
  weight,
  length,
  notes,
  shareToFeed,
  onNameChange,
  onSpeciesChange,
  onWeightChange,
  onLengthChange,
  onNotesChange,
  onShareChange,
  onNewSpeciesChange,
  caughtSpecies = new Set(),
  disabled = false,
  showSpeciesPicker: controlledShowPicker,
  onShowSpeciesPickerChange,
}: CatchFormProps) {
  const [internalPicker, setInternalPicker] = useState(false);
  const [speciesSearch, setSpeciesSearch] = useState('');
  const showPicker = controlledShowPicker ?? internalPicker;
  const setShowPicker = onShowSpeciesPickerChange ?? setInternalPicker;

  const filteredSpecies = useMemo(() => {
    const q = speciesSearch.toLowerCase().trim();
    if (!q) return PASSPORT_SPECIES;
    return PASSPORT_SPECIES.filter((s) => s.name.toLowerCase().includes(q));
  }, [speciesSearch]);

  const handleWeightChange = (t: string) => {
    const n = parseFloat(t);
    if (t === '' || t === '.' || !Number.isNaN(n)) {
      if (n > WEIGHT_MAX) return;
      onWeightChange(t);
    }
  };

  const handleLengthChange = (t: string) => {
    const n = parseFloat(t);
    if (t === '' || t === '.' || !Number.isNaN(n)) {
      if (n > LENGTH_MAX) return;
      onLengthChange(t);
    }
  };

  const handleSelectSpecies = (s: string) => {
    onSpeciesChange(s);
    const id = findPassportSpeciesId(s);
    if (id && onNewSpeciesChange) {
      onNewSpeciesChange(!caughtSpecies.has(id));
    }
    setShowPicker(false);
    setSpeciesSearch('');
  };

  const selectTapToSelect = () => {
    setSpeciesSearch('');
    setShowPicker(true);
  };

  const showTapToSelect = !species.trim();

  return (
    <View style={[styles.section, disabled && styles.disabled]}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Name (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Big Bertha"
          placeholderTextColor={colors.lightSubtext}
          value={name}
          onChangeText={onNameChange}
          editable={!disabled}
        />
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Species (optional)</Text>
        {showTapToSelect ? (
          <TouchableOpacity
            style={[styles.input, styles.tapToSelect]}
            onPress={selectTapToSelect}
          >
            <Text style={styles.tapToSelectText}>Tap to select</Text>
            <Ionicons name="chevron-down" size={20} color={colors.lightSubtext} />
          </TouchableOpacity>
        ) : (
          <View style={styles.speciesRow}>
            <TextInput
              style={[styles.input, styles.speciesInput]}
              placeholder="e.g., Largemouth Bass"
              placeholderTextColor={colors.lightSubtext}
              value={species}
              onChangeText={(t) => {
                onSpeciesChange(t);
                const id = findPassportSpeciesId(t);
                if (id && onNewSpeciesChange) {
                  onNewSpeciesChange(!caughtSpecies.has(id));
                }
              }}
              editable={!disabled}
            />
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={() => setShowPicker(true)}
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.row}>
        <View style={[styles.formGroup, styles.halfGroup]}>
          <Text style={styles.label}>Weight (lbs)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.0"
            placeholderTextColor={colors.lightSubtext}
            value={weight}
            onChangeText={handleWeightChange}
            keyboardType="decimal-pad"
            editable={!disabled}
          />
          <Text style={styles.helperText}>optional, max {WEIGHT_MAX}</Text>
        </View>
        <View style={[styles.formGroup, styles.halfGroup]}>
          <Text style={styles.label}>Length (in) (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder='e.g. 18'
            placeholderTextColor={colors.lightSubtext}
            value={length}
            onChangeText={handleLengthChange}
            keyboardType="decimal-pad"
            editable={!disabled}
          />
          <Text style={styles.helperText}>max {LENGTH_MAX}</Text>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder="Bait, conditions, quick story…"
          placeholderTextColor={colors.lightSubtext}
          value={notes}
          onChangeText={onNotesChange}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!disabled}
        />
      </View>

      <View style={styles.shareRow}>
        <View style={styles.shareContent}>
          <Text style={styles.shareLabel}>Share to feed</Text>
          <Text style={styles.shareHint}>+100 XP when shared</Text>
        </View>
        <Switch
          value={shareToFeed}
          onValueChange={onShareChange}
          trackColor={{ false: colors.lightBorder, true: BRIGHT_BLUE + '80' }}
          thumbColor={shareToFeed ? BRIGHT_BLUE : '#f4f3f4'}
          disabled={disabled}
        />
      </View>

      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerContent} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select species</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={24} color={colors.lightText} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={20} color={colors.lightSubtext} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search species..."
                placeholderTextColor={colors.lightSubtext}
                value={speciesSearch}
                onChangeText={setSpeciesSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filteredSpecies}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => handleSelectSpecies(item.name)}
                >
                  <Text style={styles.pickerRowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.5,
    pointerEvents: 'none' as const,
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.lightText,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.lightText,
  },
  tapToSelect: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tapToSelectText: {
    fontSize: 16,
    color: colors.lightSubtext,
  },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speciesInput: {
    flex: 1,
  },
  changeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  changeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRIGHT_BLUE,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 18,
    marginHorizontal: -4,
  },
  halfGroup: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 4,
  },
  helperText: {
    fontSize: 11,
    color: colors.lightSubtext,
    marginTop: 4,
    fontWeight: '500',
  },
  noteInput: {
    minHeight: 88,
    paddingTop: 12,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.lightCard,
    borderWidth: 1,
    borderColor: colors.lightBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 19,
  },
  shareContent: {
    flex: 1,
  },
  shareLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.lightText,
  },
  shareHint: {
    fontSize: 12,
    color: colors.lightSubtext,
    marginTop: 4,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: colors.lightBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: colors.lightCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.lightText,
    paddingVertical: 8,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
  },
  pickerRow: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
  },
  pickerRowText: {
    fontSize: 16,
    color: colors.lightText,
  },
});
