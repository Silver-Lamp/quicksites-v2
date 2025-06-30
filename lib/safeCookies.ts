// lib/safeCookies.ts
'use server';

import { cookies as rawCookies } from 'next/headers';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { CookieOptions } from '@/types/cookies';
import { safeParse } from './utils/safeParse';

// Async resolver: safe for Server Actions or Route Handlers
export async function getCookieStore(): Promise<ReadonlyRequestCookies> {
  const result = rawCookies();
  return result instanceof Promise ? await result : result;
}

// Async getter — used in layouts, server actions, and routes
export async function getSafeCookie(
  name: string,
  cookieStore?: ReadonlyRequestCookies
): Promise<string | object | undefined> {
  const store = cookieStore ?? (await getCookieStore());
  const raw = store.get(name)?.value;
  return safeParse(raw);
}

// Set cookie — only works in Server Actions or Route Handlers
export async function setSafeCookie(
  name: string,
  value: string | object,
  options: CookieOptions = {}
) {
  const store = (await getCookieStore()) as ResponseCookies;
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);
  //// @ts-expect-error: .set only available in route handlers
  store.set?.(name, encoded, options);
}

// Remove cookie
export async function removeSafeCookie(name: string) {
  const store = (await getCookieStore()) as ResponseCookies;
  //// @ts-expect-error: .set() only available in Route Handlers
  store.set?.(name, '', { maxAge: 0 });
}
