/**
 * Stores base64 from camera/photo picker for log upload.
 * Avoids passing large base64 through navigation params.
 */

let lastPicked: { uri: string; base64: string } | null = null;

export function setPickedImageBase64(uri: string, base64: string): void {
  lastPicked = { uri, base64 };
}

export function getPickedImageBase64(uri: string): string | null {
  if (lastPicked?.uri === uri && lastPicked?.base64) {
    return lastPicked.base64;
  }
  return null;
}

export function clearPickedImage(): void {
  lastPicked = null;
}
