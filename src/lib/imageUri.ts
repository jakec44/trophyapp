/**
 * Hard guard: do not use JSON, error strings, or unsupported URI schemes as image URIs.
 * Reject: blob: (unsupported on React Native native), localhost (fails on physical device),
 * {, ", %22, or "error".
 */
export function isValidImageUri(uri: string | null | undefined): uri is string {
  if (uri == null || typeof uri !== 'string') return false;
  const s = uri.trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (s.includes('{') || s.includes('"') || s.includes('%22') || lower.includes('error')) return false;
  if (lower.startsWith('blob:')) return false;
  if (lower.includes('localhost:') || lower.includes('127.0.0.1')) return false;
  return true;
}
