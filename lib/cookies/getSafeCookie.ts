'use server';

import { getReadableCookieStore } from '../utils/getReadableCookieStore';
import { getWritableCookieStore } from '../utils/getWritableCookieStore';
import { resolveCookiesSync } from '../safeCookiesSync';
import { safeParse } from '../utils/safeParse';

import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';

/**
 * Async getter — use in layouts, route handlers, or Server Actions.
 */
export async function getSafeCookie(
  name: string,
  cookieStore?: ReadonlyRequestCookies
): Promise<string | object | undefined> {
  const store = cookieStore ?? await getReadableCookieStore();
  const raw = store.get(name)?.value;
  return safeParse(raw) as string | object | undefined;
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
  return safeParse(raw) as string | object | undefined;
}

/**
 * Async setter — only works in Server Actions or Route Handlers.
 */
export async function setSafeCookie(
  name: string,
  value: string | object,
  options: Parameters<ResponseCookies['set']>[2] = {}
): Promise<void> {
  const store = await getWritableCookieStore();
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);
  store.set(name, encoded, options);
}

/**
 * Async remover — only works in Server Actions or Route Handlers.
 */
export async function removeSafeCookie(name: string): Promise<void> {
  const store = await getWritableCookieStore();
  store.set(name, '', { maxAge: 0 });
}
