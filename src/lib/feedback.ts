/**
 * Central haptics and sound effects.
 * - Haptics: work on supported devices (iOS, Android with vibration).
 * - Sound: optional; call playSound(require('@/assets/sounds/name.mp3')) when you have assets.
 */

import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

// -----------------------------------------------------------------------------
// Haptics (always safe to call)
// -----------------------------------------------------------------------------

export function hapticLight(): void {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // ignore on unsupported platforms (e.g. web)
  }
}

export function hapticMedium(): void {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // ignore
  }
}

export function hapticSuccess(): void {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // ignore
  }
}

export function hapticSelection(): void {
  try {
    Haptics.selectionAsync();
  } catch {
    // ignore
  }
}

// -----------------------------------------------------------------------------
// Semantic triggers (haptic + optional sound)
// -----------------------------------------------------------------------------

/** Double-tap like / hype on a post */
export function triggerLike(): void {
  hapticLight();
}

/** Hype button tap (same as like) */
export function triggerHype(): void {
  hapticLight();
}

/** Send message / submit action */
export function triggerSend(): void {
  hapticLight();
}

/** Success (e.g. catch logged, level up) */
export function triggerSuccess(): void {
  hapticSuccess();
}

/** Generic tap / selection */
export function triggerTap(): void {
  hapticSelection();
}

// -----------------------------------------------------------------------------
// Sound (optional – pass asset from require() when you have sound files)
// -----------------------------------------------------------------------------

let audioModeSet = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeSet) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    audioModeSet = true;
  } catch {
    // ignore
  }
}

/**
 * Play a short sound from a bundled asset.
 * Example: playSound(require('@/assets/sounds/like.mp3'))
 * Add .mp3 files to assets/sounds/ and require them where you call this.
 */
export async function playSound(asset: number): Promise<void> {
  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: true });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinishAndNotReset) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {
    // ignore (e.g. asset missing or playback failed)
  }
}
