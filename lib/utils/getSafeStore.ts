import { cookies, headers } from 'next/headers';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

export async function getSafeCookieStore(
  mode: 'readable' | 'writable'
): Promise<ReadonlyRequestCookies | ResponseCookies> {
  const store = await cookies(); // ✅ explicitly await

  if (mode === 'readable' && !('set' in store)) {
    return store as ReadonlyRequestCookies;
  }

  if (mode === 'writable' && 'set' in store) {
    return store as ResponseCookies;
  }

  throw new Error(`getSafeCookieStore: store not valid for mode '${mode}'`);
}

export async function getSafeHeaderStore(): Promise<ReadonlyHeaders> {
  return await headers(); // Also explicitly await headers to be safe
}
