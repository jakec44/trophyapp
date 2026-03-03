/**
 * useCatchAiSuggestions — AI species/length/weight suggestions from image
 * Uses detectFishFromImage (fal.ai or mock). Structured for real API integration.
 */

import { useState, useCallback, useEffect } from 'react';
import { detectFishFromImage } from '@/src/lib/fishDetectionService';

export interface CatchAiSuggestion {
  species: string;
  confidence: number;
  lengthGuess: number;
  weightGuess: number;
}

export interface UseCatchAiSuggestionsResult {
  loading: boolean;
  error: string | null;
  suggestion: CatchAiSuggestion | null;
  refetch: () => void;
}

export function useCatchAiSuggestions(
  imageUri: string | null,
  options?: { initialSuggestion?: CatchAiSuggestion | null; runOnMount?: boolean }
): UseCatchAiSuggestionsResult {
  const { initialSuggestion, runOnMount = true } = options ?? {};
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<CatchAiSuggestion | null>(initialSuggestion ?? null);
  const [trigger, setTrigger] = useState(0);

  const runAnalysis = useCallback(async () => {
    if (!imageUri?.trim()) {
      setSuggestion(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await detectFishFromImage(imageUri);
      setSuggestion({
        species: result.species || '',
        confidence: result.confidence ?? 75,
        lengthGuess: result.lengthEstimate ?? 0,
        weightGuess: result.weightEstimate ?? 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI analysis failed';
      setError(msg);
      setSuggestion(null);
    } finally {
      setLoading(false);
    }
  }, [imageUri]);

  const refetch = useCallback(() => {
    setTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!imageUri?.trim()) {
      setSuggestion(initialSuggestion ?? null);
      return;
    }
    if (!runOnMount && trigger === 0 && initialSuggestion) {
      setSuggestion(initialSuggestion);
      return;
    }
    runAnalysis();
  }, [imageUri, trigger, runOnMount, initialSuggestion?.species]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error, suggestion, refetch };
}
