import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

/**
 * Casts and wraps any cookie store as ReadonlyRequestCookies for Supabase.
 */
export function getSupabaseCookieAdapter(
  store: unknown
): () => Promise<ReadonlyRequestCookies> {
  return () => Promise.resolve(store as ReadonlyRequestCookies);
}
