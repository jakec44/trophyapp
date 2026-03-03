/**
 * Draft state for the log flow. Resets on:
 * - successful submit
 * - cancel
 * - photo change
 */

import { useState, useCallback } from 'react';

export interface AiResult {
  species: string;
  confidence: number;
  top3: { species: string; confidence: number }[];
  estimated_weight_lb?: number;
  estimated_length_in?: number;
}

export interface CatchDraft {
  photoUri: string | null;
  photoUrl: string | null;
  name: string;
  species: string;
  weight: string;
  length: string;
  notes: string;
  location: string;
  aiResult: AiResult | null;
  isNewSpecies: boolean;
}

const INITIAL: CatchDraft = {
  photoUri: null,
  photoUrl: null,
  name: '',
  species: '',
  weight: '',
  length: '',
  notes: '',
  location: '',
  aiResult: null,
  isNewSpecies: false,
};

export function useCatchDraft(initialSpecies?: string) {
  const [draft, setDraft] = useState<CatchDraft>({
    ...INITIAL,
    species: initialSpecies ?? '',
  });

  const reset = useCallback(() => {
    setDraft({ ...INITIAL });
  }, []);

  const setPhotoUri = useCallback((uri: string | null) => {
    setDraft((prev) => ({
      ...prev,
      photoUri: uri,
      photoUrl: null,
      aiResult: null,
    }));
  }, []);

  const setPhotoUrl = useCallback((url: string | null) => {
    setDraft((prev) => ({ ...prev, photoUrl: url }));
  }, []);

  const setAiResult = useCallback((ai: AiResult | null) => {
    setDraft((prev) => ({
      ...prev,
      aiResult: ai,
      species: ai ? ai.species : prev.species,
      weight: ai?.estimated_weight_lb != null && ai.estimated_weight_lb > 0
        ? String(ai.estimated_weight_lb)
        : prev.weight,
      length: ai?.estimated_length_in != null && ai.estimated_length_in > 0
        ? String(ai.estimated_length_in)
        : prev.length,
    }));
  }, []);

  const setName = useCallback((n: string) => {
    setDraft((prev) => ({ ...prev, name: n }));
  }, []);

  const setSpecies = useCallback((s: string) => {
    setDraft((prev) => ({ ...prev, species: s }));
  }, []);

  const setWeight = useCallback((w: string) => {
    setDraft((prev) => ({ ...prev, weight: w }));
  }, []);

  const setLength = useCallback((l: string) => {
    setDraft((prev) => ({ ...prev, length: l }));
  }, []);

  const setNotes = useCallback((n: string) => {
    setDraft((prev) => ({ ...prev, notes: n }));
  }, []);

  const setLocation = useCallback((l: string) => {
    setDraft((prev) => ({ ...prev, location: l }));
  }, []);

  const setIsNewSpecies = useCallback((v: boolean) => {
    setDraft((prev) => ({ ...prev, isNewSpecies: v }));
  }, []);

  return {
    draft,
    reset,
    setPhotoUri,
    setPhotoUrl,
    setAiResult,
    setName,
    setSpecies,
    setWeight,
    setLength,
    setNotes,
    setLocation,
    setIsNewSpecies,
  };
}
