'use server';

import type { CookieOptions } from '@/types/cookies';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import { getReadableCookieStore } from './utils/getReadableCookieStore';
import { getWritableCookieStore } from './utils/getWritableCookieStore';
import { safeParse } from './utils/safeParse';

/**
 * Reads a cookie value safely, avoiding JSON.parse for base64 or JWT strings.
 */
export async function getSafeCookie(
  name: string,
  cookieStore?: ReadonlyRequestCookies
): Promise<string | object | undefined> {
  const store = cookieStore ?? (await getReadableCookieStore());
  const raw = store.get(name)?.value;
  return safeParse(raw);
}

/**
 * Sets a cookie (string or object), only valid in route handlers or server actions.
 */
export async function setSafeCookie(
  name: string,
  value: string | object,
  options: CookieOptions = {}
): Promise<void> {
  const store = await getWritableCookieStore();
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);
  store.set(name, encoded, options);
}

/**
 * Removes a cookie by name.
 */
export async function removeSafeCookie(name: string): Promise<void> {
  const store = await getWritableCookieStore();
  store.set(name, '', { maxAge: 0 });
}
