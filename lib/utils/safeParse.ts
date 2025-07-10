/**
 * Safely attempts to parse JSON from a string. Returns original string if not JSON.
 * Falls back to undefined for null/empty or invalid values.
 */
export function safeParse<T = unknown>(input: string | undefined | null): T | string | undefined {
  if (!input || typeof input !== 'string') return undefined;

  try {
    const parsed = JSON.parse(input);
    return parsed as T;
  } catch {
    return input; // assume it was a plain string, like a cookie value
  }
}
