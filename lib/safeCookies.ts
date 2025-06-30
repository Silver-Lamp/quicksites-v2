'use server';

import { cookies as rawCookies } from 'next/headers';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import type { CookieOptions } from '@/types/cookies';
import { safeParse } from './utils/safeParse';

/**
 * Resolves cookie store safely, accounting for Next.js context quirks.
 */
export async function getCookieStore(): Promise<ReadonlyRequestCookies> {
  const store = rawCookies();
  return store instanceof Promise ? await store : store;
}

/**
 * Reads a cookie value safely, avoiding JSON.parse on base64 or JWT tokens.
 */
export async function getSafeCookie(
  name: string,
  cookieStore?: ReadonlyRequestCookies
): Promise<string | object | undefined> {
  const store = cookieStore ?? (await getCookieStore());

  // Guard against environments where `store.get` may not exist
  const value = typeof store?.get === 'function' ? store.get(name)?.value : undefined;
  return safeParse(value);
}

/**
 * Sets a cookie. Only works in Server Actions or Route Handlers.
 */
export async function setSafeCookie(
  name: string,
  value: string | object,
  options: CookieOptions = {}
) {
  const store = await getCookieStore();
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);

  // Guard in case we're in a context where store.set is not defined
  if (typeof (store as ResponseCookies)?.set === 'function') {
    (store as ResponseCookies).set(name, encoded, options);
  } else {
    console.warn(`[⚠️ setSafeCookie] Cannot set "${name}" outside a Route Handler or Server Action`);
  }
}

/**
 * Removes a cookie by setting maxAge to 0. Only works in Server Actions or Route Handlers.
 */
export async function removeSafeCookie(name: string) {
  const store = await getCookieStore();

  if (typeof (store as ResponseCookies)?.set === 'function') {
    (store as ResponseCookies).set(name, '', { maxAge: 0 });
  } else {
    console.warn(`[⚠️ removeSafeCookie] Cannot remove "${name}" outside a Route Handler or Server Action`);
  }
}
