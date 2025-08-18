// lib/utils/safeParse.ts
export function safeParse<T = unknown>(input: string | null | undefined) {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;

  // If it doesn't look like JSON, return it as-is (no logging)
  const looksLikeJson =
    s.startsWith('{') || s.startsWith('[') || s.startsWith('"') || s === 'null' || s === 'true' || s === 'false';

  if (!looksLikeJson) return s;

  try {
    return JSON.parse(s) as T;
  } catch {
    // Return raw string instead of logging noisy errors
    return s;
  }
}
