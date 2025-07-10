'use server';

import { cookies } from 'next/headers';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';

/**
 * Returns a writable cookie store — only safe in Server Actions or Route Handlers.
 * Throws if called in static Server Components or outside of writable context.
 */
export async function getWritableCookieStore(): Promise<ResponseCookies> {
  const result = cookies();
  const store = result instanceof Promise ? await result : result;

  // Runtime guard — ResponseCookies must have `set` method
  if (typeof store !== 'object' || typeof (store as any).set !== 'function') {
    throw new Error(
      'getWritableCookieStore: Not in a writable context (must be Server Action or Route Handler)'
    );
  }

  return store as unknown as ResponseCookies;
}
