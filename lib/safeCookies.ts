'use server';

import { cookies as nextCookies } from 'next/headers';
import type { CookieOptions } from '@/types/cookies';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';

import { safeParse } from './utils/safeParse';
import { getWritableCookieStore } from './utils/getWritableCookieStore';

/**
 * Reads a cookie value safely. Supports optional injection.
 */
export async function getSafeCookie(
  name: string,
  cookieStore?: ReadonlyRequestCookies
): Promise<string | object | undefined> {
  const store = cookieStore ?? (await nextCookies()); // ✅ Correct default

  const raw = store.get(name)?.value;
  return safeParse(raw);
}
/**
 * Sets a cookie. Use only in route handlers / server actions.
 */
export async function setSafeCookie(
  name: string,
  value: string | object,
  options: CookieOptions = {}
): Promise<void> {
  const store = await getWritableCookieStore(); // 🔁 Writable only in handlers
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);
  store.set(name, encoded, options);
}

/**
 * Deletes a cookie by name. Same constraints as `setSafeCookie`.
 */
export async function removeSafeCookie(name: string): Promise<void> {
  const store = await getWritableCookieStore();
  store.set(name, '', { maxAge: 0 });
}
