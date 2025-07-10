'use server';

import { cookies } from 'next/headers';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

/**
 * Returns a readable cookie store — safe to use in Server Components or Layouts.
 * Internally handles promise resolution if needed.
 */
export async function getReadableCookieStore(): Promise<ReadonlyRequestCookies> {
  const result = cookies();
  const store = result instanceof Promise ? await result : result;

  // Runtime check to verify presence of `get` method (expected on ReadonlyRequestCookies)
  if (typeof store !== 'object' || typeof (store as any).get !== 'function') {
    throw new Error(
      'getReadableCookieStore: Could not resolve a readable cookie store in this context.'
    );
  }

  return store as unknown as ReadonlyRequestCookies;
}
