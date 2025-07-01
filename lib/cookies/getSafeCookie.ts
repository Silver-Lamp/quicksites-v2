'use server';

import {
  getReadableCookieStore,
  getWritableCookieStore,
  resolveCookiesSync,
  safeParse,
} from '../safeCookies';

import type { ReadonlyRequestCookies, ResponseCookies } from 'next/headers';

/**
 * Async getter — use in layouts, route handlers, or Server Actions.
 */
export async function getSafeCookie(
  name: string,
  cookieStore?: ReadonlyRequestCookies
): Promise<string | object | undefined> {
  const store = cookieStore ?? await getReadableCookieStore(); // ✅ updated
  const raw = store.get(name)?.value;
  return safeParse(raw);
}

/**
 * Sync getter — use only in synchronous Server Components.
 */
export function getSafeCookieSync(
  name: string,
  cookieStore?: ReadonlyRequestCookies
): string | object | undefined {
  const store = cookieStore ?? resolveCookiesSync();
  const raw = store.get(name)?.value;
  return safeParse(raw);
}

/**
 * Async setter — only works in Server Actions or Route Handlers.
 */
export async function setSafeCookie(
  name: string,
  value: string | object,
  options: Parameters<ResponseCookies['set']>[2] = {}
) {
  const store = await getWritableCookieStore(); // ✅ updated
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);
  store.set(name, encoded, options); // no optional chaining — required in writable contexts
}

/**
 * Async remover — only works in Server Actions or Route Handlers.
 */
export async function removeSafeCookie(name: string) {
  const store = await getWritableCookieStore(); // ✅ updated
  store.set(name, '', { maxAge: 0 });
}
