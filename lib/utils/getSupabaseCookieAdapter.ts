import type { CookieMethodsServer, CookieOptions } from '@supabase/ssr';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

/**
 * Build a CookieMethodsServer from a read-only cookie store.
 * Read-only is fine for most server reads (e.g., getUser/getSession).
 * If you ever need to *set* cookies here, swap to a response-bound adapter
 * that implements `setAll`.
 */
export function getSupabaseCookieAdapter(
  store: ReadonlyRequestCookies
): CookieMethodsServer {
  return {
    getAll: async () =>
      store.getAll().map((c) => ({ name: c.name, value: c.value })),
    // Leave setAll undefined in read-only contexts
    // setAll: (list: { name: string; value: string; options: CookieOptions }[]) => { ... }
  };
}
