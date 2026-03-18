/**
 * Log Catch — thin orchestrator.
 * Flow: pick photo (optional) → fill form (species, length, weight) → submit → upload → insert → Saved.
 * No AI; manual fields only.
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { triggerSuccess } from '@/src/lib/feedback';
import { colors } from '@/utils/colors';
import { logScreenStyles } from '@/src/components/log/LogScreen.styles';
import { useAuthContext } from '@/src/context/AuthContext';
import { usePresentPaywall } from '@/src/hooks/usePresentPaywall';
import { useGamificationContext } from '@/src/context/GamificationContext';
import { useFeedContext } from '@/src/context/FeedContext';
import { useBottomSafePadding } from '@/src/components/ScreenContainer';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogCatchContent } from '@/src/components/log/LogCatchContent';
import { LogSuccessOverlay } from '@/src/components/log/LogSuccessOverlay';
import { TackleBoxUnlockModal } from '@/src/components/gamification/TackleBoxUnlockModal';
import { useCatchDraft } from '@/src/hooks/useCatchDraft';

const ONBOARDING_NEEDS_PROFILE = 'onboarding_needs_profile';
const ONBOARDING_FIRST_CATCH_PENDING = 'onboarding_first_catch_pending';
import { logCatch } from '@/src/lib/catches';
import { awardSpeciesBadgeIfEligible, type SpeciesBadgeUnlock } from '@/src/lib/speciesMastery';
import { addPendingCreateCatch } from '@/src/lib/pendingActions';
import { toFriendlyMessage, getProLimitType } from '@/src/lib/errorMessages';
import { findPassportSpeciesId } from '@/src/lib/speciesMapper';
import { recordCatchForDailyQuest } from '@/src/lib/dailyQuests';
import { PASSPORT_SPECIES } from '@/utils/gamificationData';

/** XP granted by species rarity */
function getSpeciesXP(species: string): number {
  const pid = findPassportSpeciesId(species);
  if (!pid) return 20;
  const s = PASSPORT_SPECIES.find((p) => p.id === pid);
  if (!s) return 20;
  switch (s.rarity) {
    case 'common': return 20;
    case 'uncommon': return 50;
    case 'rare': return 75;
    case 'epic': return 100;
    case 'legendary': return 200;
    case 'mythic': return 300;
    default: return 20;
  }
}

function getSpeciesRarity(species: string): string {
  const pid = findPassportSpeciesId(species);
  if (!pid) return 'common';
  const s = PASSPORT_SPECIES.find((p) => p.id === pid);
  return s?.rarity ?? 'common';
}

export default function LogCatchScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { presentPaywall } = usePresentPaywall();
  const gamification = useGamificationContext();
  const { addFeedPost } = useFeedContext();
  const bottomPadding = useBottomSafePadding();

  const params = useLocalSearchParams<{
    originalUri?: string | string[];
    fishImageResult?: string;
    isLiveCatch?: string;
  }>();

  const {
    draft,
    reset,
    setPhotoUri,
    setName,
    setSpecies,
    setWeight,
    setLength,
    setNotes,
    setIsNewSpecies,
  } = useCatchDraft();

  const [shareToFeed, setShareToFeed] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [shareMedia, setShareMedia] = useState<{ uri: string; type: 'image' | 'video' }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successOverlay, setSuccessOverlay] = useState<{
    species: string;
    xpEarned: number;
    rarity: string;
    imageUri?: string;
    weight?: number;
    length?: number;
    speciesCount?: number;
    totalSpecies?: number;
    xpBefore?: number;
    isNewSpecies?: boolean;
  } | null>(null);
  const [pendingSpeciesBadge, setPendingSpeciesBadge] = useState<SpeciesBadgeUnlock | null>(null);
  const [showSpeciesPicker, setShowSpeciesPicker] = useState(false);

  const { caughtSpecies } = gamification;

  const [onboardingGuestChecked, setOnboardingGuestChecked] = useState(false);
  const [allowOnboardingGuest, setAllowOnboardingGuest] = useState(false);
  useEffect(() => {
    if (user?.id) return;
    let cancelled = false;
    (async () => {
      const [hasSeen, hasDismissed] = await Promise.all([
        AsyncStorage.getItem('hasSeenOnboarding'),
        AsyncStorage.getItem('hasDismissedHomeOverlay'),
      ]);
      if (!cancelled) {
        setAllowOnboardingGuest(hasSeen !== '1' && hasDismissed === '1');
        setOnboardingGuestChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id || !onboardingGuestChecked) return;
      if (!allowOnboardingGuest) router.replace('/(tabs)/profile');
    }, [user?.id, onboardingGuestChecked, allowOnboardingGuest, router])
  );

  // Safety net: if submit stays loading too long (e.g. timer throttled on iOS), unstick the UI
  const SUBMIT_MAX_MS = 65000;
  useEffect(() => {
    if (!isSubmitting) return;
    const t = setTimeout(() => {
      setIsSubmitting(false);
      setErrorMessage('Request took too long. Check your connection and try again.');
    }, SUBMIT_MAX_MS);
    return () => clearTimeout(t);
  }, [isSubmitting]);

  // Init from params
  useEffect(() => {
    let uri: string | null = null;
    if (params.originalUri) {
      const raw = params.originalUri;
      uri = (Array.isArray(raw) ? raw[0] : typeof raw === 'string' ? raw : '')?.trim() ?? '';
      try {
        if (uri && (uri.includes('%3A') || uri.includes('%2F'))) {
          uri = decodeURIComponent(uri);
        }
      } catch {
        // ignore
      }
    } else if (params.fishImageResult) {
      try {
        const parsed = JSON.parse(params.fishImageResult) as {
          originalUri?: string;
          editedUri?: string;
          enhancedUri?: string;
        };
        uri = parsed.enhancedUri || parsed.editedUri || parsed.originalUri || null;
      } catch {
        uri = null;
      }
    }
    if (uri) setPhotoUri(uri);
  }, [params.originalUri, params.fishImageResult, setPhotoUri]);

  const handleTakePhoto = () => router.push('/camera');
  const handlePickFromGallery = () => router.push('/photo-picker');

  const handleSubmit = useCallback(async () => {
    const { species, weight, length, notes, name, photoUri, photoUrl } = draft;
    const speciesTrim = (species.trim() || 'Unknown').trim();
    const weightNum = Math.max(0, parseFloat(weight) || 0);
    const lengthNum = Math.max(0, parseFloat(length) || 0);
    const notesWithName = name.trim()
      ? (notes.trim() ? `Name: ${name.trim()}\n${notes.trim()}` : `Name: ${name.trim()}`)
      : notes.trim();

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    const SUBMIT_TIMEOUT_MS = 60000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Log timed out. Check your connection and try again.')), SUBMIT_TIMEOUT_MS);
    });

    const takenAt = new Date().toISOString();
    const weightForDb = weightNum > 0 ? weightNum : 0.1;

    const doSubmit = async () => {
      if (!user?.id) {
        await addPendingCreateCatch({
          species: speciesTrim,
          weight_lb: weightForDb,
          length_in: lengthNum > 0 ? lengthNum : undefined,
          notes: notesWithName || undefined,
          photoUri: photoUri ?? undefined,
          taken_at: takenAt,
        });
        // Guest — show same XP/success overlay, then they go to Profile to sign in on "Continue Fishing"
        const xpEarned = getSpeciesXP(speciesTrim);
        const rarity = getSpeciesRarity(speciesTrim);
        triggerSuccess();
        setSuccessOverlay({
          species: speciesTrim,
          xpEarned,
          rarity,
          imageUri: photoUri ?? undefined,
          weight: weightForDb,
          length: lengthNum > 0 ? lengthNum : undefined,
          speciesCount: 1,
          totalSpecies: PASSPORT_SPECIES.length,
          xpBefore: 0,
          isNewSpecies: true,
        });
        return;
      }

      if (user.subscriptionPlan !== 'pro' && (gamification.totalCatches ?? 0) >= 30) {
        setIsSubmitting(false);
        Alert.alert(
          'Pro unlocks unlimited logs',
          'Upgrade to Pro to log more than 30 fish.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upgrade', onPress: () => presentPaywall() },
          ]
        );
        return;
      }

      // Hold level-up modal before XP so it doesn't flash; release after success overlay dismisses
      gamification.holdLevelUp();

      const created = await logCatch({
        user_id: user.id,
        species: speciesTrim,
        weight_lb: weightForDb,
        length_in: lengthNum > 0 ? lengthNum : undefined,
        notes: notesWithName || undefined,
        taken_at: takenAt,
        photoUri: photoUri ?? undefined,
      });

      try {
        await recordCatchForDailyQuest(user.id, speciesTrim);
      } catch {
        // non-blocking for daily quest
      }

      const XP_BASE = getSpeciesXP(speciesTrim);
      const XP_SHARE_BONUS = XP_BASE; // share bonus mirrors rarity XP
      const rarity = getSpeciesRarity(speciesTrim);
      const xpEarned = shareToFeed ? XP_BASE + XP_SHARE_BONUS : XP_BASE;

      const pid = findPassportSpeciesId(speciesTrim);
      const wasNewSpecies = !!pid && !caughtSpecies.has(pid);
      // Capture XP and species count BEFORE updating gamification so overlay shows correct "before" state
      const xpBefore = gamification.xp;
      const speciesCountBefore = gamification.caughtSpecies?.size ?? 0;
      const speciesCount = speciesCountBefore + (wasNewSpecies ? 1 : 0);

      // Pass rarity XP so the gamification level reflects the actual XP earned
      await gamification.onCatchLogged(XP_BASE);
      if (shareToFeed) await gamification.addXp(XP_SHARE_BONUS);

      if (pid) await gamification.addCaughtSpecies(pid);

      const newBadge = await awardSpeciesBadgeIfEligible(user.id, speciesTrim);
      if (newBadge) setPendingSpeciesBadge(newBadge);

      if (shareToFeed && user) {
        try {
          const primaryUrl = photoUri ?? created.photo_url ?? '';
          const extraUris = shareMedia.map((m) => m.uri);
          const mediaUrls = primaryUrl ? [primaryUrl, ...extraUris] : extraUris;
          await addFeedPost({
            userId: user.id,
            username: user.username ?? user.displayName ?? 'Angler',
            avatar: user.avatarUrl ?? '',
            postedAt: takenAt,
            photoUrl: primaryUrl || extraUris[0] || '',
            photoPath: created.photo_path ?? undefined,
            mediaUrls: mediaUrls.length ? mediaUrls : undefined,
            caption: shareCaption.trim() || undefined,
            species: speciesTrim,
            weight: weightForDb,
            length: lengthNum > 0 ? lengthNum : undefined,
            location: '',
            hypeCount: 0,
            commentCount: 0,
            isHyped: false,
            isLiveCatch: params.isLiveCatch === '1',
            xpGained: XP_SHARE_BONUS,
            authorLevel: gamification?.levelInfo?.level,
            authorAnglerRating: (user as { angler_rating?: number })?.angler_rating,
          });
        } catch {
          // ignore
        }
      }

      // Show success popup every time (XP + species unlock when applicable). Do NOT reset draft
      // here — reset only on overlay dismiss so we never "glitch back" to an empty details step.
      triggerSuccess();
      setSuccessOverlay({
        species: speciesTrim,
        xpEarned,
        rarity,
        imageUri: photoUri ?? undefined,
        weight: weightForDb,
        length: lengthNum > 0 ? lengthNum : undefined,
        speciesCount,
        totalSpecies: PASSPORT_SPECIES.length,
        xpBefore,
        isNewSpecies: wasNewSpecies,
      });
    };

    try {
      await Promise.race([doSubmit(), timeoutPromise]);
    } catch (e) {
      console.error('[Log] submit: failed', e);
      const limit = getProLimitType(e);
      if (limit === 'log') {
        Alert.alert(
          'Pro unlocks unlimited logs',
          'Upgrade to Pro to log more than 30 fish.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upgrade', onPress: () => presentPaywall() },
          ]
        );
      } else {
        const msg = toFriendlyMessage(e);
        setErrorMessage(msg);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(`Log failed\n\n${msg}`);
        } else {
          Alert.alert('Log failed', msg);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    draft,
    user,
    shareToFeed,
    shareCaption,
    shareMedia,
    reset,
    gamification,
    caughtSpecies,
    addFeedPost,
    params.isLiveCatch,
    router,
  ]);

  const handleShareFromOverlay = async () => {
    const photoUri = successOverlay?.imageUri ?? draft.photoUri;
    const species = successOverlay?.species ?? draft.species;
    if (!photoUri || !user) return;
    try {
      await addFeedPost({
        userId: user.id,
        username: user.username ?? user.displayName ?? 'Angler',
        avatar: user.avatarUrl ?? '',
        postedAt: new Date().toISOString(),
        photoUrl: photoUri,
        species: species ?? 'Unknown',
        weight: (successOverlay?.weight ?? parseFloat(draft.weight)) || 0,
        length: (successOverlay?.length ?? parseFloat(draft.length)) || undefined,
        location: '',
        hypeCount: 0,
        commentCount: 0,
        isHyped: false,
        isLiveCatch: params.isLiveCatch === '1',
        xpGained: 100,
        authorLevel: gamification?.levelInfo?.level,
        authorAnglerRating: (user as { angler_rating?: number })?.angler_rating,
      });
    } catch {
      // ignore
    }
  };

  const doFinalDismiss = () => {
    setPendingSpeciesBadge(null);
    setShareCaption('');
    setShareMedia([]);
    reset();
    if (gamification.levelUpModal) {
      gamification.releaseLevelUp(500);
      return;
    }
    gamification.releaseLevelUp(0);
    setTimeout(() => {
      router.replace('/(tabs)/logbook');
    }, 350);
  };

  const handleDismissSuccess = () => {
    if (pendingSpeciesBadge) return;
    if (!user) {
      AsyncStorage.setItem(ONBOARDING_NEEDS_PROFILE, '1').catch(() => {});
      AsyncStorage.setItem(ONBOARDING_FIRST_CATCH_PENDING, '1').catch(() => {});
      setSuccessOverlay(null);
      setPendingSpeciesBadge(null);
      setShareCaption('');
      setShareMedia([]);
      reset();
      if (gamification.levelUpModal) gamification.releaseLevelUp(500);
      else gamification.releaseLevelUp(0);
      setTimeout(() => router.replace('/(tabs)/profile'), 350);
      return;
    }
    setSuccessOverlay(null);
    doFinalDismiss();
  };

  return (
    <SafeAreaView style={logScreenStyles.container} edges={['top']}>
      {/* Hide form when success overlay is visible so we never "glitch back" to details step */}
      {!successOverlay && (
        <LogCatchContent
          draft={draft}
          shareToFeed={shareToFeed}
          shareCaption={shareCaption}
          shareMedia={shareMedia}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          showSpeciesPicker={showSpeciesPicker}
          caughtSpecies={caughtSpecies}
          bottomPadding={bottomPadding}
          onBack={() => router.replace('/(tabs)')}
          onTakePhoto={handleTakePhoto}
          onPickFromGallery={handlePickFromGallery}
          onPhotoCropped={setPhotoUri}
          onDismissError={() => setErrorMessage(null)}
          onNameChange={setName}
          onSpeciesChange={setSpecies}
          onWeightChange={setWeight}
          onLengthChange={setLength}
          onNotesChange={setNotes}
          onShareChange={setShareToFeed}
          onShareCaptionChange={setShareCaption}
          onShareMediaChange={setShareMedia}
          onNewSpeciesChange={setIsNewSpecies}
          onShowSpeciesPicker={() => setShowSpeciesPicker(true)}
          onShowSpeciesPickerChange={setShowSpeciesPicker}
          onSubmit={handleSubmit}
        />
      )}

      <LogSuccessOverlay
        visible={!!successOverlay}
        species={successOverlay?.species ?? ''}
        xpEarned={successOverlay?.xpEarned ?? 0}
        rarity={successOverlay?.rarity}
        imageUri={successOverlay?.imageUri}
        weight={successOverlay?.weight}
        length={successOverlay?.length}
        speciesCount={successOverlay?.speciesCount}
        totalSpecies={successOverlay?.totalSpecies}
        xpBefore={successOverlay?.xpBefore}
        isNewSpecies={successOverlay?.isNewSpecies}
        onViewPassport={(speciesId) => {
          setSuccessOverlay(null);
          reset();
          gamification.releaseLevelUp(0);
          router.replace({
            pathname: '/(tabs)/passport',
            params: speciesId ? { speciesId } : {},
          });
        }}
        onShareToFeed={handleShareFromOverlay}
        onDismiss={handleDismissSuccess}
      />

      {successOverlay === null && pendingSpeciesBadge && (
        <TackleBoxUnlockModal
          visible={true}
          onDismiss={() => {
            setPendingSpeciesBadge(null);
            if (!user) {
              AsyncStorage.setItem(ONBOARDING_NEEDS_PROFILE, '1').catch(() => {});
              AsyncStorage.setItem(ONBOARDING_FIRST_CATCH_PENDING, '1').catch(() => {});
              setShareCaption('');
              setShareMedia([]);
              reset();
              if (gamification.levelUpModal) gamification.releaseLevelUp(500);
              else gamification.releaseLevelUp(0);
              setTimeout(() => router.replace('/(tabs)/profile'), 350);
            } else {
              doFinalDismiss();
            }
          }}
          badgeName={pendingSpeciesBadge.badgeName}
          badgeKey={pendingSpeciesBadge.badgeKey}
          rarity={pendingSpeciesBadge.rarity}
          subtitle={pendingSpeciesBadge.subtitle}
        />
      )}
    </SafeAreaView>
  );
}
