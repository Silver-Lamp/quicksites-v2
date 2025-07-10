import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';

/**
 * Wraps a writable ResponseCookies store into a Promise-based adapter,
 * usable for Supabase or any cookie middleware that expects `() => Promise<...>`
 */
export function asWritableCookieAdapter(
  store: ResponseCookies
): () => Promise<ResponseCookies> {
  return () => Promise.resolve(store);
}
