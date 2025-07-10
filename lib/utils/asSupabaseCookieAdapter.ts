import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

/**
 * Wraps a ReadonlyRequestCookies store into a Promise-returning adapter
 * compatible with Supabase `createServerComponentClient({ cookies })`
 */
export function asSupabaseCookieAdapter(
  store: ReadonlyRequestCookies
): () => Promise<ReadonlyRequestCookies> {
  return () => Promise.resolve(store);
}
